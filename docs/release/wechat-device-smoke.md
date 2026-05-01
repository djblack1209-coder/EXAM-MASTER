# WeChat Device Smoke Evidence

Status: pending

## Build

- Build directory: `dist/build/mp-weixin`
- Build command: `npm run build:mp-weixin && npm run audit:wechat:artifacts`
- Mini Program AppID: configured in `dist/build/mp-weixin/project.config.json`
- DevTools version: `2.01.2510260`
- Base library version: `2.32.3`
- Build timestamp: `2026-04-30 15:39 MDT`
- CLI login status: passed (`/Applications/wechatwebdevtools.app/Contents/MacOS/cli islogin` returned `{"login":true}` at `2026-04-30 15:33 MDT`)
- CLI import/open status: passed (`/Applications/wechatwebdevtools.app/Contents/MacOS/cli open --project dist/build/mp-weixin`)
- DevTools visible project: `EXAM-MASTER - 微信开发者工具 Stable 2.01.2510260`
- DevTools problem counter: `0`
- Current simulator page: `pages/login/onboarding`
- Artifact checksums:
  - `app.json`: `4147bad56012ffae7893bd7e5a9b102d75821618b29d3fed717e7859359286a7`
  - `project.config.json`: `b879c34422e06bc9cfbf0418b2371d1199d76c7b7afa7f7ea212804b1fd202c0`
  - `sitemap.json`: `e950e426ac0dc2df54003450f91d483bd0871acb1315268133e62aede66214a7`
- Preview command: `/Applications/wechatwebdevtools.app/Contents/MacOS/cli preview --project /Users/blackdj/Desktop/EXAM-MASTER/dist/build/mp-weixin --qr-format image --qr-output output/wechat-preview/preview-20260430T213408Z.png --info-output output/wechat-preview/preview-info-20260430T213408Z.json`
- Preview status: passed
- Preview timestamp: `2026-04-30 15:34 MDT` (`2026-04-30T21:34:08Z`)
- Preview package size: total `2559016` bytes; main `808548` bytes; `/pages/login/` `907011` bytes; `/pages/mistake/` `75332` bytes; `/pages/practice-sub/` `728173` bytes; `/pages/settings/` `39952` bytes
- Preview QR archive location: `output/wechat-preview/preview-20260430T213408Z.png`
- Preview QR SHA-256: `ff1748e6b03dea0aca17f006ec122c6a6daf3bb117860dcc965e07908f5db274`
- Preview info archive location: `output/wechat-preview/preview-info-20260430T213408Z.json`
- Preview info SHA-256: `075ee2032d0fb8cb090306d417bed444b666873df50f2cc75fd01616c1fda395`
- Upload command: `/Applications/wechatwebdevtools.app/Contents/MacOS/cli upload --project /Users/blackdj/Desktop/EXAM-MASTER/dist/build/mp-weixin --version 2.2.0 --desc 'Exam-Master release candidate' --info-output output/wechat-upload/upload-info-retry.json`
- Upload status: passed
- Uploaded version: `2.2.0`
- Upload timestamp: `2026-04-30 15:34 MDT`
- Upload package size: total `2618466` bytes; main `834029` bytes; `/pages/login/` `907011` bytes; `/pages/mistake/` `75332` bytes; `/pages/practice-sub/` `762142` bytes; `/pages/settings/` `39952` bytes
- Upload info archive location: `output/wechat-upload/upload-info-retry.json`
- Upload info SHA-256: `18c28632b4d391b7b0f1a42c395acbdcf301ef10b477ecb13867733c8af8f943`

## Required Device Checks

- DevTools import completed without compile errors: passed in local DevTools import
- Preview QR generated: passed
- Uploaded candidate version: passed; WeChat backend has version `2.2.0` ready for user-side experience-version validation and submission
- Release-state validation build: pending; final device smoke must use the uploaded experience version or the approved release version, not only the DevTools preview QR
- Real device model and WeChat version:
- App launch succeeded:
- Login succeeded:
- Practice center opened:
- Knowledge map opened:
- Quiz flow completed:
- Result page opened:

## Evidence Location

- Screenshots or screen recording:
- Preview QR archive location: `output/wechat-preview/preview-20260430T213408Z.png`
- Tester:
- Test timestamp:

Preview QR evidence only proves the local build can be imported and rendered by DevTools. Mark this file `Status: passed` only after release-state device validation is recorded.

Do not paste QR credentials, access tokens, private user data, or production secrets here.
