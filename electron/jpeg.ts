/** Extract complete JPEGs from a GStreamer jpegenc TCP sink, regardless of TCP chunking. */
export class JpegParser {
  private pending = Buffer.alloc(0)
  constructor(
    private frame: (data: Buffer) => void,
    private maxBytes = 24 * 1024 * 1024
  ) {}
  push(chunk: Buffer): void {
    this.pending = Buffer.concat([this.pending, chunk])
    for (;;) {
      const start = this.pending.indexOf(Buffer.from([0xff, 0xd8]))
      if (start < 0) {
        this.pending = this.pending.subarray(Math.max(0, this.pending.length - 1))
        return
      }
      if (start > 0) this.pending = this.pending.subarray(start)
      const end = this.pending.indexOf(Buffer.from([0xff, 0xd9]), 2)
      if (end < 0) {
        if (this.pending.length > this.maxBytes)
          throw new Error('Receiver frame exceeds the size limit.')
        return
      }
      if (end + 2 > this.maxBytes) throw new Error('Receiver frame exceeds the size limit.')
      this.frame(this.pending.subarray(0, end + 2))
      this.pending = this.pending.subarray(end + 2)
    }
  }
}
