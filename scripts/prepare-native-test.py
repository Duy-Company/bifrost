import json, os, tarfile
os.makedirs('artifacts/native-test', exist_ok=True)
for package in json.load(open('vendor/msys-packages.json')):
    if package['NAME'][0] not in ('mingw-w64-ucrt-x86_64-gstreamer', 'mingw-w64-ucrt-x86_64-gst-plugins-base'):
        continue
    with tarfile.open('vendor/packages/' + package['FILENAME'][0], 'r:zst') as archive:
        for name in ('ucrt64/bin/gst-launch-1.0.exe', 'ucrt64/lib/gstreamer-1.0/libgstvideotestsrc.dll'):
            try:
                member = archive.getmember(name)
            except KeyError:
                continue
            with open('artifacts/native-test/' + os.path.basename(name), 'wb') as output:
                output.write(archive.extractfile(member).read())
