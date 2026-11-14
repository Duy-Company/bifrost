# Native receiver distribution

Bifrost launches UxPlay as a separate process. UxPlay is licensed under GPL-3.0-or-later. The exact upstream commit and MSYS2 package checksums are recorded in `build-manifest.json`. Corresponding UxPlay source is included in `source/uxplay.tar.gz`; the upstream license is included as `UXPLAY-LICENSE`.

GStreamer, FFmpeg, OpenSSL, libplist, GLib and their DLL dependencies are obtained from the official MSYS2 UCRT64 repository. Package license files are copied to `licenses/`. MSYS2 package source recipes and source URLs are available at https://github.com/msys2/MINGW-packages, with the package names/versions in the build manifest.

No third-party GUI application is used. Only the UxPlay executable, its DLL dependencies and selected GStreamer plugins are included in Bifrost's runtime.
