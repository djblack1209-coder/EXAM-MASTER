# Maestro Mobile Automation (Phase C Prepared)

## 目录

```text
tests/maestro/
├── flows/
│   ├── 00-smoke.yaml
│   ├── 01-login-input.yaml
│   ├── 02-core-practice.yaml
│   ├── 03-high-risk-tools.yaml
│   └── 04-state-recovery.yaml
└── README.md
```

## 一键安装（macOS）

```bash
bash scripts/test/setup-maestro-macos.sh
```

成功判定标准：

- `java -version` 正常输出
- `maestro --version` 正常输出

## 语法校验（无设备也可跑）

```bash
npm run test:maestro:syntax
```

成功判定标准：

- 所有 flow 输出 `OK`

## 环境预检（推荐先跑）

```bash
npm run test:maestro:preflight
```

成功判定标准：

- 生成 `docs/reports/maestro-preflight.md`
- 能看到设备连接状态与第三方包数量

## 真机/模拟器执行

```bash
APP_ID="your.real.app.id" \
E2E_EMAIL="qa@example.com" \
E2E_PASSWORD="your-password" \
npm run test:maestro
```

或使用 APK 自动安装并自动解析包名：

```bash
ANDROID_APK_PATH="artifacts/android/exam-master-debug.apk" \
MAESTRO_REQUIRE_NATIVE=1 \
npm run test:maestro
```

也可以直接执行 native 严格模式脚本：

```bash
APP_ID="your.real.app.id" npm run test:maestro:native
```

说明：

- 若未提供 `APP_ID`，脚本会先尝试从设备已安装第三方应用中自动识别（关键词：`exam/master/kaoyan/uni`）。
- 若提供 `ANDROID_APK_PATH`，脚本会优先尝试从 APK 元数据解析 `APP_ID`，并自动执行 `adb install -r`。
- 若未提供 `ANDROID_APK_PATH`，脚本会自动扫描常见路径（`artifacts/android/*.apk`、`dist/build/app/*.apk`、`unpackage/*.apk`）。
- 若未提供 `APP_ID`，`npm run test:maestro` 会自动降级执行 Android H5 回归（`10-web-h5-smoke`）。
- 若你希望强制 native 套件（缺少 `APP_ID` 直接失败），可设置：`MAESTRO_REQUIRE_NATIVE=1`。
- 若未提供 `APP_ID` 且未连接 Android 设备/模拟器，脚本默认生成 `skipped` 报告并返回成功；可通过 `MAESTRO_REQUIRE_DEVICE=1` 强制失败。

可选环境变量：

- `ANDROID_APK_PATH`：待安装 APK 路径
- `MAESTRO_AUTO_INSTALL_APK`：是否自动安装 APK，默认 `1`
- `MAESTRO_REQUIRE_NATIVE`：强制 native 门禁，默认 `0`
- `MAESTRO_REQUIRE_DEVICE`：无设备是否失败，默认 `0`
- `JAVA_TOOL_OPTIONS`：JVM 启动参数；脚本默认追加 `--enable-native-access=ALL-UNNAMED --sun-misc-unsafe-memory-access=allow`

成功判定标准：

- 生成 `docs/reports/maestro-results.xml`
- 生成 `test-results/maestro/` 下截图与日志

## Android 模拟器 H5 回归（无需 APP_ID）

```bash
npm run test:maestro:web:h5
```

可选环境变量：

- `BASE_URL`（默认 `http://10.0.2.2:5173`）
- `H5_HOST`（默认 `0.0.0.0`）
- `H5_PORT`（默认 `5173`）
- `MAESTRO_WEB_REPORT_FILE`（默认 `docs/reports/maestro-web-smoke.xml`）
- `MAESTRO_WEB_RESULT_DIR`（默认 `test-results/maestro-web`）

成功判定标准：

- 生成 `docs/reports/maestro-web-smoke.xml`
- 生成 `test-results/maestro-web/` 下截图与日志

## 常见阻塞

- iOS：未安装完整 Xcode，报 `xcodebuild requires Xcode`
- Android：未配置 `ANDROID_HOME`/`ANDROID_SDK_ROOT`
- 无设备：报 `You have 0 devices connected`

## Native 前置检查（推荐）

```bash
adb devices -l
adb shell pm list packages -3
```

判定建议：

- 第一条命令必须看到目标设备为 `device`
- 第二条命令至少应出现你的业务包名（例如 `package:com.exam.master`）
