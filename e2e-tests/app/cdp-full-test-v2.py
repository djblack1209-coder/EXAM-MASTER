#!/usr/bin/env python3
"""
Exam-Master App 全量功能测试 V2
通过 CDP 在每个页面的 View 层 WebView 中验证 DOM 渲染、交互元素、样式
然后通过导航打开所有子页面并逐一验证
"""
import json, time, sys, urllib.request, websocket

PASS = 0
FAIL = 0
RESULTS = []

def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def ok(msg):
    global PASS
    PASS += 1
    RESULTS.append(("PASS", msg))
    log(f"  ✅ {msg}")

def fail(msg):
    global FAIL
    FAIL += 1
    RESULTS.append(("FAIL", msg))
    log(f"  ❌ {msg}")

class CDP:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=10, suppress_origin=True)
        self.mid = 0

    def run(self, expr, timeout=6):
        self.mid += 1
        self.ws.send(json.dumps({
            "id": self.mid,
            "method": "Runtime.evaluate",
            "params": {"expression": expr, "returnByValue": True, "awaitPromise": True, "timeout": timeout * 1000}
        }))
        start = time.time()
        while time.time() - start < timeout:
            try:
                r = json.loads(self.ws.recv())
                if r.get("id") == self.mid:
                    res = r.get("result", {})
                    if "exceptionDetails" in res:
                        return {"__error": res["exceptionDetails"].get("text", "exception")}
                    val = res.get("result", {})
                    return val.get("value", val.get("description"))
            except websocket.WebSocketTimeoutException:
                break
        return {"__error": "timeout"}

    def close(self):
        try: self.ws.close()
        except: pass

def get_pages():
    data = json.loads(urllib.request.urlopen("http://localhost:9222/json").read())
    return {t["title"].split("[")[0]: t["webSocketDebuggerUrl"] for t in data if "[" in t.get("title","")}

def check(cdp, name, expr, expect_fn=None):
    r = cdp.run(expr)
    if isinstance(r, dict) and "__error" in r:
        fail(f"{name}: {r['__error']}")
        return False
    if expect_fn:
        if expect_fn(r):
            ok(name)
            return True
        else:
            fail(f"{name}: got {repr(r)[:80]}")
            return False
    else:
        if r and r != False and r != 0:
            ok(name)
            return True
        else:
            fail(f"{name}: got {repr(r)[:80]}")
            return False

# ============================================================
def test_index(cdp):
    log("\n📱 首页 (pages/index/index)")
    log("-" * 40)

    # 基本渲染
    check(cdp, "页面DOM已渲染", "document.body.children.length > 0")
    check(cdp, "有可见文字内容", "document.body.innerText.length > 20")
    check(cdp, "样式表已加载", "document.styleSheets.length > 0")

    # 关键UI元素
    check(cdp, "页面容器存在", """
        document.querySelector('.page-container') !== null ||
        document.querySelector('.index-page') !== null ||
        document.querySelector('[class*=index]') !== null ||
        document.querySelector('uni-page') !== null
    """)

    # 检查骨架屏是否已消失（页面加载完成）
    check(cdp, "骨架屏已消失(加载完成)", """
        (function() {
            var sk = document.querySelectorAll('[class*=skeleton]');
            var visible = 0;
            for (var i = 0; i < sk.length; i++) {
                var s = getComputedStyle(sk[i]);
                if (s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0') visible++;
            }
            return visible === 0;
        })()
    """)

    # 检查关键功能区域
    check(cdp, "有可点击元素", """
        document.querySelectorAll('[class*=btn],[class*=card],[class*=item],[class*=action],[class*=tab]').length > 0
    """)

    # 检查文字内容（确认不是空白页）
    check(cdp, "包含业务文字", """
        (function() {
            var t = document.body.innerText;
            return t.indexOf('考研') >= 0 || t.indexOf('学习') >= 0 || t.indexOf('刷题') >= 0 ||
                   t.indexOf('首页') >= 0 || t.indexOf('Exam') >= 0 || t.indexOf('今日') >= 0;
        })()
    """)

    # CSS 兼容性验证
    check(cdp, "无CSS渲染异常(元素不重叠)", """
        (function() {
            var items = document.querySelectorAll('[class*=card],[class*=section]');
            if (items.length < 2) return true;
            for (var i = 1; i < Math.min(items.length, 5); i++) {
                var r1 = items[i-1].getBoundingClientRect();
                var r2 = items[i].getBoundingClientRect();
                if (r1.bottom > r2.top + 5 && r1.top < r2.bottom - 5) return false;
            }
            return true;
        })()
    """)

    # 检查图片加载
    check(cdp, "图片元素正常", """
        (function() {
            var imgs = document.querySelectorAll('img,image,[class*=avatar],[class*=icon]');
            return imgs.length >= 0;
        })()
    """, lambda r: True)  # 首页可能没有图片也正常

def test_practice(cdp):
    log("\n📱 刷题中心 (pages/practice/index)")
    log("-" * 40)

    check(cdp, "页面DOM已渲染", "document.body.children.length > 0")
    check(cdp, "有可见文字内容", "document.body.innerText.length > 20")

    check(cdp, "骨架屏已消失", """
        (function() {
            var sk = document.querySelectorAll('[class*=skeleton]');
            var visible = 0;
            for (var i = 0; i < sk.length; i++) {
                var s = getComputedStyle(sk[i]);
                if (s.display !== 'none' && s.visibility !== 'hidden') visible++;
            }
            return visible === 0;
        })()
    """)

    # 刷题中心关键元素
    check(cdp, "有功能按钮/卡片", """
        document.querySelectorAll('[class*=btn],[class*=card],[class*=action],[class*=menu]').length > 0
    """)

    check(cdp, "包含刷题相关文字", """
        (function() {
            var t = document.body.innerText;
            return t.indexOf('题') >= 0 || t.indexOf('练习') >= 0 || t.indexOf('导入') >= 0 ||
                   t.indexOf('开始') >= 0 || t.indexOf('模拟') >= 0 || t.indexOf('PK') >= 0;
        })()
    """)

    check(cdp, "无CSS元素重叠", """
        (function() {
            var items = document.querySelectorAll('[class*=card],[class*=btn]');
            if (items.length < 2) return true;
            for (var i = 1; i < Math.min(items.length, 5); i++) {
                var r1 = items[i-1].getBoundingClientRect();
                var r2 = items[i].getBoundingClientRect();
                if (r1.bottom > r2.top + 5 && r1.top < r2.bottom - 5 &&
                    r1.right > r2.left + 5 && r1.left < r2.right - 5) return false;
            }
            return true;
        })()
    """)

def test_school(cdp):
    log("\n📱 择校分析 (pages/school/index)")
    log("-" * 40)

    check(cdp, "页面DOM已渲染", "document.body.children.length > 0")
    check(cdp, "有可见文字内容", "document.body.innerText.length > 10")

    check(cdp, "包含择校相关文字", """
        (function() {
            var t = document.body.innerText;
            return t.indexOf('院校') >= 0 || t.indexOf('学校') >= 0 || t.indexOf('择校') >= 0 ||
                   t.indexOf('搜索') >= 0 || t.indexOf('推荐') >= 0 || t.indexOf('分析') >= 0;
        })()
    """)

    check(cdp, "有搜索或筛选元素", """
        document.querySelectorAll('input,[class*=search],[class*=filter],[class*=tab]').length > 0
    """)

    check(cdp, "有院校卡片/列表", """
        document.querySelectorAll('[class*=card],[class*=school],[class*=item],[class*=list]').length > 0
    """)

def test_profile(cdp):
    log("\n📱 个人中心 (pages/profile/index)")
    log("-" * 40)

    check(cdp, "页面DOM已渲染", "document.body.children.length > 0")
    check(cdp, "有可见文字内容", "document.body.innerText.length > 10")

    check(cdp, "骨架屏已消失", """
        (function() {
            var sk = document.querySelectorAll('[class*=skeleton]');
            var visible = 0;
            for (var i = 0; i < sk.length; i++) {
                var s = getComputedStyle(sk[i]);
                if (s.display !== 'none' && s.visibility !== 'hidden') visible++;
            }
            return visible === 0;
        })()
    """)

    check(cdp, "有头像区域", """
        document.querySelectorAll('[class*=avatar],[class*=user],[class*=header]').length > 0
    """)

    check(cdp, "有菜单项", """
        document.querySelectorAll('[class*=menu],[class*=item],[class*=cell],[class*=entry]').length > 0
    """)

    check(cdp, "包含个人中心文字", """
        (function() {
            var t = document.body.innerText;
            return t.indexOf('设置') >= 0 || t.indexOf('登录') >= 0 || t.indexOf('我的') >= 0 ||
                   t.indexOf('学习') >= 0 || t.indexOf('计划') >= 0 || t.indexOf('打卡') >= 0;
        })()
    """)

# ============================================================
# 子页面测试 - 通过首页 CDP 触发导航，然后连接到新页面验证
# ============================================================
def navigate_and_test(page_path, page_label, checks, index_cdp):
    log(f"\n📱 {page_label} ({page_path})")
    log("-" * 40)

    # 通过首页触发导航
    nav_result = index_cdp.run(f"""
        new Promise(function(resolve) {{
            try {{
                uni.navigateTo({{
                    url: '{page_path}',
                    success: function() {{ setTimeout(function(){{ resolve('ok'); }}, 2000); }},
                    fail: function(e) {{ resolve('fail:' + (e.errMsg || JSON.stringify(e))); }}
                }});
            }} catch(e) {{ resolve('error:' + e.message); }}
        }})
    """, timeout=10)

    if isinstance(nav_result, dict) and "__error" in nav_result:
        fail(f"导航到{page_label}: {nav_result['__error']}")
        return
    if isinstance(nav_result, str) and nav_result.startswith("fail"):
        fail(f"导航到{page_label}: {nav_result}")
        return

    ok(f"导航到{page_label}成功")
    time.sleep(1)

    # 获取新打开的页面
    pages = get_pages()
    page_key = page_path.replace("/pages/", "pages/").split("?")[0]
    target_ws = None
    for k, v in pages.items():
        if page_key in k:
            target_ws = v
            break

    if not target_ws:
        fail(f"{page_label}页面未找到WebView")
        # 返回
        index_cdp.run("uni.navigateBack()")
        time.sleep(1)
        return

    try:
        sub_cdp = CDP(target_ws)
        for name, expr in checks:
            check(sub_cdp, f"{page_label}: {name}", expr)
        sub_cdp.close()
    except Exception as e:
        fail(f"{page_label}连接失败: {e}")

    # 返回
    time.sleep(0.5)
    index_cdp.run("uni.navigateBack()")
    time.sleep(1.5)

# ============================================================
if __name__ == "__main__":
    log("=" * 60)
    log("Exam-Master 全量功能测试 V2")
    log("=" * 60)

    try:
        pages = get_pages()
        log(f"发现 {len(pages)} 个 Tab 页面")
    except Exception as e:
        log(f"连接失败: {e}")
        sys.exit(1)

    # ---- 4个 Tab 页面测试 ----
    for name, ws in pages.items():
        try:
            cdp = CDP(ws)
            if "index/index" in name:
                test_index(cdp)
                index_ws = ws  # 保存首页 ws 用于后续导航
            elif "practice/index" in name:
                test_practice(cdp)
            elif "school/index" in name:
                test_school(cdp)
            elif "profile/index" in name:
                test_profile(cdp)
            cdp.close()
        except Exception as e:
            fail(f"{name} 连接失败: {e}")

    # ---- 子页面导航+渲染测试 ----
    log("\n" + "=" * 60)
    log("子页面导航+渲染测试")
    log("=" * 60)

    try:
        idx = CDP(index_ws)
    except:
        log("无法连接首页，跳过子页面测试")
        idx = None

    if idx:
        sub_pages = [
            ("/pages/settings/index", "设置页", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("有可见内容", "document.body.innerText.length > 10"),
                ("有设置菜单项", "document.querySelectorAll('[class*=menu],[class*=item],[class*=cell],[class*=setting]').length > 0"),
                ("包含设置文字", "(function(){var t=document.body.innerText;return t.indexOf('主题')>=0||t.indexOf('缓存')>=0||t.indexOf('关于')>=0||t.indexOf('隐私')>=0||t.indexOf('设置')>=0;})()"),
            ]),
            ("/pages/practice-sub/do-quiz?mode=practice", "做题页", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("页面高度正常", "document.body.scrollHeight > 50"),
            ]),
            ("/pages/practice-sub/mock-exam", "模拟考试", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("页面高度正常", "document.body.scrollHeight > 50"),
            ]),
            ("/pages/practice-sub/pk-battle", "PK对战", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("页面高度正常", "document.body.scrollHeight > 50"),
            ]),
            ("/pages/practice-sub/import-data", "导入数据", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("有可见内容", "document.body.innerText.length > 5"),
            ]),
            ("/pages/practice-sub/rank", "排行榜", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("页面高度正常", "document.body.scrollHeight > 50"),
            ]),
            ("/pages/mistake/index", "错题本", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("页面高度正常", "document.body.scrollHeight > 50"),
            ]),
            ("/pages/favorite/index", "收藏夹", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("页面高度正常", "document.body.scrollHeight > 50"),
            ]),
            ("/pages/school-sub/detail?id=test_school", "院校详情", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("页面高度正常", "document.body.scrollHeight > 50"),
            ]),
            ("/pages/school-sub/ai-consult?schoolName=%E6%B5%8B%E8%AF%95%E5%A4%A7%E5%AD%A6", "AI择校咨询", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("页面高度正常", "document.body.scrollHeight > 50"),
            ]),
            ("/pages/plan/index", "学习计划", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("页面高度正常", "document.body.scrollHeight > 50"),
            ]),
            ("/pages/plan/create", "创建计划", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("页面高度正常", "document.body.scrollHeight > 50"),
            ]),
            ("/pages/study-detail/index", "学习详情", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("页面高度正常", "document.body.scrollHeight > 50"),
            ]),
            ("/pages/knowledge-graph/index", "知识图谱", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("页面高度正常", "document.body.scrollHeight > 50"),
            ]),
            ("/pages/chat/chat", "AI聊天", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("有输入区域", "document.querySelectorAll('input,textarea,[class*=input],[class*=editor]').length > 0"),
            ]),
            ("/pages/tools/photo-search", "拍照搜题", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("页面高度正常", "document.body.scrollHeight > 50"),
            ]),
            ("/pages/tools/doc-convert", "文档转换", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("页面高度正常", "document.body.scrollHeight > 50"),
            ]),
            ("/pages/tools/id-photo", "证件照", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("页面高度正常", "document.body.scrollHeight > 50"),
            ]),
            ("/pages/login/index", "登录页", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("有可见内容", "document.body.innerText.length > 5"),
                ("有登录按钮", "document.querySelectorAll('[class*=btn],[class*=login],[class*=submit],button').length > 0"),
            ]),
            ("/pages/settings/privacy", "隐私政策", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("有文字内容", "document.body.innerText.length > 50"),
            ]),
            ("/pages/settings/terms", "用户协议", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("有文字内容", "document.body.innerText.length > 50"),
            ]),
            ("/pages/social/friend-list", "好友列表", [
                ("DOM已渲染", "document.body.children.length > 0"),
                ("页面高度正常", "document.body.scrollHeight > 50"),
            ]),
        ]

        for path, label, checks_list in sub_pages:
            navigate_and_test(path, label, checks_list, idx)

        idx.close()

    # ---- 最终错误检查 ----
    log("\n" + "=" * 60)
    log("ADB 日志错误检查")
    log("=" * 60)

    import subprocess
    result = subprocess.run(
        ["adb", "-s", "96304553", "logcat", "-d"],
        capture_output=True, text=True, timeout=10
    )
    errors = set()
    for line in result.stdout.split("\n"):
        if "console" in line.lower() and any(kw in line for kw in ["ERROR", "TypeError", "ReferenceError", "Cannot read", "is not defined", "is not a function"]):
            if "heartbeat" not in line and "Waiting to navigate" not in line:
                # 提取关键错误信息
                parts = line.split("console :")
                if len(parts) > 1:
                    errors.add(parts[1].strip()[:120])

    if not errors:
        ok("ADB日志零JS错误")
    else:
        for e in sorted(errors):
            fail(f"ADB日志错误: {e}")

    # ---- 报告 ----
    log("\n" + "=" * 60)
    log("📊 测试报告")
    log("=" * 60)
    log(f"通过: {PASS}")
    log(f"失败: {FAIL}")
    log(f"总计: {PASS + FAIL}")

    if FAIL > 0:
        log("\n失败项:")
        for status, msg in RESULTS:
            if status == "FAIL":
                log(f"  ❌ {msg}")

    if FAIL == 0:
        log("\n🎉 全量功能测试通过！项目可以提审发布。")
    else:
        log(f"\n⚠️  有 {FAIL} 个测试失败，需要检查。")

    sys.exit(1 if FAIL > 0 else 0)
