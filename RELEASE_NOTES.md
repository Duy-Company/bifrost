Bifrost 1.0.2 improves the receiver window and adds an Android LAN companion.

- Smaller welcome window with larger, clearer text.
- Device discovery uses the computer hostname without a Bifrost prefix.
- Stream windows follow the incoming video dimensions and orientation, fitting within the monitor's work area while preserving the device aspect ratio.
- Removed custom minimize and fullscreen buttons. Native window controls remain; F11 / Esc controls true fullscreen.
- AirPlay now requests the primary display's physical resolution, bounded from 1080p to 4K, and a 60 FPS ceiling. Lossless PNG replaces the additional JPEG encoding step. Actual sender resolution, frame rate and source compression still vary; 4K/60 FPS is not guaranteed.
- Added **Bifrost-Sender-test.apk**: an Android screen-sharing companion for a shared LAN, including Android on Wi-Fi and Windows on Ethernet. It finds computers automatically and includes a receiver-address fallback. The Windows tray can copy that address.
- Existing automatic update checks remain enabled.

The Android APK is a test companion, shares video only, and uses an unencrypted local transport on a trusted LAN. It is not a Miracast or Google Cast implementation. Native Miracast requires Windows Wireless Display plus compatible Wi-Fi Direct hardware/drivers even when the PC uses Ethernet. Google Cast/Chromecast remains unsupported.

Windows x64; unsigned installer. Automated Windows startup, AirPlay service and synthetic lossless PNG checks passed for the preceding test build. Mac/iPhone AirPlay worked on 1.0.1 according to user testing; the new AirPlay quality path and physical OnePlus 8T/Redmagic 8 Pro sessions still need user verification.
