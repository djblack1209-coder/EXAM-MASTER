"""
考研大师 — 百度网盘文件操作工具

功能：
- 列出 /apps/考研大师/ 下的文件/目录
- 搜索 PDF 文件
- 下载文件（通过 dlink，有效期 8h）
- 创建目录
- 上传文件

用法：
  python3 scripts/baidu/pan.py ls [路径]           # 列出文件
  python3 scripts/baidu/pan.py ls -r [路径]         # 递归列出
  python3 scripts/baidu/pan.py search <关键词>      # 搜索文件
  python3 scripts/baidu/pan.py download <网盘路径> [本地路径]  # 下载文件
  python3 scripts/baidu/pan.py mkdir <路径>         # 创建目录
  python3 scripts/baidu/pan.py info <网盘路径>      # 查看文件详情

依赖：pip install requests python-dotenv
"""

import os, sys, json, time, re
from pathlib import Path
from typing import Optional

try:
    import requests
except ModuleNotFoundError:  # pragma: no cover - exercised by import-only unit tests.
    requests = None

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:  # pragma: no cover - optional until CLI/API calls need .env loading.
    def load_dotenv(*_args, **_kwargs):
        return False

# ============================================================
# 配置
# ============================================================
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_FILE = PROJECT_ROOT / ".env"
load_dotenv(ENV_FILE)

PAN_API = "https://pan.baidu.com/rest/2.0"
D_API = "https://d.pcs.baidu.com/rest/2.0"  # 下载域名

# 应用沙箱根目录
APP_ROOT = "/apps/考研大师"

# 下载专用 User-Agent（百度要求）
DOWNLOAD_UA = "pan.baidu.com"


def get_token() -> str:
    """获取 access_token"""
    token = os.environ.get("BAIDU_ACCESS_TOKEN", "")
    if not token:
        print("错误：BAIDU_ACCESS_TOKEN 未设置")
        print("请先运行：python3 scripts/baidu/auth.py")
        sys.exit(1)
    return token


def normalize_path(path: str, *, allow_full_path: bool = False) -> str:
    """标准化路径，确保在应用沙箱内"""
    if not path:
        return APP_ROOT
    if allow_full_path and path.startswith("/"):
        return path
    if not path.startswith("/"):
        path = f"{APP_ROOT}/{path}"
    if not path.startswith(APP_ROOT):
        path = f"{APP_ROOT}/{path.lstrip('/')}"
    return path


def format_size(size_bytes: int) -> str:
    """格式化文件大小"""
    if size_bytes < 1024:
        return f"{size_bytes}B"
    elif size_bytes < 1024**2:
        return f"{size_bytes/1024:.1f}KB"
    elif size_bytes < 1024**3:
        return f"{size_bytes/1024**2:.1f}MB"
    else:
        return f"{size_bytes/1024**3:.2f}GB"


def format_time(timestamp: int) -> str:
    """格式化时间戳"""
    return time.strftime("%Y-%m-%d %H:%M", time.localtime(timestamp))


# ============================================================
# API 封装
# ============================================================

class BaiduPan:
    """百度网盘 API 封装"""

    def __init__(self, access_token: str = None, *, allow_full_path: bool = False):
        self.token = access_token or get_token()
        self.session = requests.Session() if requests else None
        self.allow_full_path = allow_full_path

    def _get(self, url: str, params: dict, timeout: int = 15, *, max_retries: int = 3, sleep_fn=time.sleep) -> dict:
        """通用 GET 请求"""
        if self.session is None:
            raise RuntimeError("requests is required for Baidu Pan API calls")
        request_params = {**params, "access_token": self.token}
        for attempt in range(max_retries + 1):
            resp = self.session.get(url, params=request_params, timeout=timeout)
            data = resp.json()
            if data.get("errno", 0) == 0:
                return data

            errmsg = data.get("errmsg", f"errno={data.get('errno')}")
            if "frequency" not in str(errmsg).lower() or attempt >= max_retries:
                raise Exception(f"API 错误：{errmsg}")

            sleep_fn(min(30, 2 ** attempt))

        raise Exception("API 错误：request failed after retries")

    def list_files(self, dir_path: str = "", recursive: bool = False,
                   order: str = "name", limit: int = 1000) -> list:
        """
        列出目录下的文件

        Args:
            dir_path: 目录路径（相对于 /apps/考研大师/）
            recursive: 是否递归列出所有子目录
            order: 排序方式 name/time/size
            limit: 最大返回数
        """
        path = normalize_path(dir_path, allow_full_path=self.allow_full_path)

        if recursive:
            return self.list_all_files(path, order=order, limit=limit)
        else:
            data = self._get(
                f"{PAN_API}/xpan/file",
                {
                    "method": "list",
                    "dir": path,
                    "order": order,
                    "limit": limit,
                    "web": 1,
                },
            )
            return data.get("list", [])

    def list_all_files(self, dir_path: str = "", order: str = "time",
                       limit: int = 1000, mtime: int = 0,
                       ctime: int = 0) -> list:
        """
        递归列出目录下文件，自动处理分页游标。

        百度官方文档建议 listall 频率不超过每分钟 8-10 次；本方法只做
        元数据扫描，不下载文件，适合增量 manifest 构建。
        """
        path = normalize_path(dir_path, allow_full_path=self.allow_full_path)
        cursor = 0
        results = []
        safe_limit = max(1, min(int(limit or 1000), 1000))

        while True:
            params = {
                "method": "listall",
                "path": path,
                "recursion": 1,
                "order": order,
                "start": cursor,
                "limit": safe_limit,
                "web": 1,
            }
            if mtime:
                params["mtime"] = int(mtime)
            if ctime:
                params["ctime"] = int(ctime)

            data = self._get(f"{PAN_API}/xpan/multimedia", params)
            batch = data.get("list", [])
            results.extend(batch)

            if not data.get("has_more"):
                break
            next_cursor = data.get("cursor")
            if next_cursor is None or int(next_cursor) == cursor:
                break
            cursor = int(next_cursor)

        return results

    def search(self, keyword: str, dir_path: str = "",
               recursion: bool = True) -> list:
        """
        搜索文件

        Args:
            keyword: 搜索关键词
            dir_path: 搜索目录
            recursion: 是否递归搜索子目录
        """
        path = normalize_path(dir_path, allow_full_path=self.allow_full_path)
        data = self._get(
            f"{PAN_API}/xpan/file",
            {
                "method": "search",
                "key": keyword,
                "dir": path,
                "recursion": 1 if recursion else 0,
                "web": 1,
            },
        )
        return data.get("list", [])

    def file_info(self, fs_ids: list) -> list:
        """
        获取文件详情（包含 dlink）

        Args:
            fs_ids: 文件 ID 列表（最多100个）
        """
        data = self._get(
            f"{PAN_API}/xpan/multimedia",
            {
                "method": "filemetas",
                "fsids": json.dumps(fs_ids),
                "dlink": 1,
                "extra": 1,
            },
        )
        return data.get("list", [])

    def get_dlink(self, fs_id: int) -> str:
        """获取单个文件的下载链接"""
        files = self.file_info([fs_id])
        if not files:
            raise Exception(f"文件不存在: fs_id={fs_id}")
        return files[0].get("dlink", "")

    def download(self, remote_path: str, local_path: str = None,
                 overwrite: bool = False) -> str:
        """
        下载文件

        Args:
            remote_path: 网盘路径
            local_path: 本地保存路径（默认当前目录同名文件）
            overwrite: 是否覆盖已有文件

        Returns:
            本地文件路径
        """
        path = normalize_path(remote_path, allow_full_path=self.allow_full_path)

        # 先获取文件列表找到 fs_id
        parent_dir = "/".join(path.split("/")[:-1])
        filename = path.split("/")[-1]
        files = self.list_files(parent_dir)
        target = None
        for f in files:
            if f.get("server_filename") == filename or f.get("path") == path:
                target = f
                break

        if not target:
            raise Exception(f"文件不找到: {path}")

        fs_id = target["fs_id"]
        file_size = target.get("size", 0)

        # 获取 dlink
        info = self.file_info([fs_id])
        if not info or not info[0].get("dlink"):
            raise Exception("无法获取下载链接")

        dlink = info[0]["dlink"]

        # 确定本地路径
        if not local_path:
            local_path = target["server_filename"]
        local_path = str(Path(local_path).resolve())

        if os.path.exists(local_path) and not overwrite:
            existing_size = os.path.getsize(local_path)
            if existing_size == file_size:
                print(f"  跳过（已存在且大小一致）: {local_path}")
                return local_path
            else:
                print(f"  覆盖（大小不一致 {existing_size} vs {file_size}）")

        # 下载
        print(f"  下载: {target['server_filename']} ({format_size(file_size)})")
        download_url = f"{dlink}&access_token={self.token}"

        resp = self.session.get(
            download_url,
            headers={"User-Agent": DOWNLOAD_UA},
            stream=True,
            timeout=300,
        )

        if resp.status_code != 200:
            raise Exception(f"下载失败: HTTP {resp.status_code}")

        # 确保目录存在
        os.makedirs(os.path.dirname(local_path) or ".", exist_ok=True)

        downloaded = 0
        with open(local_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
                downloaded += len(chunk)
                if file_size > 1024**2:  # 大于1MB才显示进度
                    pct = downloaded / file_size * 100 if file_size else 0
                    print(f"\r  进度: {format_size(downloaded)} / {format_size(file_size)} ({pct:.0f}%)", end="", flush=True)

        if file_size > 1024**2:
            print()  # 换行

        print(f"  保存: {local_path}")
        return local_path

    def download_pdfs(self, dir_path: str = "", local_dir: str = None,
                      overwrite: bool = False) -> list:
        """
        批量下载目录下所有 PDF 文件

        Args:
            dir_path: 网盘目录
            local_dir: 本地保存目录
            overwrite: 是否覆盖

        Returns:
            下载成功的本地文件路径列表
        """
        if local_dir is None:
            local_dir = str(PROJECT_ROOT / "data" / "raw-pdf")

        os.makedirs(local_dir, exist_ok=True)

        # 递归搜索 PDF
        files = self.search(".pdf", dir_path)
        pdf_files = [f for f in files if f.get("server_filename", "").lower().endswith(".pdf")]

        if not pdf_files:
            print(f"  未找到 PDF 文件")
            return []

        print(f"  找到 {len(pdf_files)} 个 PDF 文件")
        downloaded = []

        for i, f in enumerate(pdf_files):
            fname = f["server_filename"]
            size = f.get("size", 0)
            print(f"\n[{i+1}/{len(pdf_files)}] {fname} ({format_size(size)})")

            # 过滤小文件（<50KB 大概率是广告单页）
            if size < 50 * 1024:
                print(f"  跳过（<50KB，疑似广告）")
                continue

            # 过滤广告文件名
            ad_keywords = ["报名", "咨询", "加群", "优惠", "客服", "答疑"]
            if any(kw in fname for kw in ad_keywords):
                print(f"  跳过（文件名含广告关键词）")
                continue

            try:
                local_path = os.path.join(local_dir, fname)
                info = self.file_info([f["fs_id"]])
                if not info or not info[0].get("dlink"):
                    print(f"  跳过（无法获取下载链接）")
                    continue

                dlink = info[0]["dlink"]
                download_url = f"{dlink}&access_token={self.token}"

                if os.path.exists(local_path) and not overwrite:
                    existing_size = os.path.getsize(local_path)
                    if existing_size == size:
                        print(f"  跳过（已存在）")
                        downloaded.append(local_path)
                        continue

                resp = self.session.get(
                    download_url,
                    headers={"User-Agent": DOWNLOAD_UA},
                    stream=True,
                    timeout=300,
                )
                with open(local_path, "wb") as fp:
                    for chunk in resp.iter_content(chunk_size=8192):
                        fp.write(chunk)

                print(f"  已下载: {local_path}")
                downloaded.append(local_path)

                # 避免频率限制
                time.sleep(2)

            except Exception as e:
                print(f"  下载失败: {e}")

        return downloaded

    def mkdir(self, dir_path: str) -> dict:
        """创建目录"""
        path = normalize_path(dir_path, allow_full_path=self.allow_full_path)
        resp = self.session.post(
            f"{PAN_API}/xpan/file",
            params={"method": "create", "access_token": self.token},
            data={"path": path, "size": 0, "isdir": 1, "rtype": 1},
            timeout=15,
        )
        data = resp.json()
        if data.get("errno", 0) != 0:
            raise Exception(f"创建目录失败: {data.get('errmsg', data)}")
        return data


# ============================================================
# CLI
# ============================================================
def print_file_list(files: list, show_path: bool = False):
    """打印文件列表"""
    if not files:
        print("  (空)")
        return

    for f in files:
        is_dir = f.get("isdir", 0) == 1
        name = f.get("server_filename", f.get("path", "?"))
        size = format_size(f.get("size", 0)) if not is_dir else "<DIR>"
        mtime = format_time(f.get("server_mtime", 0))
        prefix = "📁" if is_dir else "📄"
        display = f.get("path", name) if show_path else name

        print(f"  {prefix} {display:<50s} {size:>10s}  {mtime}")

    total_size = sum(f.get("size", 0) for f in files if f.get("isdir", 0) == 0)
    file_count = sum(1 for f in files if f.get("isdir", 0) == 0)
    dir_count = sum(1 for f in files if f.get("isdir", 0) == 1)
    print(f"\n  共 {dir_count} 个目录, {file_count} 个文件, 总计 {format_size(total_size)}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    cmd = sys.argv[1]
    path_args = [arg for arg in sys.argv[2:] if arg != "-r"]
    allow_full_path = any(arg.startswith("/") for arg in path_args)
    pan = BaiduPan(allow_full_path=allow_full_path)

    if cmd == "ls":
        recursive = "-r" in sys.argv
        path = ""
        for arg in sys.argv[2:]:
            if arg != "-r":
                path = arg
                break

        print(f"\n{'递归列出' if recursive else '列出'}: {normalize_path(path, allow_full_path=allow_full_path)}")
        files = pan.list_files(path, recursive=recursive)
        print_file_list(files, show_path=recursive)

    elif cmd == "search":
        if len(sys.argv) < 3:
            print("用法: pan.py search <关键词>")
            sys.exit(1)
        keyword = sys.argv[2]
        print(f"\n搜索: {keyword}")
        files = pan.search(keyword)
        print_file_list(files, show_path=True)

    elif cmd == "download":
        if len(sys.argv) < 3:
            print("用法: pan.py download <网盘路径> [本地路径]")
            sys.exit(1)
        remote = sys.argv[2]
        local = sys.argv[3] if len(sys.argv) > 3 else None
        pan.download(remote, local)

    elif cmd == "download-pdfs":
        path = sys.argv[2] if len(sys.argv) > 2 else ""
        local_dir = sys.argv[3] if len(sys.argv) > 3 else None
        print(f"\n批量下载 PDF: {normalize_path(path, allow_full_path=allow_full_path)}")
        results = pan.download_pdfs(path, local_dir)
        print(f"\n完成：下载 {len(results)} 个文件")

    elif cmd == "mkdir":
        if len(sys.argv) < 3:
            print("用法: pan.py mkdir <路径>")
            sys.exit(1)
        dir_path = sys.argv[2]
        pan.mkdir(dir_path)
        print(f"已创建: {normalize_path(dir_path, allow_full_path=allow_full_path)}")

    elif cmd == "info":
        if len(sys.argv) < 3:
            print("用法: pan.py info <网盘路径>")
            sys.exit(1)
        path = normalize_path(sys.argv[2], allow_full_path=allow_full_path)
        # 先列出找到文件
        parent = "/".join(path.split("/")[:-1])
        fname = path.split("/")[-1]
        files = pan.list_files(parent)
        target = [f for f in files if f.get("server_filename") == fname]
        if not target:
            print(f"文件不存在: {path}")
            sys.exit(1)

        f = target[0]
        info = pan.file_info([f["fs_id"]])[0]
        print(f"\n文件信息:")
        print(f"  路径: {info.get('path', path)}")
        print(f"  大小: {format_size(info.get('size', 0))}")
        print(f"  MD5:  {info.get('md5', 'N/A')}")
        print(f"  fs_id: {info.get('fs_id', 'N/A')}")
        if info.get("dlink"):
            print(f"  dlink: {info['dlink'][:80]}... (有效期8h)")

    else:
        print(f"未知命令: {cmd}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
