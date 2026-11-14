const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
/** PNG chunks are length delimited; do not scan compressed image data for IEND bytes. */
export class PngParser {
  private queue: Buffer[] = []
  private available = 0
  private parts: Buffer[] = []
  private size = 0
  private payload = -1
  private end = false
  constructor(
    private frame: (data: Buffer) => void,
    private limit = 64 * 1024 * 1024
  ) {}
  private take(count: number): Buffer {
    const parts: Buffer[] = []
    let remaining = count
    while (remaining) {
      const chunk = this.queue[0]
      const length = Math.min(remaining, chunk.length)
      parts.push(chunk.subarray(0, length))
      if (length === chunk.length) this.queue.shift()
      else this.queue[0] = chunk.subarray(length)
      remaining -= length
    }
    this.available -= count
    return parts.length === 1 ? parts[0] : Buffer.concat(parts, count)
  }
  push(chunk: Buffer): void {
    if (!chunk.length) return
    this.queue.push(chunk)
    this.available += chunk.length
    for (;;) {
      if (!this.size) {
        if (this.available < 8) return
        const header = this.take(8)
        if (!header.equals(signature)) throw new Error('Invalid PNG stream signature.')
        this.parts = [header]
        this.size = 8
      }
      if (this.payload < 0) {
        if (this.available < 8) return
        const header = this.take(8)
        const length = header.readUInt32BE(0)
        if (length + this.size + 12 > this.limit)
          throw new Error('Receiver frame exceeds the size limit.')
        const type = header.toString('ascii', 4, 8)
        if (this.parts.length === 1 && (type !== 'IHDR' || length !== 13))
          throw new Error('PNG has no valid IHDR.')
        if (type === 'IEND' && length !== 0) throw new Error('Invalid PNG IEND.')
        this.parts.push(header)
        this.size += 8
        this.payload = length + 4
        this.end = type === 'IEND'
      }
      if (this.available < this.payload) return
      const body = this.take(this.payload)
      if (this.parts.length === 2) {
        const width = body.readUInt32BE(0),
          height = body.readUInt32BE(4)
        if (!width || !height || width > 4096 || height > 4096)
          throw new Error('Unsupported PNG frame dimensions.')
      }
      this.parts.push(body)
      this.size += body.length
      this.payload = -1
      if (this.end) {
        const frame = Buffer.concat(this.parts, this.size)
        this.parts = []
        this.size = 0
        this.frame(frame)
      }
    }
  }
}
