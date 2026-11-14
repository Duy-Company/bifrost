# Validation — Bifrost 1.0.1

Date: 2026-11-14. Source/build host: macOS Apple Silicon; native runtime checks: GitHub-hosted Windows x64.

Passed:

- TypeScript check and production Electron/React bundles.
- Three JPEG transport tests: every TCP split, bytewise marker fragmentation and bounded incomplete frames.
- Electron UI smoke test: English introduction only, native window controls, close-to-tray and reopening the same window.
- UxPlay cross-compiled from pinned source with embedded mDNS; all 148 packaged executable/DLL/plugin checksums and non-system PE imports verified.
- Windows runner launched the packaged Bifrost application. Its bundled AirPlay service returned `200` and a binary plist from `/info`.
- A separate Windows runner downloaded the public v1.0.1 ZIP, launched it, and observed the actual packaged updater check GitHub Releases and confirm that 1.0.1 is current.
- Installer size/SHA512, update blockmap and embedded GitHub provider validated by the release build.

Evidence:

- [Release build and Windows validation](https://github.com/Duy-Company/bifrost/actions/runs/43595782301).
- [Public updater check on Windows](https://github.com/Duy-Company/bifrost/actions/runs/43596301058).
- [Machine-readable result](https://github.com/Duy-Company/bifrost/releases/download/v1.0.1/windows-validation.json).

Still unverified:

- Physical Mac/iPhone/iPad discovery, pairing and actual AirPlay screen/audio transmission to Windows.
- Miracast / Smart View with real compatible Windows Wi-Fi/display hardware.
- Installing through the NSIS wizard and upgrading an older installed version to a newer version.

Boundaries:

- Miracast delegates to Windows Wireless Display, including its stream window and fullscreen behavior. The OS feature and compatible drivers must exist. No OS feature or projection-policy settings are silently changed.
- Google Cast/Chromecast is not implemented.
- The Windows installer is unsigned.
- Earlier USB/ADB emulator evidence is superseded and is not evidence for these wireless protocols.
