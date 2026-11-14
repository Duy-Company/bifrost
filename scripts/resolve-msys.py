import os, json, re
packages = {}; providers = {}
for entry in os.scandir('vendor/msys-db'):
    path = entry.path + '/desc'
    if not os.path.isfile(path): continue
    data = {}; key = ''
    for line in open(path):
        line = line.strip()
        if line.startswith('%'): key = line.strip('%'); data[key] = []
        elif line: data[key].append(line)
    if 'NAME' not in data: continue
    packages[data['NAME'][0]] = data
    for value in data.get('PROVIDES', []): providers[re.split('[<>=]', value)[0]] = data['NAME'][0]
seen = {}; missing = set()
def visit(name):
    name = re.split('[<>=]', name)[0]
    if name not in packages: name = providers.get(name, name)
    if name in seen: return
    if name not in packages: missing.add(name); return
    data = packages[name]; seen[name] = data
    for dep in data.get('DEPENDS', []): visit(dep)
for name in ['gstreamer', 'gst-plugins-base', 'gst-plugins-good', 'gst-libav', 'libplist', 'openssl']:
    visit('mingw-w64-ucrt-x86_64-' + name)
# Only parser DLLs are used from the bad plugin family; no other bad plugin dependencies.
for name in ['mingw-w64-ucrt-x86_64-gst-plugins-bad', 'mingw-w64-ucrt-x86_64-gst-plugins-bad-libs']: seen[name] = packages[name]
if missing: raise SystemExit('Missing package providers: ' + ', '.join(missing))
manifest = [{key: value for key, value in data.items() if key in ['NAME','FILENAME','SHA256SUM','CSIZE']} for data in seen.values()]
json.dump(manifest, open('vendor/msys-packages.json','w'), indent=2)
print(str(len(manifest)) + ' packages, ' + str(sum(int(p['CSIZE'][0]) for p in manifest)//1024//1024) + ' MiB, all dependencies resolved')
