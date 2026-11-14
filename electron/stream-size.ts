export function fitStream(
  width: number,
  height: number,
  availableWidth: number,
  availableHeight: number,
  displayScale: number
) {
  const scale = Math.min(1 / displayScale, availableWidth / width, availableHeight / height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}
