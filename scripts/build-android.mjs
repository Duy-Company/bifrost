import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, copyFile, readdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve, join } from 'node:path'
const sdk = process.env.ANDROID_HOME || join(homedir(), 'Library/Android/sdk')
await writeFile('android-sender/local.properties', `sdk.dir=${sdk.replaceAll('\\', '\\\\')}\n`)
let gradle = process.env.BIFROST_GRADLE
if (!gradle) {
  const root = join(homedir(), '.gradle/wrapper/dists/gradle-8.13-bin')
  if (existsSync(root))
    for (const hash of await readdir(root)) {
      const candidate = join(root, hash, 'gradle-8.13/bin/gradle')
      if (existsSync(candidate)) gradle = candidate
    }
}
if (!gradle) gradle = resolve('android-sender/gradlew')
await mkdir('vendor/android-gradle', { recursive: true })
execFileSync(
  gradle,
  ['-p', 'android-sender', '-g', resolve('vendor/android-gradle'), '--no-daemon', 'assembleDebug'],
  { stdio: 'inherit', env: { ...process.env, ANDROID_HOME: sdk } }
)
await mkdir('dist/test', { recursive: true })
await copyFile(
  'android-sender/app/build/outputs/apk/debug/app-debug.apk',
  'dist/test/Bifrost-Sender-test.apk'
)
console.log('Built dist/test/Bifrost-Sender-test.apk')
