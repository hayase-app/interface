// Dependency-free regression tests of the actual TypeScript module.
// Requires Node >=22.13 and --experimental-vm-modules.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'

const source = stripTypeScriptTypes(await readFile(new URL('../src/lib/modules/gamepad.ts', import.meta.url), 'utf8'))

function gamepad ({ id = 'Standard controller', index = 0, mapping = 'standard', down = [], axes = [0, 0] } = {}) {
  return {
    id,
    index,
    mapping,
    connected: true,
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i) }))
  }
}

const onn = (options = {}) => gamepad({
  ...options, id: 'Onn-Remote Keyboard (Vendor: 0957 Product: 0031)', mapping: ''
})

async function harness (initialPads) {
  let pads = initialPads
  let now = 0
  let frameId = 0
  let activityChanged
  const frames = new Map()
  const events = []
  const listeners = new Map()
  const inputType = { value: 'touch' }
  const activityState = {
    value: 'active',
    subscribe (callback) { activityChanged = callback; callback() }
  }
  let clicks = 0
  const target = {
    dispatchEvent (event) { events.push(event) },
    click () { clicks++ }
  }
  const listen = (type, callback) => {
    if (!listeners.has(type)) listeners.set(type, [])
    listeners.get(type).push(callback)
  }
  const document = {
    activeElement: target, body: {}, visibilityState: 'visible', addEventListener: listen
  }
  const context = vm.createContext({
    navigator: { getGamepads: () => pads },
    document,
    addEventListener: listen,
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId },
    cancelAnimationFrame: id => frames.delete(id),
    performance: { now: () => now },
    KeyboardEvent: class {
      constructor (type, options) { Object.assign(this, { type, defaultPrevented: false }, options) }
      preventDefault () { this.defaultPrevented = true }
    }
  })
  const module = new vm.SourceTextModule(source, { context })
  await module.link(specifier => {
    const exports = specifier === './idle' ? { activityState } : specifier === './navigate' ? { inputType } : null
    assert.ok(exports, `unexpected import ${specifier}`)
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
    }, { context })
  })
  await module.evaluate()
  return {
    events,
    frames,
    inputType,
    document,
    get clicks () { return clicks },
    setPads (value) { pads = value },
    emit (type) { for (const listener of listeners.get(type) ?? []) listener() },
    activity (value) { activityState.value = value; activityChanged() },
    tick (time) {
      now = time
      const batch = Array.from(frames.values())
      frames.clear()
      for (const callback of batch) callback(time)
    }
  }
}

test('polls every frame and refreshes immutable gamepad snapshots', async () => {
  const h = await harness([gamepad()])
  h.tick(0)
  h.setPads([gamepad({ down: [12] })])
  h.tick(16)
  assert.equal(h.events.at(-1).key, 'ArrowUp')
  h.setPads([gamepad()])
  h.tick(32)
  assert.equal(h.events.at(-1).type, 'keyup')
  h.tick(48)
  assert.equal(h.frames.size, 1)
})

test('does not schedule duplicate loops on connection or activity updates', async () => {
  const h = await harness([gamepad()])
  h.emit('gamepadconnected')
  h.activity('active')
  assert.equal(h.frames.size, 1)
  h.tick(0)
  h.emit('gamepadconnected')
  assert.equal(h.frames.size, 1)
})

test('onn arrows work while native OK/Back and unverified axes are left alone', async () => {
  const h = await harness([onn()])
  for (const [i, key] of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].entries()) {
    h.setPads([onn({ down: [12 + i] })])
    h.tick(i * 32)
    assert.equal(h.events.at(-1).key, key)
    assert.equal(h.events.at(-1).type, 'keydown')
    h.setPads([onn()])
    h.tick(i * 32 + 16)
    assert.equal(h.events.at(-1).type, 'keyup')
  }
  assert.equal(h.inputType.value, 'dpad')
  const count = h.events.length
  h.setPads([onn({ down: [0, 1, 9], axes: [1, -1] })])
  h.tick(160)
  assert.equal(h.events.length, count)
  assert.equal(h.clicks, 0)
})

test('unknown non-standard controllers are not assigned an assumed mapping', async () => {
  const h = await harness([gamepad({ id: 'Other remote', mapping: '', down: [12] })])
  h.tick(0)
  assert.equal(h.frames.size, 0)
  assert.equal(h.events.length, 0)
})

test('standard controller activation remains supported', async () => {
  const h = await harness([gamepad({ down: [0] })])
  h.tick(0)
  assert.equal(h.events.at(-1).key, 'Enter')
  assert.equal(h.clicks, 1)
  h.setPads([gamepad()])
  h.tick(16)
  assert.equal(h.events.at(-1).type, 'keyup')
})

test('preserves the existing preference for a standard controller', async () => {
  const h = await harness([onn({ down: [12] }), gamepad({ index: 1, down: [15] })])
  h.tick(0)
  assert.deepEqual(h.events.map(e => e.key), ['ArrowRight'])
})

test('held arrows repeat after 400ms, then every 100ms, and release once', async () => {
  const h = await harness([onn({ down: [12] })])
  h.tick(0)
  h.tick(399)
  assert.equal(h.events.length, 1)
  h.tick(400)
  assert.equal(h.events.at(-1).repeat, true)
  h.tick(499)
  assert.equal(h.events.length, 2)
  h.tick(500)
  assert.equal(h.events.length, 3)
  h.setPads([onn()])
  h.tick(516)
  h.tick(532)
  assert.deepEqual(h.events.map(e => e.type), ['keydown', 'keydown', 'keydown', 'keyup'])
})

test('blur releases held keys and focus restarts only one loop', async () => {
  const h = await harness([onn({ down: [12] })])
  h.tick(0)
  h.activity('inactive')
  assert.equal(h.events.at(-1).type, 'keyup')
  assert.equal(h.frames.size, 0)
  h.setPads([onn()])
  h.activity('active')
  h.activity('active')
  assert.equal(h.frames.size, 1)
})

test('visibility changes release keys and safely resume', async () => {
  const h = await harness([onn({ down: [12] })])
  h.tick(0)
  h.document.visibilityState = 'hidden'
  h.emit('visibilitychange')
  assert.equal(h.events.at(-1).type, 'keyup')
  assert.equal(h.frames.size, 0)
  h.document.visibilityState = 'visible'
  h.setPads([onn()])
  h.emit('visibilitychange')
  assert.equal(h.frames.size, 1)
})

test('disconnecting between frames releases held keys even with no pending frame ID', async () => {
  const h = await harness([onn({ down: [12] })])
  h.tick(0)
  h.setPads([null])
  h.tick(16)
  assert.equal(h.events.at(-1).type, 'keyup')
  assert.equal(h.frames.size, 0)
})

test('switching controllers releases old keys before polling the replacement', async () => {
  const h = await harness([gamepad({ down: [12] }), onn({ index: 1 })])
  h.tick(0)
  h.setPads([null, onn({ index: 1, down: [15] })])
  h.emit('gamepaddisconnected')
  assert.equal(h.events.at(-1).type, 'keyup')
  assert.equal(h.frames.size, 1)
  h.tick(16)
  assert.equal(h.events.at(-1).key, 'ArrowRight')
})

test('controller replacement at the same index releases stale button state', async () => {
  const h = await harness([gamepad({ down: [12] })])
  h.tick(0)
  h.setPads([onn({ down: [15] })])
  h.tick(16)
  assert.deepEqual(h.events.map(e => [e.type, e.key]), [
    ['keydown', 'ArrowUp'], ['keyup', 'ArrowUp'], ['keydown', 'ArrowRight']
  ])
  assert.equal(h.frames.size, 1)
})
