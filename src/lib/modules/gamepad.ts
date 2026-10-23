import { activityState } from './idle'
import { inputType } from './navigate'

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

// This Android TV remote exposes a non-standard gamepad alongside native keys.
// Only its D-pad has been verified; leave native OK and Back handling alone.
const ONN_DPAD_MAP: Record<number, ButtonMap> = {
  12: BUTTON_MAP[12]!,
  13: BUTTON_MAP[13]!,
  14: BUTTON_MAP[14]!,
  15: BUTTON_MAP[15]!
}

function isOnnRemote (gamepad: Gamepad | null | undefined) {
  return !!gamepad?.connected && gamepad.mapping === '' &&
    /^Onn-Remote Keyboard \(Vendor: 0957 Product: 0031\)$/i.test(gamepad.id)
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
let pad: Gamepad | null | undefined

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

function updateActivePad () {
  const pads = navigator.getGamepads()
  const nextPad = pads.find(p => p?.connected && p.mapping === 'standard') ?? pads.find(isOnnRemote)
  if (nextPad?.index !== pad?.index || nextPad?.id !== pad?.id || nextPad?.mapping !== pad?.mapping) stop()
  pad = nextPad
  if (pad && activityState.value === 'active' && document.visibilityState === 'visible') start()
  else stop()
}

function start () {
  if (!pad || rafId) return
  rafId = requestAnimationFrame(poll)
}

function poll () {
  // The scheduled frame has fired. Keep the duplicate-start guard out of this callback.
  rafId = 0
  // Gamepad objects can be snapshots: read the current button state every frame.
  const currentPad = pad && navigator.getGamepads()[pad.index]
  if (!currentPad?.connected ||
      (currentPad.mapping !== 'standard' && !isOnnRemote(currentPad)) ||
      activityState.value !== 'active' || document.visibilityState !== 'visible') {
    stop()
    return
  }
  if (currentPad.id !== pad?.id || currentPad.mapping !== pad?.mapping) stop()
  pad = currentPad
  const buttonMap = isOnnRemote(pad) ? ONN_DPAD_MAP : BUTTON_MAP
  const now = performance.now()

  for (let i = 0; i < pad.buttons.length; i++) {
    const map = buttonMap[i]
    if (!map) continue
    handleButton(`${pad.index}:${i}`, pad.buttons[i]!.pressed, now, map)
  }

  // Left stick: axes[0] = X (left/right), axes[1] = Y (up/down)
  const [x = 0, y = 0] = pad.axes

  // Skip axes if they look like non-centered device inputs (e.g. throttle, rudder).
  // Standard analog sticks return near 0 when at rest, flight-sim peripherals
  // often peg axes at -1/1 (throttle quadrant, pedals, etc.) causing constant
  // directional navigation.
  if (!isOnnRemote(pad) && (Math.abs(x) < 0.9 || Math.abs(y) < 0.9)) {
    handleStickAxis(pad.index, STICK_LEFT, STICK_RIGHT, x, now)
    handleStickAxis(pad.index, STICK_UP, STICK_DOWN, y, now)
  }
  if (activityState.value === 'active' && document.visibilityState === 'visible') start()
  else stop()
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
  if (rafId) cancelAnimationFrame(rafId)
  rafId = 0
  // release any buttons still marked as pressed to avoid stuck-key state
  for (const id of pressed.keys()) {
    const [, buttonIndexStr] = id.split(':')
    const buttonIndex = Number(buttonIndexStr)
    const map = BUTTON_MAP[buttonIndex] ?? STICK_MAP[buttonIndex]
    if (map) dispatch('keyup', map, false)
  }
  pressed.clear()
}

if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
  addEventListener('gamepadconnected', updateActivePad)
  addEventListener('gamepaddisconnected', updateActivePad)
  document.addEventListener('visibilitychange', updateActivePad)
  // this kicks off polling
  activityState.subscribe(updateActivePad)
}
