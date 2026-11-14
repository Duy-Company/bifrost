import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
if (process.platform !== 'darwin')
  throw new Error(
    'This cross-build recipe targets Windows x64 from macOS. The prepared runtime can be packaged on Windows directly.'
  )
const run = (command, args, env = process.env) =>
  execFileSync(command, args, { stdio: 'inherit', env })
if (!existsSync('vendor/build-python/bin/cmake')) {
  run('python3', ['-m', 'venv', 'vendor/build-python'])
  run('vendor/build-python/bin/pip', ['install', 'cmake==4.4.4'])
}
run('node', ['scripts/download-receiver-build.mjs'])
run('python3', ['scripts/patch-uxplay.py'])
const env = {
  ...process.env,
  PKG_CONFIG_LIBDIR: `${resolve('vendor/sysroot/ucrt64/lib/pkgconfig')}:${resolve('vendor/sysroot/ucrt64/share/pkgconfig')}`,
  PKG_CONFIG_SYSROOT_DIR: resolve('vendor/sysroot')
}
run(
  'vendor/build-python/bin/cmake',
  [
    '-S',
    'vendor/uxplay',
    '-B',
    'vendor/uxplay-build',
    `-DCMAKE_TOOLCHAIN_FILE=${resolve('scripts/windows-toolchain.cmake')}`,
    '-DCMAKE_BUILD_TYPE=Release',
    '-DNO_MARCH_NATIVE=ON',
    '-DUSE_MDNS=ON',
    `-DPKG_CONFIG_EXECUTABLE=${execFileSync('which', ['pkg-config'], { encoding: 'utf8' }).trim()}`,
    `-DOPENSSL_ROOT_DIR=${resolve('vendor/sysroot/ucrt64')}`
  ],
  env
)
run('vendor/build-python/bin/cmake', ['--build', 'vendor/uxplay-build', '-j', '6'])
run('node', ['scripts/assemble-receiver.mjs'])
run('node', ['scripts/check-runtime.mjs'])
