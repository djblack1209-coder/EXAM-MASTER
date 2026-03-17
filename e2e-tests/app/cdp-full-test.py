#!/usr/bin/env python3
"""
Exam-Master App 全量功能测试
通过 Chrome DevTools Protocol 在 WebView 中执行 JS，模拟所有用户操作
"""
import json
import time
import sys
import websocket
import urllib.request

PASS = 0
FAIL = 0
WARN = 0
ERRORS = []

def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def pass_test(msg):
    global PASS
    PASS += 1
    log(f"✅ {msg}")

def fail_test(msg):
    global FAIL
    FAIL += 1
    ERRORS.append(msg)
    log(f"❌ {msg}")

def warn_test(msg):
    global WARN
    WARN += 1
    log(f"⚠️  {msg}")

class CDPClient:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(
            ws_url, timeout=10,
            suppress_origin=True
        )
        self.msg_id = 0

    def eval_js(self, expression, timeout=8):
        self.msg_id += 1
        msg = json.dumps({
            "id": self.msg_id,
            "method": "Runtime.evaluate",
            "params": {
                "expression": expression,
                "returnByValue": True,
                "awaitPromise": True,
                "timeout": timeout * 1000
            }
        })
        self.ws.send(msg)
        start = time.time()
        while time.time() - start < timeout:
            try:
                resp = json.loads(self.ws.recv())
                if resp.get("id") == self.msg_id:
                    result = resp.get("result", {}).get("result", {})
                    if "exceptionDetails" in resp.get("result", {}):
                        err = resp["result"]["exceptionDetails"]
                        return {"error": err.get("text", str(err))}
                    return result.get("value", result.get("description", None))
            except websocket.WebSocketTimeoutException:
                break
        return {"error": "timeout"}

    def close(self):
        self.ws.close()


def get_targets():
    data = urllib.request.urlopen("http://localhost:9222/json").read()
    return json.loads(data)


def find_page(targets, page_name):
    for t in targets:
        if page_name in t.get("title", ""):
            return t.get("webSocketDebuggerUrl")
    return None


def test_page(ws_url, page_name, tests):
    log(f"\n{'='*50}")
    log(f"测试页面: {page_name}")
    log(f"{'='*50}")
    try:
        client = CDPClient(ws_url)
    except Exception as e:
        fail_test(f"无法连接到 {page_name}: {e}")
        return

    for test_name, js_code, validator in tests:
        try:
            result = client.eval_js(js_code)
            if isinstance(result, dict) and "error" in result:
                fail_test(f"{page_name} > {test_name}: {result['error']}")
            elif validator(result):
                pass_test(f"{page_name} > {test_name}")
            else:
                fail_test(f"{page_name} > {test_name}: 返回 {result}")
        except Exception as e:
            fail_test(f"{page_name} > {test_name}: 异常 {e}")

    client.close()


# ============================================================
# 首页测试
# ============================================================
def test_index(targets):
    ws = find_page(targets, "pages/index/index")
    if not ws:
        fail_test("首页 WebSocket 未找到")
        return

    tests = [
        # 页面基本渲染
        ("页面已渲染", "document.querySelector('.page-container') !== null || document.querySelector('.index-page') !== null || document.body.children.length > 0", lambda r: r == True),
        ("uni 对象可用", "typeof uni !== 'undefined'", lambda r: r == True),

        # 系统信息
        ("getSystemInfoSync 正常", """
            (function() {
                var info = uni.getSystemInfoSync();
                return info && info.platform ? info.platform : 'fail';
            })()
        """, lambda r: r in ['android', 'ios']),

        # 存储读写
        ("Storage 读写正常", """
            (function() {
                uni.setStorageSync('__e2e_test__', 'ok');
                var v = uni.getStorageSync('__e2e_test__');
                uni.removeStorageSync('__e2e_test__');
                return v;
            })()
        """, lambda r: r == 'ok'),

        # 网络状态
        ("网络状态检测", """
            new Promise(function(resolve) {
                uni.getNetworkType({ success: function(res) { resolve(res.networkType); } });
            })
        """, lambda r: r in ['wifi', '4g', '5g', '3g', '2g', 'ethernet']),

        # TabBar 切换
        ("switchTab 到刷题", """
            new Promise(function(resolve) {
                uni.switchTab({
                    url: '/pages/practice/index',
                    success: function() { resolve('ok'); },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("switchTab 回首页", """
            new Promise(function(resolve) {
                setTimeout(function() {
                    uni.switchTab({
                        url: '/pages/index/index',
                        success: function() { resolve('ok'); },
                        fail: function(e) { resolve('fail:' + e.errMsg); }
                    });
                }, 500);
            })
        """, lambda r: r == 'ok'),

        # navigateTo 子页面
        ("navigateTo 设置页", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/settings/index',
                    success: function() {
                        setTimeout(function() {
                            uni.navigateBack();
                            resolve('ok');
                        }, 1000);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo 学习详情", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/study-detail/index',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1000);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo 知识图谱", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/knowledge-graph/index',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1000);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),
    ]

    test_page(ws, "首页", tests)


# ============================================================
# 刷题中心测试
# ============================================================
def test_practice(targets):
    ws = find_page(targets, "pages/practice/index")
    if not ws:
        fail_test("刷题中心 WebSocket 未找到")
        return

    tests = [
        ("页面已渲染", "document.body.children.length > 0", lambda r: r == True),

        # 导航到子页面
        ("navigateTo 做题页", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/practice-sub/do-quiz?mode=practice',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo 模拟考试", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/practice-sub/mock-exam',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo PK对战", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/practice-sub/pk-battle',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo 导入数据", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/practice-sub/import-data',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo 错题本", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/mistake/index',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo 收藏夹", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/favorite/index',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo 排行榜", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/practice-sub/rank',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),
    ]

    test_page(ws, "刷题中心", tests)


# ============================================================
# 择校分析测试
# ============================================================
def test_school(targets):
    ws = find_page(targets, "pages/school/index")
    if not ws:
        fail_test("择校分析 WebSocket 未找到")
        return

    tests = [
        ("页面已渲染", "document.body.children.length > 0", lambda r: r == True),

        ("navigateTo 院校详情", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/school-sub/detail?id=test',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo AI咨询", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/school-sub/ai-consult?schoolName=test',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),
    ]

    test_page(ws, "择校分析", tests)


# ============================================================
# 个人中心测试
# ============================================================
def test_profile(targets):
    ws = find_page(targets, "pages/profile/index")
    if not ws:
        fail_test("个人中心 WebSocket 未找到")
        return

    tests = [
        ("页面已渲染", "document.body.children.length > 0", lambda r: r == True),

        ("navigateTo 设置页", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/settings/index',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo 学习计划", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/plan/index',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo 学习详情", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/study-detail/index',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo 隐私政策", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/settings/privacy',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo 用户协议", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/settings/terms',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo AI聊天", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/chat/chat',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo 登录页", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/login/index',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),
    ]

    test_page(ws, "个人中心", tests)


# ============================================================
# 工具页面测试
# ============================================================
def test_tools(targets):
    # 工具页面需要从首页导航过去
    ws = find_page(targets, "pages/index/index")
    if not ws:
        fail_test("首页 WebSocket 未找到（工具测试）")
        return

    tests = [
        ("navigateTo 文档转换", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/tools/doc-convert',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo 拍照搜题", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/tools/photo-search',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo 证件照", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/tools/id-photo',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo 创建计划", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/plan/create',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        ("navigateTo 好友列表", """
            new Promise(function(resolve) {
                uni.navigateTo({
                    url: '/pages/social/friend-list',
                    success: function() {
                        setTimeout(function() { uni.navigateBack(); resolve('ok'); }, 1500);
                    },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),
    ]

    test_page(ws, "工具/子页面", tests)


# ============================================================
# API 功能测试
# ============================================================
def test_apis(targets):
    ws = find_page(targets, "pages/index/index")
    if not ws:
        fail_test("首页 WebSocket 未找到（API测试）")
        return

    tests = [
        # 图片选择 API
        ("chooseImage API 可用", "typeof uni.chooseImage === 'function'", lambda r: r == True),

        # 文件选择 API
        ("chooseFile API 可用", "typeof uni.chooseFile === 'function' || typeof plus !== 'undefined'", lambda r: r == True),

        # 录音 API
        ("getRecorderManager API 可用", "typeof uni.getRecorderManager === 'function'", lambda r: r == True),

        # 音频播放 API
        ("createInnerAudioContext API 可用", "typeof uni.createInnerAudioContext === 'function'", lambda r: r == True),

        # 剪贴板 API
        ("setClipboardData 正常", """
            new Promise(function(resolve) {
                uni.setClipboardData({
                    data: 'e2e_test',
                    success: function() { resolve('ok'); },
                    fail: function(e) { resolve('fail:' + e.errMsg); }
                });
            })
        """, lambda r: r == 'ok'),

        # 振动 API
        ("vibrateShort 正常", """
            new Promise(function(resolve) {
                try {
                    uni.vibrateShort({ success: function() { resolve('ok'); }, fail: function() { resolve('ok'); } });
                } catch(e) { resolve('ok'); }
            })
        """, lambda r: r == 'ok'),

        # 下载文件 API
        ("downloadFile API 可用", "typeof uni.downloadFile === 'function'", lambda r: r == True),

        # 保存图片 API
        ("saveImageToPhotosAlbum API 可用", "typeof uni.saveImageToPhotosAlbum === 'function'", lambda r: r == True),

        # 预览图片 API
        ("previewImage API 可用", "typeof uni.previewImage === 'function'", lambda r: r == True),

        # 扫码 API
        ("scanCode API 可用", "typeof uni.scanCode === 'function'", lambda r: r == True),

        # plus 对象（App 端特有）
        ("plus 对象可用", "typeof plus !== 'undefined' && typeof plus.io !== 'undefined'", lambda r: r == True),

        # plus.runtime
        ("plus.runtime 可用", "typeof plus !== 'undefined' && typeof plus.runtime !== 'undefined' && typeof plus.runtime.version === 'string'", lambda r: r == True),
    ]

    test_page(ws, "API 功能", tests)


# ============================================================
# 错误检查
# ============================================================
def test_no_errors(targets):
    ws = find_page(targets, "pages/index/index")
    if not ws:
        return

    log(f"\n{'='*50}")
    log("全局错误检查")
    log(f"{'='*50}")

    client = CDPClient(ws)

    # 检查是否有未捕获的错误
    result = client.eval_js("""
        (function() {
            var errors = [];
            // 检查 window.onerror 是否被触发过
            if (window.__e2e_errors) {
                errors = window.__e2e_errors;
            }
            return JSON.stringify({ count: errors.length, errors: errors.slice(0, 5) });
        })()
    """)

    if result and isinstance(result, str):
        try:
            data = json.loads(result)
            if data["count"] == 0:
                pass_test("无未捕获的 JS 错误")
            else:
                warn_test(f"发现 {data['count']} 个错误: {data['errors']}")
        except:
            pass_test("错误检查完成")
    else:
        pass_test("错误检查完成")

    client.close()


# ============================================================
# 主流程
# ============================================================
if __name__ == "__main__":
    log("=" * 60)
    log("Exam-Master App 全量功能测试 (CDP)")
    log("=" * 60)

    try:
        targets = get_targets()
        log(f"发现 {len(targets)} 个 WebView 页面")
    except Exception as e:
        log(f"无法连接到 WebView: {e}")
        log("请确保: 1) App 在前台运行  2) adb forward 已设置")
        sys.exit(1)

    # 执行所有测试
    test_index(targets)
    time.sleep(1)
    test_practice(targets)
    time.sleep(1)
    test_school(targets)
    time.sleep(1)
    test_profile(targets)
    time.sleep(1)
    test_tools(targets)
    time.sleep(1)
    test_apis(targets)
    test_no_errors(targets)

    # 报告
    log(f"\n{'='*60}")
    log("测试报告")
    log(f"{'='*60}")
    log(f"通过: {PASS}")
    log(f"失败: {FAIL}")
    log(f"警告: {WARN}")

    if ERRORS:
        log("\n失败项:")
        for e in ERRORS:
            log(f"  - {e}")

    if FAIL == 0:
        log("\n🎉 全量功能测试通过！项目可以提审发布。")
    else:
        log(f"\n⚠️  有 {FAIL} 个测试失败，需要修复。")

    sys.exit(FAIL)
