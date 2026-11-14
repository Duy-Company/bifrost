import tarfile, json, os
for package in json.load(open('vendor/msys-packages.json')):
    with tarfile.open('vendor/packages/' + package['FILENAME'][0], 'r:zst') as archive:
        members = []
        for member in archive:
            name = member.name
            if not (name.startswith(('ucrt64/include/', 'ucrt64/lib/', 'ucrt64/share/licenses/')) or (name.startswith('ucrt64/bin/') and name.endswith('.dll'))): continue
            target = 'vendor/sysroot/' + name
            if os.path.exists(target) and not os.path.islink(target): os.chmod(target, 0o755 if os.path.isdir(target) else 0o644)
            members.append(member)
        archive.extractall('vendor/sysroot', members=members, filter='data')
