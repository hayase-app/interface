export interface EventsOptions {
  signal?: AbortSignal
  errors?: readonly string[]
}

const defaultErrors = ['error', 'reject', 'abort', 'terminate', 'cancel'] as const

function toError (reason: unknown): Error {
  if (reason instanceof Error) return reason
  if (typeof reason === 'string') return new Error(reason)
  return new Error('Aborted')
}

export class EventError<E extends Event = Event> extends Error {
  readonly event: E
  constructor (event: E) {
    super(event.type)
    this.name = 'EventError'
    this.event = event
  }
}

export type ErrorEventType<T extends EventTarget, ErrorEvents extends readonly string[]> =
  EventTargetEventMap<T>[ErrorEvents[number] & keyof EventTargetEventMap<T>]

export function isEventError <
  T extends EventTarget = EventTarget,
  ErrorEvents extends readonly string[] = typeof defaultErrors
> (
  err: unknown
): err is EventError<ErrorEventType<T, ErrorEvents> & Event> {
  return err instanceof EventError
}

export type EventTargetEventMap<T extends EventTarget> =
  T extends AbstractWorker ? AbstractWorkerEventMap :
  T extends AudioScheduledSourceNode ? AudioScheduledSourceNodeEventMap :
  T extends BaseAudioContext ? BaseAudioContextEventMap :
  T extends BroadcastChannel ? BroadcastChannelEventMap :
  T extends Document ? DocumentEventMap :
  T extends EventSource ? EventSourceEventMap :
  T extends HTMLMediaElement ? HTMLMediaElementEventMap :
  T extends HTMLElement ? HTMLElementEventMap :
  T extends IDBRequest ? IDBRequestEventMap :
  T extends IDBDatabase ? IDBDatabaseEventMap :
  T extends IDBOpenDBRequest ? IDBOpenDBRequestEventMap :
  T extends IDBTransaction ? IDBTransactionEventMap :
  T extends MediaStream ? MediaStreamEventMap :
  T extends MessagePort ? MessagePortEventMap :
  T extends MIDIAccess ? MIDIAccessEventMap :
  T extends MIDIPort ? MIDIPortEventMap :
  T extends PaymentRequest ? PaymentRequestEventMap :
  T extends RTCDataChannel ? RTCDataChannelEventMap :
  T extends RTCPeerConnection ? RTCPeerConnectionEventMap :
  T extends ServiceWorker ? ServiceWorkerEventMap :
  T extends ServiceWorkerContainer ? ServiceWorkerContainerEventMap :
  T extends WebSocket ? WebSocketEventMap :
  T extends Window ? WindowEventMap :
  T extends Worker ? WorkerEventMap :
  T extends XMLHttpRequest ? XMLHttpRequestEventTargetEventMap :
  T extends PresentationConnection ? PresentationConnectionEventMap :
  T extends PresentationRequest ? PresentationRequestEventMap :
  Record<string, Event>

export async function once<
  T extends EventTarget,
  K extends keyof EventTargetEventMap<T>,
  ErrorEvents extends readonly string[] = typeof defaultErrors,
>(
  target: T,
  name: K,
  options?: EventsOptions & { errors?: ErrorEvents },
): Promise<EventTargetEventMap<T>[K]>
export async function once<
  E extends Record<string, Event>,
  K extends keyof E,
  ErrorEvents extends readonly string[] = typeof defaultErrors,
>(
  target: EventTarget,
  name: K,
  options?: EventsOptions & { errors?: ErrorEvents },
): Promise<E[K]>
export async function once (
  target: EventTarget,
  name: string,
  { signal, errors = defaultErrors }: EventsOptions = {}
): Promise<Event> {
  if (signal?.aborted) throw toError(signal.reason)

  const ctrl = new AbortController()

  if (signal) {
    signal.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true })
  }

  return await new Promise<Event>((resolve, reject) => {
    ctrl.signal.addEventListener('abort', () => {
      reject(toError(ctrl.signal.reason))
    }, { once: true })

    target.addEventListener(name, (event: Event) => {
      resolve(event)
      ctrl.abort()
    }, { once: true, signal: ctrl.signal })

    errors.forEach(ev => {
      target.addEventListener(ev, (event: Event) => {
        reject(new EventError(event))
        ctrl.abort()
      }, { once: true, signal: ctrl.signal })
    })
  })
}

export function on<
  T extends EventTarget,
  K extends keyof EventTargetEventMap<T>,
  ErrorEvents extends readonly string[] = typeof defaultErrors,
>(
  target: T,
  name: K,
  options?: EventsOptions & { errors?: ErrorEvents },
): AsyncIterable<EventTargetEventMap<T>[K]>
export function on<
  E extends Record<string, Event>,
  K extends keyof E,
  ErrorEvents extends readonly string[] = typeof defaultErrors,
>(
  target: EventTarget,
  name: K,
  options?: EventsOptions & { errors?: ErrorEvents },
): AsyncIterable<E[K]>
export function on (
  target: EventTarget,
  name: string,
  { signal, errors = defaultErrors }: EventsOptions = {}
): AsyncIterable<Event> {
  if (signal?.aborted) throw toError(signal.reason)

  const ctrl = new AbortController()

  if (signal) {
    signal.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true })
  }

  const queue: Event[] = []
  let pending: PromiseWithResolvers<IteratorResult<Event>> | null = null
  let err: Error | null = null
  let done = false

  ctrl.signal.addEventListener('abort', () => {
    if (err) return
    err = toError(ctrl.signal.reason)
    if (pending) {
      pending.reject(err)
      pending = null
    }
  }, { once: true })

  target.addEventListener(name, event => {
    if (err || done) return
    if (pending) {
      pending.resolve({ value: event, done: false })
      pending = null
    } else {
      queue.push(event)
    }
  }, { signal: ctrl.signal })

  errors.forEach(ev => {
    target.addEventListener(ev, event => {
      if (err) return
      err = new EventError(event)
      ctrl.abort()
      if (pending) {
        pending.reject(err)
        pending = null
      }
    }, { signal: ctrl.signal })
  })

  const iterator: AsyncIterator<Event> = {
    next (): Promise<IteratorResult<Event>> {
      if (done) return Promise.resolve({ done: true, value: undefined })
      if (err) return Promise.reject(err)
      if (queue.length > 0) {
        return Promise.resolve({ value: queue.shift()!, done: false })
      }
      pending = Promise.withResolvers()
      return pending.promise
    },
    return (): Promise<IteratorResult<Event>> {
      ctrl.abort()
      done = true
      if (pending) {
        pending.resolve({ done: true, value: undefined })
        pending = null
      }
      return Promise.resolve({ done: true, value: undefined })
    }
  }

  return { [Symbol.asyncIterator] () { return iterator } }
}

export type EventDetail<M extends { [K in keyof M]: Event }, K extends keyof M> =
  M[K] extends CustomEvent<infer D> ? D : never

export type CustomEventKey<M extends { [K in keyof M]: Event }> = {
  [K in keyof M]: M[K] extends CustomEvent<unknown> ? K : never
}[keyof M]

export type SimpleEventKey<M extends { [K in keyof M]: Event }> = {
  [K in keyof M]: M[K] extends CustomEvent<unknown> ? never : K
}[keyof M]

// An EventTarget whose add/remove/emit methods are keyed to an event map.
type AnyListener = EventListenerOrEventListenerObject | null | ((event: never) => void)

export default class TypedEventTarget<M extends { [K in keyof M]: Event }> extends EventTarget {
  addEventListener<K extends keyof M> (type: K, listener: (event: M[K]) => void, options?: boolean | AddEventListenerOptions): void
  addEventListener (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void
  addEventListener (type: string, listener: AnyListener, options?: boolean | AddEventListenerOptions): void {
    super.addEventListener(type, listener as EventListenerOrEventListenerObject | null, options)
  }

  removeEventListener<K extends keyof M> (type: K, listener: (event: M[K]) => void, options?: boolean | EventListenerOptions): void
  removeEventListener (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void
  removeEventListener (type: string, listener: AnyListener, options?: boolean | EventListenerOptions): void {
    super.removeEventListener(type, listener as EventListenerOrEventListenerObject | null, options)
  }

  _emit<K extends CustomEventKey<M>> (type: K, detail: EventDetail<M, K>) {
    this.dispatchEvent(new CustomEvent(type as string, { detail }))
  }

  _emitSimple<K extends SimpleEventKey<M>> (type: K) {
    this.dispatchEvent(new Event(type as string))
  }
}
