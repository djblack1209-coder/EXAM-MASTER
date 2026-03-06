# Maestro Device Preflight (r10)

## Environment

- Device: `emulator-5554`
- Source: `adb devices -l`

## Device Check

```text
List of devices attached
emulator-5554          device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:1
```

## Package Check

- Command: `adb shell pm list packages -3`
- Result: no output (no third-party packages installed)

## Conclusion

- Current emulator does not contain installable Exam-Master native app package.
- Native Maestro cannot be fully executed in this environment yet.
- `npm run test:maestro` therefore uses H5 fallback and still produces JUnit report (`docs/reports/maestro-results.xml`).

## Automation

- This preflight is now automated via `npm run test:maestro:preflight`.
- Latest auto-generated output path: `docs/reports/maestro-preflight.md`.
