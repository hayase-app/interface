import { activityState } from './idle'
import { inputType } from './navigate'
import SUPPORTS from './settings/supports'

// Standard Gamepad mapping per W3C spec
// https://www.w3.org/TR/gamepad/#remapping
interface ButtonMap { key: string, code: string }

const BUTTON_MAP: Record<number, ButtonMap> = {
  0: { key: 'Enter', code: 'Enter' }, // A / Cross
  1: { key: 'Escape', code: 'Escape' }, // B / Circle
  9: { key: 'Escape', code: 'Escape' }, // Start -> treat as back/menu for now
  12: { key: 'ArrowUp', code: 'ArrowUp' },
  13: { key: 'ArrowDown', code: 'ArrowDown' },
  14: { key: 'ArrowLeft', code: 'ArrowLeft' },
  15: { key: 'ArrowRight', code: 'ArrowRight' }
}

// Left stick axes -> arrow directions, with hysteresis to avoid flicker
const STICK_PRESS = 0.5
const STICK_RELEASE = 0.3

// virtual button indices for left stick directions
const STICK_UP = 100
const STICK_DOWN = 101
const STICK_LEFT = 102
const STICK_RIGHT = 103

const STICK_MAP: Record<number, ButtonMap> = {
  [STICK_UP]: { key: 'ArrowUp', code: 'ArrowUp' },
  [STICK_DOWN]: { key: 'ArrowDown', code: 'ArrowDown' },
  [STICK_LEFT]: { key: 'ArrowLeft', code: 'ArrowLeft' },
  [STICK_RIGHT]: { key: 'ArrowRight', code: 'ArrowRight' }
}

// Native keyboard repeat feel: ~400ms initial delay, then ~100ms per repeat
const INITIAL_REPEAT_DELAY = 400
const REPEAT_INTERVAL = 100

interface PressState {
  pressedAt: number
  nextRepeatAt: number
}

const pressed = new Map<`${number}:${number}`, PressState>() // `${gamepadIndex}:${buttonIndex}`

let rafId = 0

function dispatch (type: 'keydown' | 'keyup', { key, code }: ButtonMap, repeat = false) {
  inputType.value = 'dpad'
  // Dispatch on the focused element so it bubbles up through per-node listeners
  // (e.g. the Enter handler in navigate.ts click/hover actions) and finally
  // reaches the document-level listener used by navigate/keybinds.
  const target = (document.activeElement as HTMLElement | null) ?? document.body
  const event = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true, repeat })
  target.dispatchEvent(event)

  // Synthetic events have isTrusted=false, so the browser skips default
  // activation behaviour (following <a href>, submitting <button type=submit>).
  // Emulate it explicitly for Enter on keydown when nothing called preventDefault.
  if (type === 'keydown' && key === 'Enter' && !event.defaultPrevented && target !== document.body) {
    target.click()
  }
}

function handleButton (id: `${number}:${number}`, isDown: boolean, now: number, map: ButtonMap) {
  const state = pressed.get(id)

  if (isDown && !state) {
    pressed.set(id, { pressedAt: now, nextRepeatAt: now + INITIAL_REPEAT_DELAY })
    dispatch('keydown', map, false)
    return
  }

  if (isDown && state && now >= state.nextRepeatAt) {
    state.nextRepeatAt = now + REPEAT_INTERVAL
    dispatch('keydown', map, true)
    return
  }

  if (!isDown && state) {
    pressed.delete(id)
    dispatch('keyup', map, false)
  }
}

function getPads () {
  return navigator.getGamepads().filter((p): p is Gamepad => !!p && (SUPPORTS.isMobile || p.mapping === 'standard'))
}

const knownPads = new Map<number, string>()

function updateActivePad () {
  if (getPads().length && activityState.value === 'active') start()
  else stop()
}

function release (gamepadIndex?: number) {
  for (const id of pressed.keys()) {
    const [padIndex, buttonIndex] = id.split(':').map(Number) as [number, number]
    if (gamepadIndex !== undefined && padIndex !== gamepadIndex) continue
    pressed.delete(id)
    const map = BUTTON_MAP[buttonIndex] ?? STICK_MAP[buttonIndex]
    if (map) dispatch('keyup', map, false)
  }
}

function poll () {
  rafId = requestAnimationFrame(poll)
  const now = performance.now()

  const pads = getPads()

  for (const [index, id] of knownPads) {
    if (pads.some(pad => pad.index === index && pad.id === id)) continue
    knownPads.delete(index)
    release(index)
  }

  for (const pad of pads) {
    knownPads.set(pad.index, pad.id)

    for (let i = 0; i < pad.buttons.length; i++) {
      const map = BUTTON_MAP[i]
      if (!map) continue
      handleButton(`${pad.index}:${i}`, pad.buttons[i]!.pressed, now, map)
    }

    // Left stick: axes[0] = X (left/right), axes[1] = Y (up/down)
    const [x = 0, y = 0] = pad.axes

    // Skip axes if they look like non-centered device inputs (e.g. throttle, rudder).
    // Standard analog sticks return near 0 when at rest, flight-sim peripherals
    // often peg axes at -1/1 (throttle quadrant, pedals, etc.) causing constant
    // directional navigation.
    if (Math.abs(x) < 0.9 || Math.abs(y) < 0.9) {
      handleStickAxis(pad.index, STICK_LEFT, STICK_RIGHT, x, now)
      handleStickAxis(pad.index, STICK_UP, STICK_DOWN, y, now)
    }
  }
}

function start () {
  if (rafId) return
  poll()
}

function handleStickAxis (gamepadIndex: number, negIdx: number, posIdx: number, value: number, now: number) {
  const negId = `${gamepadIndex}:${negIdx}` as const
  const posId = `${gamepadIndex}:${posIdx}`as const

  // higher threshold to press, lower to release
  const negActive = pressed.has(negId) ? value < -STICK_RELEASE : value < -STICK_PRESS
  const posActive = pressed.has(posId) ? value > STICK_RELEASE : value > STICK_PRESS

  handleButton(negId, negActive, now, STICK_MAP[negIdx]!)
  handleButton(posId, posActive, now, STICK_MAP[posIdx]!)
}

function stop () {
  if (!rafId) return
  cancelAnimationFrame(rafId)
  rafId = 0
  release()
  knownPads.clear()
}

if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
  addEventListener('gamepadconnected', updateActivePad)
  addEventListener('gamepaddisconnected', updateActivePad)
  // this kicks off polling
  activityState.subscribe(updateActivePad)
}
