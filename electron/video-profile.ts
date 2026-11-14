export interface VideoProfile {
  width: number
  height: number
  fps: number
  hevc: boolean
}
export function videoProfile(width: number, height: number): VideoProfile {
  const landscape = [Math.max(width, height), Math.min(width, height)]
  const w = Math.max(1920, landscape[0]),
    h = Math.max(1080, landscape[1])
  const scale = Math.min(1, 3840 / w, 2160 / h)
  const result = {
    width: Math.floor((w * scale) / 2) * 2,
    height: Math.floor((h * scale) / 2) * 2,
    fps: 60
  }
  return { ...result, hevc: result.width > 1920 || result.height > 1080 }
}
export function airplayArgs(name: string, port: number, profile: VideoProfile): string[] {
  return [
    '-n',
    name,
    '-nh',
    '-nofreeze',
    '-s',
    `${profile.width}x${profile.height}@60`,
    '-fps',
    String(profile.fps),
    ...(profile.hevc ? ['-h265'] : []),
    '-vs',
    `videoconvert ! video/x-raw,format=RGB ! pngenc compression-level=1 ! tcpclientsink host=127.0.0.1 port=${port} sync=false`,
    '-p',
    '7000'
  ]
}
