import type { Native } from 'native'

import native from '$lib/modules/native'
import { on, once } from '$lib/modules/target'
import { assert } from '$lib/utils'

const clientId = Math.trunc(1000000000000000 * Math.random()).toString()

const params = new URLSearchParams({
  clientId
  // autoJoinPolicy: 'origin_scoped',
  // defaultActionPolicy: 'create_session',
  // launchTimeout: '6000',
  // supportedAppTypes: 'WEB'
})
// &appParams=%7B%22launchCheckerParams%22%3A%7B%7D%7D'

export default new class ChromeCast {
  presentationRequest = typeof PresentationRequest !== 'undefined' && new PresentationRequest(['cast:F433D22E?' + params.toString()])
  _connection: PresentationConnection | undefined

  constructor () {
    if (!this.presentationRequest) return this

    navigator.presentation.defaultRequest = this.presentationRequest
  }

  getDisplays: Native['getDisplays'] = async cb => {
    if (!this.presentationRequest) return

    const avail = await this.presentationRequest.getAvailability()

    const update = () => cb(avail.value ? [{ friendlyName: 'ChromeCast', host: 'PresentationRequest' }] : [])
    avail.addEventListener('change', update)
    update()
  }

  async _waitForSession () {
    for await (const { data } of on(this._connection!, 'message')) {
      try {
        const { message } = JSON.parse(data)
        if (message?.sessionId) return message.sessionId as string
      } catch {}
    }

    assert(false)
  }

  _requestId = 1

  async _monitorRequestId () {
    try {
      for await (const { data } of on(this._connection!, 'message')) {
        try {
          const { message } = JSON.parse(data)
          const requestId = message.requestId
          if (requestId) this._requestId = Math.max(this._requestId, requestId)
        } catch {}
      }
    } catch {}
  }

  _send (message: unknown, type = 'v2_message') {
    this._connection?.send(JSON.stringify({
      type,
      message,
      clientId,
      sequenceNumber: -1
    }))
  }

  _sendCustom (message: unknown, sessionId: string) {
    this._send({
      namespaceName: 'urn:x-cast:com.url.cast',
      sessionId,
      message: JSON.stringify(message)
    }, 'app_message')
  }

  // async _request (message: unknown, type = 'v2_message') {
  //   const newRequestId = ++this._requestId
  //   // @ts-expect-error yeah
  //   if (message) message.requestId = newRequestId
  //   this._send(message, type)
  //   for await (const { data } of on(this._connection!, 'message')) {
  //     try {
  //       const parsed = JSON.parse(data)
  //       const requestId = parsed.message.requestId
  //       if (requestId === newRequestId) return parsed
  //     } catch {}
  //   }
  // }

  castPlay: Native['castPlay'] = async (host, hash, id, media) => {
    if (host !== 'PresentationRequest' || !this.presentationRequest) return
    await this.castClose(host)
    const connection = this._connection = await this.presentationRequest.start()

    this._monitorRequestId()
    const sessionId = await this._waitForSession()

    this._send({
      type: 'LOAD',
      sessionId,
      media,
      activeTrackIds: [],
      autoplay: true,
      currentTime: 0,
      repeatMode: 'REPEAT_OFF'
    })

    const tracks = await native.tracks(hash, id)
    this._sendCustom({ type: 'tracks', tracks }, sessionId)
    native.subtitles(hash, id, (subtitle, trackNumber) => {
      this._sendCustom({ type: 'subtitle', subtitle, trackNumber }, sessionId)
    })
    const attachments = await native.attachments(hash, id)
    this._sendCustom({ type: 'attachments', attachments }, sessionId)

    this._sendCustom({ type: 'eval', code: '"Hello world!"' }, sessionId)

    if (connection.state !== 'connected') return

    await once(connection, 'terminate')
  }

  castClose: Native['castClose'] = async (host) => {
    if (host !== 'PresentationRequest' || !this._connection) return
    const terminate = once(this._connection, 'terminate')
    this._connection.terminate()
    await terminate
  }
}()
