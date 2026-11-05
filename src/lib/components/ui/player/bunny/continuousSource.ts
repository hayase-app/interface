import { CustomSource } from 'mediabunny'

class Connection {
  url: string
  ctrl?: AbortController
  reader?: ReadableStreamDefaultReader<Uint8Array>
  position = 0
  leftover: Uint8Array = new Uint8Array(0)
  queue: Promise<unknown> = Promise.resolve()
  // The position after all queued reads. A read that starts here continues this response
  end = -1
  lastUse = 0

  constructor (url: string) {
    this.url = url
  }

  async open (start: number) {
    this.ctrl?.abort()
    const ctrl = this.ctrl = new AbortController()
    this.reader = undefined
    // Use the header and not `cache: 'no-store'`. With that fetch option, Chromium ignores backpressure and
    // does not pause the response: https://issues.chromium.org/issues/40415395
    const res = await fetch(this.url, {
      headers: { Range: `bytes=${start}-`, 'Cache-Control': 'no-store' },
      signal: ctrl.signal
    })
    if (res.status !== 206 || !res.body) {
      ctrl.abort()
      throw new Error(`The server did not send a range response for ${this.url}: ${res.status} ${res.statusText}`)
    }
    // A cross-origin response hides Content-Range if the server does not expose it
    const range = /\/(\d+)$/.exec(res.headers.get('Content-Range') ?? '')?.[1]
    const length = res.headers.get('Content-Length')
    const size = range ? Number(range) : length ? start + Number(length) : NaN
    if (!Number.isInteger(size)) {
      ctrl.abort()
      throw new Error(`The range response for ${this.url} has no Content-Range or Content-Length header.`)
    }
    this.reader = res.body.getReader()
    this.position = start
    this.leftover = new Uint8Array(0)
    return size
  }

  requestSize () {
    this.end = 0
    const size = this.queue.then(() => this.open(0))
    this.queue = size.catch(_ => _)
    return size
  }

  read (start: number, end: number) {
    this.end = end
    const turn = this.queue.then(async () => {
      if (!this.reader || this.position !== start) await this.open(start)
    })
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    const { promise, resolve } = Promise.withResolvers<void>()
    this.queue = promise

    return new ReadableStream<Uint8Array>({
      pull: async controller => {
        try {
          await turn
          if (!this.leftover.length) {
            const { done, value } = await this.reader!.read()
            if (done) throw new Error(`The response for ${this.url} ended at byte ${this.position}, before byte ${end}.`)
            this.leftover = value
          }
          const part = this.leftover.subarray(0, end - this.position)
          this.leftover = this.leftover.subarray(part.length)
          this.position += part.length
          controller.enqueue(part)
          if (this.position === end) {
            controller.close()
            resolve()
          }
        } catch (error) {
          this.ctrl?.abort()
          this.reader = undefined
          controller.error(error)
          resolve()
        }
      },
      cancel: resolve
    }, { highWaterMark: 0 })
  }
}

export default class ContinuousSource extends CustomSource {
  _connections: Connection[]
  _useCount = 0

  constructor (url: string) {
    super({
      getSize: () => this._connections[0]!.requestSize(),
      read: (start, end) => this._readRange(start, end),
      dispose: () => this._connections.forEach(connection => connection.ctrl?.abort()),
      prefetchProfile: 'network',
      maxCacheSize: 24 * 2 ** 20
    })
    this._connections = [new Connection(url), new Connection(url)]
  }

  _readRange (start: number, end: number) {
    const connection = this._connections.find(connection => connection.end === start) ??
      this._connections.reduce((oldest, connection) => connection.lastUse < oldest.lastUse ? connection : oldest)
    connection.lastUse = ++this._useCount
    return connection.read(start, end)
  }
}
