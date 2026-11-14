# Validation — Bifrost Windows receiver

Date: 2026-11-14. Build host: macOS Apple Silicon.

Passed:

- TypeScript check and production Electron/React bundles.
- Three JPEG transport tests, including every possible TCP split, bytewise input, marker fragmentation and bounded incomplete frames.
- Electron UI smoke test: English-only introductory screen, no USB/setup/tutorial screens, native minimize/maximize/fullscreen capability, close-to-tray and reopening the same window.
- Honest unsupported-platform state on macOS; the UI does not report a running Windows receiver on the build host.
- UxPlay cross-compiled to PE32+ Windows x86-64 with embedded mDNS. The source commit and build dependency checksums are pinned.
- All 147 packaged executable/DLL/plugin files passed checksum validation; their non-system PE imports resolve inside the receiver bundle.

Not verified here:

- Running the Windows executable, Windows Firewall behavior or Windows installer behavior.
- Discovery and actual AirPlay streaming from a physical Mac/iPhone/iPad to a Windows host.
- Windows Wireless Display activation, supported-driver negotiation, Smart View/Miracast discovery and native streaming on Windows hardware.

The earlier USB/ADB implementation and its Android emulator test are superseded by this receiver architecture. Those results are not evidence that the wireless protocols work on Windows.

Known boundaries:

- Miracast is delegated to Windows Wireless Display, including its stream window and fullscreen behavior. The OS feature and compatible Wi-Fi/display drivers must exist. Bifrost reports unavailable if the OS cannot listen; it does not install features or change system projection policy.
- Google Cast/Chromecast is not implemented. Android menus that only support Google Cast are not compatible with Miracast.
- The Windows build is unsigned; no public release or notarization/signing service was used.
