"""
考研大师 — 百度网盘 OAuth 授权工具

支持两种授权方式：
1. 设备码模式（推荐）：终端显示链接 → 浏览器扫码 → 自动获取 token
2. 授权码模式：浏览器跳转 → 粘贴回调 code → 获取 token

获取 token 后自动写入 .env 文件。

用法：
  python3 scripts/baidu/auth.py          # 设备码模式（推荐）
  python3 scripts/baidu/auth.py --code   # 授权码模式
  python3 scripts/baidu/auth.py --refresh # 刷新已有 token
  python3 scripts/baidu/auth.py --status  # 查看当前 token 状态

依赖：pip install requests python-dotenv
"""

import os, sys, time, json, webbrowser
from pathlib import Path
from urllib.parse import urlencode, quote

import requests
from dotenv import load_dotenv, set_key

# ============================================================
# 配置
# ============================================================
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_FILE = PROJECT_ROOT / ".env"

# 加载 .env
load_dotenv(ENV_FILE)

APP_KEY = os.environ.get("BAIDU_APP_KEY", "")
SECRET_KEY = os.environ.get("BAIDU_SECRET_KEY", "")
APP_ID = os.environ.get("BAIDU_APP_ID", "")

# 百度 OAuth 端点
OAUTH_BASE = "https://openapi.baidu.com/oauth/2.0"
PAN_API = "https://pan.baidu.com/rest/2.0"


def check_credentials():
    """检查凭据是否配置"""
    if not APP_KEY or not SECRET_KEY:
        print("错误：BAIDU_APP_KEY 或 BAIDU_SECRET_KEY 未配置")
        print(f"请在 {ENV_FILE} 中填写百度开放平台凭据")
        sys.exit(1)


def save_tokens(access_token: str, refresh_token: str):
    """将 token 写入 .env 文件"""
    set_key(str(ENV_FILE), "BAIDU_ACCESS_TOKEN", access_token)
    set_key(str(ENV_FILE), "BAIDU_REFRESH_TOKEN", refresh_token)
    print(f"\n已保存 token 到 {ENV_FILE}")
    print(f"  access_token:  {access_token[:20]}...")
    print(f"  refresh_token: {refresh_token[:20]}...")


def verify_token(access_token: str) -> dict:
    """验证 token 并获取用户信息"""
    resp = requests.get(
        f"{PAN_API}/xpan/nas",
        params={"method": "uinfo", "access_token": access_token},
        timeout=10,
    )
    data = resp.json()

    if "errmsg" in data and data.get("errno", 0) != 0:
        return {"ok": False, "error": data.get("errmsg", "未知错误")}

    vip_map = {0: "普通用户", 1: "普通会员", 2: "超级会员"}
    return {
        "ok": True,
        "name": data.get("baidu_name", "未知"),
        "vip": vip_map.get(data.get("vip_type", 0), "未知"),
        "uk": data.get("uk", 0),
    }


def get_quota(access_token: str) -> dict:
    """获取网盘容量信息"""
    resp = requests.get(
        f"{PAN_API}/api/quota",
        params={"access_token": access_token, "checkfree": 1, "checkexpire": 1},
        timeout=10,
    )
    data = resp.json()
    if data.get("errno", 0) != 0:
        return {"ok": False}

    total_gb = data.get("total", 0) / (1024**3)
    used_gb = data.get("used", 0) / (1024**3)
    return {
        "ok": True,
        "total": f"{total_gb:.1f}GB",
        "used": f"{used_gb:.1f}GB",
        "free": f"{total_gb - used_gb:.1f}GB",
    }


# ============================================================
# 设备码模式
# ============================================================
def device_code_flow():
    """设备码授权流程（推荐）"""
    check_credentials()
    print("="*50)
    print("百度网盘 OAuth — 设备码模式")
    print("="*50)

    # 1. 获取设备码
    resp = requests.get(
        f"{OAUTH_BASE}/device/code",
        params={
            "response_type": "device_code",
            "client_id": APP_KEY,
            "scope": "basic,netdisk",
        },
        timeout=10,
    )
    data = resp.json()

    if "error" in data:
        print(f"错误：{data.get('error_description', data['error'])}")
        sys.exit(1)

    device_code = data["device_code"]
    user_code = data["user_code"]
    verify_url = data["verification_url"]
    qrcode_url = data.get("qrcode_url", "")
    interval = data.get("interval", 5)
    expires_in = data.get("expires_in", 300)

    print(f"\n请在浏览器中打开以下链接并登录授权：")
    print(f"\n  {verify_url}\n")
    print(f"输入用户码：{user_code}")
    if qrcode_url:
        print(f"\n或扫描二维码：{qrcode_url}")
    print(f"\n授权码有效期：{expires_in // 60}分钟")

    # 尝试自动打开浏览器
    try:
        webbrowser.open(verify_url)
        print("(已尝试自动打开浏览器)")
    except Exception:
        pass

    # 2. 轮询等待授权
    print(f"\n等待授权中（每{interval}秒检查一次）...")
    deadline = time.time() + expires_in

    while time.time() < deadline:
        time.sleep(interval)

        resp = requests.get(
            f"{OAUTH_BASE}/token",
            params={
                "grant_type": "device_token",
                "code": device_code,
                "client_id": APP_KEY,
                "client_secret": SECRET_KEY,
            },
            timeout=10,
        )
        result = resp.json()

        if "access_token" in result:
            print("\n授权成功！")
            access_token = result["access_token"]
            refresh_token = result["refresh_token"]
            expires = result.get("expires_in", 0)
            print(f"token 有效期：{expires // 86400}天")

            # 验证
            info = verify_token(access_token)
            if info["ok"]:
                print(f"用户：{info['name']} ({info['vip']})")

            quota = get_quota(access_token)
            if quota["ok"]:
                print(f"容量：已用 {quota['used']} / 总计 {quota['total']}")

            save_tokens(access_token, refresh_token)
            return

        error = result.get("error", "")
        if error == "authorization_pending":
            print(".", end="", flush=True)
        elif error == "slow_down":
            interval += 1
        else:
            print(f"\n错误：{result.get('error_description', error)}")
            sys.exit(1)

    print("\n超时：授权码已过期，请重新运行")
    sys.exit(1)


# ============================================================
# 授权码模式
# ============================================================
def authorization_code_flow():
    """授权码模式"""
    check_credentials()
    print("="*50)
    print("百度网盘 OAuth — 授权码模式")
    print("="*50)

    # 使用 oob 回调（无需搭建回调服务器）
    auth_url = (
        f"{OAUTH_BASE}/authorize?"
        f"response_type=code&"
        f"client_id={APP_KEY}&"
        f"redirect_uri=oob&"
        f"scope=basic,netdisk&"
        f"display=popup"
    )

    print(f"\n请在浏览器中打开以下链接并登录授权：\n")
    print(f"  {auth_url}\n")

    try:
        webbrowser.open(auth_url)
        print("(已尝试自动打开浏览器)")
    except Exception:
        pass

    code = input("\n授权后，请将页面上显示的授权码粘贴到这里：").strip()

    if not code:
        print("错误：未输入授权码")
        sys.exit(1)

    # 换取 token
    resp = requests.get(
        f"{OAUTH_BASE}/token",
        params={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": APP_KEY,
            "client_secret": SECRET_KEY,
            "redirect_uri": "oob",
        },
        timeout=10,
    )
    result = resp.json()

    if "access_token" in result:
        print("\n授权成功！")
        access_token = result["access_token"]
        refresh_token = result["refresh_token"]
        expires = result.get("expires_in", 0)
        print(f"token 有效期：{expires // 86400}天")

        info = verify_token(access_token)
        if info["ok"]:
            print(f"用户：{info['name']} ({info['vip']})")

        save_tokens(access_token, refresh_token)
    else:
        print(f"错误：{result.get('error_description', result.get('error', '未知错误'))}")
        sys.exit(1)


# ============================================================
# Token 刷新
# ============================================================
def refresh_token_flow():
    """刷新 access_token"""
    check_credentials()
    refresh_token = os.environ.get("BAIDU_REFRESH_TOKEN", "")
    if not refresh_token:
        print("错误：BAIDU_REFRESH_TOKEN 未设置，请先完成授权")
        sys.exit(1)

    print("刷新 token...")
    resp = requests.get(
        f"{OAUTH_BASE}/token",
        params={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": APP_KEY,
            "client_secret": SECRET_KEY,
        },
        timeout=10,
    )
    result = resp.json()

    if "access_token" in result:
        print("刷新成功！")
        new_access = result["access_token"]
        new_refresh = result["refresh_token"]
        expires = result.get("expires_in", 0)
        print(f"新 token 有效期：{expires // 86400}天")

        info = verify_token(new_access)
        if info["ok"]:
            print(f"用户：{info['name']} ({info['vip']})")

        save_tokens(new_access, new_refresh)
    else:
        print(f"刷新失败：{result.get('error_description', '未知错误')}")
        print("请重新运行授权流程")
        sys.exit(1)


# ============================================================
# 状态查看
# ============================================================
def show_status():
    """显示当前 token 状态"""
    print("="*50)
    print("百度网盘 OAuth 状态")
    print("="*50)

    access_token = os.environ.get("BAIDU_ACCESS_TOKEN", "")
    if not access_token:
        print("\n状态：未授权")
        print("运行 python3 scripts/baidu/auth.py 进行授权")
        return

    print(f"\naccess_token: {access_token[:20]}...")

    info = verify_token(access_token)
    if info["ok"]:
        print(f"状态：有效")
        print(f"用户：{info['name']}")
        print(f"会员：{info['vip']}")
        print(f"UK：{info['uk']}")

        quota = get_quota(access_token)
        if quota["ok"]:
            print(f"容量：已用 {quota['used']} / 总计 {quota['total']} (剩余 {quota['free']})")
    else:
        print(f"状态：已过期 ({info['error']})")
        print("运行 python3 scripts/baidu/auth.py --refresh 刷新 token")


# ============================================================
# CLI
# ============================================================
if __name__ == "__main__":
    if "--code" in sys.argv:
        authorization_code_flow()
    elif "--refresh" in sys.argv:
        refresh_token_flow()
    elif "--status" in sys.argv:
        show_status()
    else:
        device_code_flow()
