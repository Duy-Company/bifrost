# Validation — Bifrost 1.0.2

Date: 2026-11-14. The preceding `1.0.2-test.1` build passed [Windows and Android build CI](https://github.com/Duy-Company/bifrost/actions/runs/43606824627).

- TypeScript, production bundles and six transport/window-sizing tests passed.
- The compact English welcome window passed the Electron smoke check, including native window controls, no custom buttons, readable font sizes, no overflow and close-to-tray/reopen.
- Android MediaProjection/H.264 video reached the Electron decoder over a real WebSocket connection from an emulator. Home-screen changes and landscape frame dimensions were observed. The complete rotation/window/fullscreen automation was not completed; further long device tests were stopped at the user's request.
- Windows launched the packaged receiver; AirPlay `/info` returned 200 and a binary plist. All 148 bundled native files matched their hashes.
- The actual Windows GStreamer PNG pipeline produced 60 frames at both 1080p and 4K. Independently decoded RGB pixels matched the input exactly. A synthetic solid-color source encoded at 106.6 FPS (1080p) and 27.1 FPS (4K) on the CI runner. These are encoder-only measurements, not end-to-end AirPlay performance or a guarantee of 4K/60 FPS.
- Android APK builds passed locally and on Ubuntu CI. The APK is a test companion with video only and unencrypted LAN transport.
- User reports Mac/iPhone AirPlay working with version 1.0.1. The new quality path and physical OnePlus 8T/Redmagic 8 Pro LAN sharing remain unverified.

The release workflow repeats packaging, artifact/feed integrity and the Windows startup/AirPlay endpoint check. No further long device tests are required before this user-authorized release.

## Historical validation — 1.0.1

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
