# Bifrost

A quiet, tray-based wireless screen receiver for Windows. Electron, TypeScript and React, with a white and ice-blue interface and a faceted lightning mark.

The main window is an introduction only. Closing it keeps the receiver running in the system tray. AirPlay and Android LAN sessions open a separate native-framed stream window with OS minimize, maximize and close buttons. F11 / Esc enters and leaves true fullscreen. There are no custom caption or fullscreen buttons or tutorials in the application.

[Download Windows v1.0.2 and Android companion](https://github.com/Duy-Company/bifrost/releases/tag/v1.0.2)

## Receiver architecture

- **Device name:** the computer hostname, without a Bifrost prefix, for both AirPlay and Android LAN discovery.
- **AirPlay:** a bundled UxPlay native Windows engine handles AirPlay authentication/decryption and audio, and sends decoded lossless PNG frames through a loopback-only TCP sink. The requested profile follows physical primary-monitor pixels (1080p minimum, 4K maximum), with a 60 FPS ceiling and HEVC enabled above 1080p. The sender can negotiate lower resolution or frame rate; PNG does not undo compression in the source video. Electron opens the stream window on the first actual video frame. Closing the stream restarts the AirPlay receiver, ending the sender session.
- **Android LAN:** the included Android companion uses MediaProjection and the device H.264 encoder over a direct local WebSocket connection. Android Wi-Fi and Windows Ethernet can share the same IP network. Discovery uses `_bifrost._tcp`; a manual receiver address is available if multicast discovery is blocked. The tray can copy receiver addresses. This test sender shares video only, at up to 2560 pixels on the long edge / 60 FPS / 24 Mbps, subject to encoder and network capacity. It does not add Google Cast support to Android's system Cast menu.
- **Miracast / compatible Smart View:** Windows Wireless Display owns Wi-Fi Direct discovery, negotiation and the native stream window. Bifrost starts that OS receiver, minimizes its idle window and restores it for an incoming stream. Windows must already have Wireless Display and compatible Wi-Fi/display drivers. Unsupported, policy-disabled or unavailable states are reported truthfully. This path cannot be exercised on macOS.
- **Google Cast:** not implemented. Android Cast menus backed exclusively by Google Cast (including Pixel devices) are not interchangeable with Miracast and will not discover this receiver.
- **Privacy:** no cloud relay, telemetry or account. Native Windows permissions and firewall policy still apply. The test Android LAN transport is unencrypted and accepts one sender from the local network; use a trusted LAN. Android requires its standard screen-sharing consent and displays a foreground notification with Stop.

## Build

`npm ci`, `npm run build`, `npm run dist:win`. Windows x64 packaging requires the prepared native runtime in `resources/receiver`. The cross-build scripts download pinned UxPlay source and MSYS2 packages, verify package hashes, and compile the engine using LLVM-MinGW. Native engine source/license notices are shipped alongside the runtime. See `VALIDATION.md` for what was actually run.

## Source

- `electron/receiver.ts`: automatic service startup, GStreamer transport, status and cleanup.
- `electron/main/index.ts`: tray lifecycle, welcome window and separate stream window.
- `native/windows/miracast.ps1`: Windows Wireless Display adapter; never changes projection permission or OS feature policy.
- `renderer/`: English welcome screen and minimal video surface.
- `electron/png.ts`: bounded lossless image stream parser with fragmentation tests.
- `electron/lan.ts`: local discovery, sender handshake and encoded video transport.
- `android-sender/`: native Android screen sender.
- `scripts/`: native cross-build and packaging helpers.

## Dependencies

[UxPlay](https://github.com/FDH2/UxPlay) is GPL-3.0-or-later; it is shipped as a separate executable with its corresponding source. GStreamer, FFmpeg and their dependencies carry their own licenses. Bifrost's Electron application source is MIT. Third-party source and license locations are documented in `resources/receiver/THIRD_PARTY_NOTICES.md`.

Miracast requirements and states follow [Microsoft Wireless Display](https://support.microsoft.com/en-us/windows/hardware/display-graphics/screen-mirroring-and-projecting-to-your-pc-or-wireless-display) and [MiracastReceiverStatus](https://learn.microsoft.com/en-us/uwp/api/windows.media.miracast.miracastreceiverstatus).

## Updates and releases

Installed Windows builds check the public `Duy-Company/bifrost` GitHub Releases feed 15 seconds after startup and every six hours. The tray includes **Check for updates** and, after a download, **Restart to update**. Updates never interrupt an active stream automatically; installation occurs when the user restarts or quits. No GitHub token is embedded in the app.

A `v*` tag runs the Windows release workflow: build the native engine from pinned source, package the app/update feed, verify installer hashes, start the packaged application on a Windows runner and probe its AirPlay `/info` endpoint, then publish the installer, ZIP, blockmap and `latest.yml`. Physical sender and Miracast hardware tests remain separate.

Version **1.0.2** includes the Android test companion APK. Build it with `node scripts/build-android.mjs` (Android SDK and Java 17 required; the Gradle wrapper downloads Gradle 8.13 if no local installation is available). The `Test builds (no release)` workflow has read-only repository permissions and only uploads CI artifacts. `node scripts/test-android.mjs` exercises an authorized local Android emulator and Electron together.
