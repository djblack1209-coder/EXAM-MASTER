# App 受保护原生连接器

App 文件链路见下方 `wenli-app-file-v1` 合同；页面入口已接，缺已装配保护模块仍安全拒绝。本批证据在 `tmp/app-material-delivery/delivery-report.json`。

目前实现的是插件源码与宿主入口，未携带编译后的移动插件，未修改 `src/manifest.json` 装配它。缺模块或合同不符时在发送令牌前拒绝。`npm run build:app` 的前端产物不能证明插件装配、Android/iOS 运行或设备可达。

## 能力与边界

宿主 `src/services/learning/app-connector.js` 只加载 `Wenli-Connector`，要求 `wenli-app-connector-v1`、拒绝重定向、字节上限、严格 UTF-8、系统 TLS、取消全部匹配。原服务保留明确目标、令牌、逐次授权；不回退 fetch、uni.request、其他供应商或平台消费。

Android 用 HttpURLConnection，iOS 用 NSURLSession，独立校验精确 origin、固定 `/health`、`/chat`、`/parse`、`/delete` 与 GET/POST；拒绝 URL 用户名、查询、片段和未知路径。令牌只在请求内存，固定来源 `https://wenli-app.invalid` 不是目标地址或认证；连接器须显式允许此精确来源，不扩大通配、SSRF、Bearer、资料许可、预算或幂等。

3xx 或 Location 拒绝；原生响应最多 2,000,000 字节、硬时限最多 35 秒、正文最多 15 MiB，业务继续用原服务更小上限。Java 活动任务/等待队列各最多四项，Foundation 活动任务最多四项；取消/关闭只回调一次，迟到不落事实。Android 不修改全局 CookieHandler、代理、TLS 信任，iOS 使用无 Cookie/cache 临时会话；系统 TLS 保持，测试证书不安装。

已接文本、健康、已有原件续解析及匹配删除；本批加入系统文件选择和确认后的有界读取源码及页面入口。Apple OCR、模型页图输入、流式和真机仍未通过。逐次共享、账户/连接变化、原件删除沿原合同。手机 localhost 不是桌面，HTTPS、ATS/Android 网络策略、合法网关及可达性须设备验收。

## 移动 SDK 编译

源码/元数据在 `nativeplugins/Wenli-Connector/`，对应 [DCloud Android](https://nativesupport.dcloud.net.cn/NativePlugin/course/android.html)、[iOS 模块](https://nativesupport.dcloud.net.cn/NativePlugin/course/ios.html)和[打包规范](https://nativesupport.dcloud.net.cn/NativePlugin/course/package.html)。不以模拟 SDK 声明或空二进制替代编译。

`npm run build:app:connector` 默认要求两平台实际 SDK；单平台追加 `-- --android` 或 `-- --ios`。只本地编译，不下载、云打包、安装、部署或修改 App 配置。缺 SDK 退出 2，无二进制；失败清理本次目录，成功保留唯一 `tmp/app-connector-packages/build-*/Wenli-Connector/` 和 SDK 哈希报告，不覆盖旧包。

- Android：`WENLI_ANDROID_JAVA_HOME` 指向实际 JDK，`WENLI_ANDROID_SDK_CLASSPATH` 用系统路径分隔符列出 android.jar、官方 DCloud 模块 SDK 和 FastJSON 等实际依赖。完整适配器按 Java 8 字节码编译为 jar。
- iOS：`WENLI_IOS_SDK_INCLUDE_PATHS` 列出官方 `DCUniModule.h` 与依赖头目录，`WENLI_IOS_SDK_FRAMEWORK_PATHS` 可列实际 framework 目录。要求 `xcrun --sdk iphoneos` 成功，完整模块/内核编译为 arm64/iOS 11 静态库。

编译后仍须审查二进制/许可，依官方流程装配本地插件、自定义基座，再做独立设备业务验收。当前未执行装配、云打包或生产动作，缺模块继续拒绝。

本机已有Android SDK33/36。额外用SDK33的android.jar及官方Build Tools34 core-lambda-stubs.jar编译纯网络内核，再用已有Build Tools36 D8生成min-api21的dex，均通过；报告在tmp/app-connector-delivery/android-core-sdk-report.json，记录SDK/支持库/D8/dex哈希，临时产物清理。只拿android.jar编译缺Java8 lambda编译支持；旧D8 34处理当前JDK产物遇内部错误，改用已经安装的36通过，无下载/升级操作。此项不证明API21设备兼容或DCloud完整模块/插件装配，DCloud/iOS缺口仍保留。

## 本机验证

`npm run test:app:connector` 在 macOS 用实际 JDK/Foundation 编译内核和 CLI，启动随机回环 HTTP/HTTPS。合成令牌仅内存，自签密钥仅忽略临时目录；结束关闭服务/子进程、移除密钥/二进制。报告及源码哈希在 `tmp/app-connector-validation/latest.json`。

默认使用本机Homebrew JDK；其他实际JDK可通过`WENLI_TEST_JAVA_HOME`指定。移动SDK编译变量与本机内核验证变量分别设置，不以本机头/字节码代替移动SDK。

覆盖鉴权、四路径、中文/emoji 字节、3xx/Location、声明/分块容量、非法 UTF-8、非成功状态、非法目标/授权/容量/时限、超时/迟到、取消、重复 ID、四任务上限、关闭及系统 TLS 拒绝自签；重定向目标、自签服务零 HTTP 到达。不调用模型、OCR、支付或真实后端。

OpenJDK 过滤 Origin（[官方实现](https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/sun/net/www/protocol/http/HttpURLConnection.java)），故只在独立合成测试 JVM 使用 `-Dsun.net.http.allowRestrictedHeaders=true` 允许内核固定 Origin，不改变 App、主进程、重定向、认证或 TLS。此条件不证明 Android 实际 HTTP/来源；Foundation 同样不等于 iOS SDK/真机。JS 专项使用合成模块回调，不冒充 DCloud 桥。

## 系统文件与逐次确认

文件宿主 `src/services/learning/app-material.js` 要求 `getCapabilities().file` 完整匹配：`wenli-app-file-v1`、system 选择、after_consent 读取、ephemeral 句柄、10 MiB、boundedRead 与 cancel。另须具备 chooseMaterialFile/readMaterialFile/releaseMaterialFile/cancelFileOperation，缺项在选择/读取前拒绝。新页面同样开放 App 的模型和资料连接控件，仍不自动配置或回退云端。

Android 使用 ACTION_OPEN_DOCUMENT/只读临时 content URI、ContentResolver/CancellationSignal；iOS 使用 UIDocumentPicker/NSFileCoordinator，并在动作内平衡安全作用域。系统选择只读取名称/大小/修改时间元信息，回到 JS 仅给不可猜测的临时句柄、名称、大小。JS 无任意路径/URL读取入口，不取持久权限、不复制原件、不存书签。平台参考：[Android 文档访问](https://developer.android.com/training/data-storage/shared/documents-files)、[Apple 文件选择器](https://developer.apple.com/documentation/uikit/uidocumentpickerviewcontroller)。系统/文件提供者可能在选择时下载所选云文件；“未读取正文”指本应用尚未打开字节流，不能保证系统选择零网络。

用户选择后查看元信息，再确认当前解析器 origin、文件及 OCR 许可，才打开正文并向已授权目标发送。页面隐藏仍清空模型/资料令牌和授权；系统选择阶段只允许同账户/同记录生命周期的迟到元信息返回，不保留连接凭据。返回时连接已清除须重授权；隐藏、卸载、换账户、同账户清除/恢复记录、取消、连接身份或令牌变化拒绝读取/上传。普通作答不使所选文件失效。

内核最多保留两个句柄、十分钟惰性过期；一次读取后消费/释放，最多一个活动文件任务。Java 等待队列一项、取消清理二线程/四项队列；Foundation 工作单线程、清理最多二并发并有入队上限。元信息前后核对，真实读取最多已选大小加一个检测字节，总上限10 MiB；拒绝增长、截短、修改、危险名称/方向字符和无效编码。未给修改时间的 Android 提供者只核对可取得元信息；同名/同大小/同时间内容变化不保证可检测，本合同不是不可变快照或内容真实性证明。读取硬时限十秒；JS 选择等待最多120秒、读取最多15秒，取消/超时只采纳一次回执。阻塞提供者的物理关闭和系统界面退出仍须设备验收。

读取成功交给原私人解析 Service/Store，继续页数预算、来源/角色、提取版本、幂等及删除回执，不据文件名或模型文本升级公共答案。句柄/URI/书签、Base64和连接凭据不写学习事件、同步或导出。失败/取消不新增资料；真实解析成功后才展示已保存。

## 文件内核实测

`npm run test:app:material` 在唯一忽略目录用真实 JDK 和 macOS Foundation 编译/运行，57项通过（Java29、Foundation28）：元信息/未许可零打开、严格许可、实际文件和二进制Base64、类型/危险名/大小/两句柄、变化/短流/低报大小检测、重复ID/忙碌、取消/十秒超时/释放/关闭一次回调。Foundation 使用真实 NSFileCoordinator 与注册 FilePresenter 延迟放行；Java 使用真实临时文件与阻塞管道。结束清理合成文件、二进制和子进程，报告及源码哈希在 `tmp/app-material-validation/latest.json`，不调用网络或模型。

实际 Android SDK33/官方 lambda 编译支持和已有 D8 36 已编译网络/文件内核及 ContentResolver 源、生成 min-api21 dex，报告在 `tmp/app-material-delivery/android-core-sdk-report.json`。SDK打包已包含新文件，iOS元数据加入UIKit；完整 DCloud classpath/iPhoneOS SDK仍缺失，build-only退出2，未装配插件。JS页面/Store使用合成模块回调；H5实际两页PDF经Python/Poppler验证取消、确认、片段/页图与刷新。以上分别成立，均不能代替 Android/iOS系统选择器、移动安全作用域、生命周期、网络与真机验收。
