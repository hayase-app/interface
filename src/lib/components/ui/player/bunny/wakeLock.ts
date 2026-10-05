// Keeps the screen awake during playback.
//
// The Screen Wake Lock API is the primary mechanism. Webviews often expose it
// but do not act on it, and some do not expose it at all. A 2x2 silent looping
// video is the fallback for those. The fallback stays detached from the DOM,
// so it never composes in the page.
//
// The wake lock is dropped whenever the page is hidden and re-acquired when it
// becomes visible again, which is what the platform expects.

// A 649 byte silent VP8 WebM. Generated once with MediaRecorder. The CSP
// blocks data: media, so it is decoded to a blob: URL on first use.

const FALLBACK_VIDEO = URL.createObjectURL(new Blob(
  [new Uint8Array([26, 69, 223, 163, 159, 66, 134, 129, 1, 66, 247, 129, 1, 66, 242, 129, 4, 66, 243, 129, 8, 66, 130, 132, 119, 101, 98, 109, 66, 135, 129, 4, 66, 133, 129, 2, 24, 83, 128, 103, 1, 0, 0, 0, 0, 0, 2, 89, 17, 77, 155, 116, 185, 77, 187, 139, 83, 171, 132, 21, 73, 169, 102, 83, 172, 129, 110, 77, 187, 139, 83, 171, 132, 22, 84, 174, 107, 83, 172, 129, 147, 77, 187, 139, 83, 171, 132, 31, 67, 182, 117, 83, 172, 129, 212, 77, 187, 140, 83, 171, 132, 28, 83, 187, 107, 83, 172, 130, 2, 71, 236, 174, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 21, 73, 169, 102, 160, 42, 215, 177, 131, 15, 66, 64, 68, 137, 132, 68, 122, 151, 223, 77, 128, 134, 67, 104, 114, 111, 109, 101, 87, 65, 134, 67, 104, 114, 111, 109, 101, 22, 84, 174, 107, 188, 174, 186, 215, 129, 1, 115, 197, 135, 63, 188, 236, 136, 213, 163, 208, 131, 129, 1, 85, 238, 129, 1, 134, 133, 86, 95, 86, 80, 56, 224, 157, 176, 129, 2, 186, 129, 2, 83, 192, 129, 1, 85, 176, 144, 85, 177, 129, 1, 85, 185, 129, 2, 85, 186, 129, 13, 85, 187, 129, 1, 31, 67, 182, 117, 1, 0, 0, 0, 0, 0, 1, 103, 231, 129, 0, 160, 204, 161, 162, 129, 0, 0, 0, 16, 2, 0, 157, 1, 42, 2, 0, 2, 0, 4, 135, 8, 133, 133, 136, 153, 132, 136, 24, 2, 0, 12, 13, 96, 0, 254, 246, 144, 128, 117, 161, 165, 166, 163, 238, 129, 1, 165, 158, 16, 2, 0, 157, 1, 42, 2, 0, 2, 0, 4, 135, 8, 133, 133, 136, 153, 132, 136, 24, 2, 0, 12, 13, 96, 0, 254, 246, 165, 0, 160, 181, 161, 149, 129, 0, 201, 0, 177, 1, 0, 18, 16, 240, 0, 24, 0, 24, 88, 47, 244, 0, 8, 0, 0, 117, 161, 152, 166, 150, 238, 129, 1, 165, 145, 177, 1, 0, 18, 16, 240, 0, 24, 0, 24, 88, 47, 244, 0, 8, 0, 0, 251, 129, 0, 160, 181, 161, 149, 129, 1, 145, 0, 177, 1, 0, 18, 17, 12, 0, 24, 0, 24, 88, 47, 244, 0, 8, 0, 0, 117, 161, 152, 166, 150, 238, 129, 1, 165, 145, 177, 1, 0, 18, 17, 12, 0, 24, 0, 24, 88, 47, 244, 0, 8, 0, 0, 251, 129, 201, 160, 182, 161, 149, 129, 2, 89, 0, 177, 1, 0, 18, 17, 40, 0, 24, 0, 24, 88, 47, 244, 0, 8, 0, 0, 117, 161, 152, 166, 150, 238, 129, 1, 165, 145, 177, 1, 0, 18, 17, 40, 0, 24, 0, 24, 88, 47, 244, 0, 8, 0, 0, 251, 130, 1, 145, 160, 182, 161, 149, 129, 3, 34, 0, 177, 1, 0, 18, 17, 76, 0, 24, 0, 24, 88, 47, 244, 0, 8, 0, 0, 117, 161, 152, 166, 150, 238, 129, 1, 165, 145, 177, 1, 0, 18, 17, 76, 0, 24, 0, 24, 88, 47, 244, 0, 8, 0, 0, 251, 130, 2, 89, 160, 182, 161, 149, 129, 3, 234, 0, 177, 1, 0, 18, 17, 104, 0, 24, 0, 24, 88, 47, 244, 0, 8, 0, 0, 117, 161, 152, 166, 150, 238, 129, 1, 165, 145, 177, 1, 0, 18, 17, 104, 0, 24, 0, 24, 88, 47, 244, 0, 8, 0, 0, 251, 130, 3, 34, 28, 83, 187, 107, 141, 187, 139, 179, 129, 0, 183, 134, 247, 129, 1, 241, 129, 212])]
  , { type: 'video/webm' }))

export default class ScreenWakeLock {
  _want = false
  _busy = false
  _sentinel?: WakeLockSentinel
  _fallbackActive = false
  _retryTimer?: ReturnType<typeof setTimeout>
  _controller = new AbortController()
  _fallback = document.createElement('video')

  constructor () {
    this._fallback.src = FALLBACK_VIDEO
    this._fallback.loop = true
    this._fallback.muted = true
    this._fallback.playsInline = true
    document.addEventListener('visibilitychange', () => {
      if (this._want) this._sync()
    }, this._controller)
  }

  get active () {
    return !!this._sentinel || this._fallbackActive
  }

  request () {
    if (this._want) return
    this._want = true
    this._sync()
  }

  release () {
    if (!this._want) return
    this._want = false
    this._sync()
  }

  destroy () {
    this._controller.abort()
    this._want = false
    this._release()
  }

  async _sync () {
    if (this._busy) return
    this._busy = true
    try {
      if (this._want && document.visibilityState === 'visible') await this._acquire()
      else this._release()
    } finally {
      this._busy = false
    }
  }

  async _acquire () {
    if (this._sentinel || this._fallbackActive) return

    if (navigator.wakeLock?.request) {
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        if (!this._want) {
          sentinel.release?.()
        }
        this._sentinel = sentinel
        sentinel.addEventListener('release', () => this._onSentinelReleased(sentinel))
      } catch {}
    }

    this._startFallback()
  }

  _onSentinelReleased (sentinel: WakeLockSentinel) {
    if (this._sentinel !== sentinel) return
    this._sentinel = undefined
    if (!this._want) return
    // The lock is released when the page hides, which is expected. If it is
    // released while the page is still visible, the webview ignored the API.
    clearTimeout(this._retryTimer)
    this._retryTimer = setTimeout(() => {
      if (this._want && document.visibilityState === 'visible' && !this._sentinel && !this._fallbackActive) {
        this._startFallback()
      }
    }, 1000)
  }

  _startFallback () {
    if (this._fallbackActive) return
    this._fallbackActive = true
    this._fallback.play()
  }

  _release () {
    clearTimeout(this._retryTimer)
    if (this._sentinel) {
      const sentinel = this._sentinel
      this._sentinel = undefined
      sentinel.release?.()
    }
    if (this._fallbackActive) {
      this._fallbackActive = false
      this._fallback.pause()
    }
  }
}
