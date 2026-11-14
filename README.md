# Bifrost

A quiet, tray-based wireless screen receiver for Windows. Electron, TypeScript and React, with a white and ice-blue interface and a faceted lightning mark.

The main window is an introduction only. Closing it keeps the receiver running in the system tray. AirPlay sessions open a separate native-framed stream window with minimize, maximize, close and a full-screen button (F11 / Esc). There are no onboarding flows, device setup screens, USB tools or tutorials in the application.

[Download Windows v1.0.1](https://github.com/Duy-Company/bifrost/releases/tag/v1.0.1)

## Receiver architecture

- **AirPlay:** a bundled UxPlay native Windows engine advertises Bifrost on the local network, handles AirPlay authentication/decryption and audio, and sends decoded JPEG frames through a loopback-only TCP sink. Electron opens the stream window on the first actual video frame. Closing the stream restarts the AirPlay receiver, ending the sender session.
- **Miracast / compatible Smart View:** Windows Wireless Display owns Wi-Fi Direct discovery, negotiation and the native stream window. Bifrost starts that OS receiver, minimizes its idle window and restores it for an incoming stream. Windows must already have Wireless Display and compatible Wi-Fi/display drivers. Unsupported, policy-disabled or unavailable states are reported truthfully. This path cannot be exercised on macOS.
- **Google Cast:** not implemented. Android Cast menus backed exclusively by Google Cast (including Pixel devices) are not interchangeable with Miracast and will not discover this receiver.
- **Privacy:** no cloud relay, telemetry or account. Incoming local-network AirPlay connections are intentional. Native Windows permissions and firewall policy still apply.

## Build

`npm ci`, `npm run build`, `npm run dist:win`. Windows x64 packaging requires the prepared native runtime in `resources/receiver`. The cross-build scripts download pinned UxPlay source and MSYS2 packages, verify package hashes, and compile the engine using LLVM-MinGW. Native engine source/license notices are shipped alongside the runtime. See `VALIDATION.md` for what was actually run.

## Source

- `electron/receiver.ts`: automatic service startup, GStreamer transport, status and cleanup.
- `electron/main/index.ts`: tray lifecycle, welcome window and separate stream window.
- `native/windows/miracast.ps1`: Windows Wireless Display adapter; never changes projection permission or OS feature policy.
- `renderer/`: English welcome screen and minimal video surface.
- `electron/jpeg.ts`: bounded stream parser with fragmentation tests.
- `scripts/`: native cross-build and packaging helpers.

## Dependencies

[UxPlay](https://github.com/FDH2/UxPlay) is GPL-3.0-or-later; it is shipped as a separate executable with its corresponding source. GStreamer, FFmpeg and their dependencies carry their own licenses. Bifrost's Electron application source is MIT. Third-party source and license locations are documented in `resources/receiver/THIRD_PARTY_NOTICES.md`.

Miracast requirements and states follow [Microsoft Wireless Display](https://support.microsoft.com/en-us/windows/hardware/display-graphics/screen-mirroring-and-projecting-to-your-pc-or-wireless-display) and [MiracastReceiverStatus](https://learn.microsoft.com/en-us/uwp/api/windows.media.miracast.miracastreceiverstatus).

## Updates and releases

Installed Windows builds check the public `Duy-Company/bifrost` GitHub Releases feed 15 seconds after startup and every six hours. The tray includes **Check for updates** and, after a download, **Restart to update**. Updates never interrupt an active stream automatically; installation occurs when the user restarts or quits. No GitHub token is embedded in the app.

A `v*` tag runs the Windows release workflow: build the native engine from pinned source, package the app/update feed, verify installer hashes, start the packaged application on a Windows runner and probe its AirPlay `/info` endpoint, then publish the installer, ZIP, blockmap and `latest.yml`. Physical sender and Miracast hardware tests remain separate.
