import { writable, type Writable } from 'simple-store-svelte'

let lastHoverElement: ((_: boolean) => unknown) | null = null

type InputType = 'mouse' | 'touch' | 'dpad'
export const inputType: Writable<InputType> = writable('touch')

function pointerEvent ({ pointerType }: PointerEvent) {
  inputType.value = pointerType === 'mouse' ? 'mouse' : 'touch'
}
addEventListener('pointerdown', pointerEvent)
addEventListener('pointermove', pointerEvent)

// media selectors for pointer coarse, fine and none

const pointerTypes = [{ pointer: '(pointer: coarse)', value: 'touch' }, { pointer: '(pointer: fine)', value: 'mouse' }, { pointer: '(pointer: none)', value: 'dpad' }]

// for stuff like surface tablets, which can dynamically switch between touch and mouse
for (const { pointer, value } of pointerTypes) {
  const media = matchMedia(pointer)
  if (media.matches) inputType.value = value as InputType
  media.addEventListener('change', e => {
    if (e.matches) inputType.value = value as InputType
  })
}

const noop: () => void = () => undefined

// this is for nested click elements, its svelte's |preventDefault for other components
export function clickwrap (cb: (_: MouseEvent) => unknown = noop) {
  return (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    e.stopImmediatePropagation()
    navigator.vibrate(15)
    cb(e)
  }
}

export function keywrap (cb: (_: KeyboardEvent) => unknown = noop) {
  return (e: KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && inputType.value === 'dpad' && !e.repeat) {
      e.stopPropagation()
      e.preventDefault()
      e.stopImmediatePropagation()
      cb(e)
    }
  }
}

/**
 * Adds click event listener to the specified node.
 */
export function click (node: HTMLElement, cb: (_: Event) => unknown = noop) {
  const ctrl = new AbortController()
  node.tabIndex = 0
  node.role = 'button'
  node.addEventListener('click', e => {
    e.stopPropagation()
    e.preventDefault()
    navigator.vibrate(15)
    cb(e)
  }, ctrl)
  node.addEventListener('keydown', e => {
    if (e.key === 'Enter' && inputType.value === 'dpad') {
      e.stopPropagation()
      e.preventDefault()
      cb(e)
    }
  }, ctrl)

  return { destroy: () => ctrl.abort() }
}

/**
 * Adds hover and click event listeners to the specified node.
 */
export function hover (node: HTMLElement, [cb = noop, hoverUpdate = noop]: [typeof noop, (_: boolean) => void]) {
  const ctrl = new AbortController()
  node.addEventListener('wheel', e => {
    // cheap way to update hover state on scroll
    // TODO: this is bad on touch, but good on mouse, fix it
    if (document.elementsFromPoint(e.clientX + e.deltaX, e.clientY + e.deltaY).includes(node)) {
      lastHoverElement?.(false)
      lastHoverElement = hoverUpdate
      hoverUpdate(true)
    } else {
      lastHoverElement?.(false)
      hoverUpdate(false)
    }
  }, { passive: true, signal: ctrl.signal })
  node.tabIndex = 0
  node.role = 'button'
  node.addEventListener('pointerenter', () => {
    lastHoverElement?.(false)
    hoverUpdate(true)
    if (inputType.value === 'mouse') lastHoverElement = hoverUpdate
  }, ctrl)
  node.addEventListener('click', e => {
    e.stopPropagation()
    if (inputType.value === 'dpad') return
    if (inputType.value === 'mouse') return cb()
    if (lastHoverElement === hoverUpdate) {
      lastHoverElement = null
      navigator.vibrate(15)
      hoverUpdate(false)
      cb()
    } else {
      lastHoverElement?.(false)
      lastHoverElement = hoverUpdate
    }
  }, ctrl)
  node.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && inputType.value === 'dpad') {
      e.stopPropagation()
      lastHoverElement?.(false)
      if (lastHoverElement === hoverUpdate) {
        lastHoverElement = null
        hoverUpdate(false)
        cb()
      } else {
        lastHoverElement?.(false)
        hoverUpdate(true)
        lastHoverElement = hoverUpdate
      }
    }
  }, ctrl)
  node.addEventListener('pointerleave', () => {
    if (inputType.value !== 'touch') {
      lastHoverElement?.(false)
      hoverUpdate(false)
      lastHoverElement = null
    }
  }, ctrl)
  node.addEventListener('pointermove', (e) => {
    if (inputType.value === 'touch' && Math.abs(e.movementY) > 0) {
      lastHoverElement?.(false)
      hoverUpdate(false)
      lastHoverElement = null
    }
  }, ctrl)
  node.addEventListener('drag', () => {
    if (inputType.value === 'mouse') {
      lastHoverElement?.(false)
      hoverUpdate(false)
      lastHoverElement = null
    }
  }, ctrl)

  return { destroy: () => ctrl.abort() }
}

interface ElementPosition { element: HTMLElement, x: number, y: number, inViewport: boolean }

type Direction = 'up' | 'right' | 'down' | 'left'

const Directions: Record<Direction, number> = { up: 1, right: 2, down: 3, left: 4 }
// const InverseDirections = { up: 'down', down: 'up', left: 'right', right: 'left' }
const DirectionKeyMap: Record<'ArrowDown' | 'ArrowUp' |'ArrowLeft' | 'ArrowRight', Direction> = { ArrowDown: 'down', ArrowUp: 'up', ArrowLeft: 'left', ArrowRight: 'right' }

/**
 * Calculates the direction between two points.
 */
function getDirection (anchor: ElementPosition, relative: ElementPosition) {
  return Math.round((Math.atan2(relative.y - anchor.y, relative.x - anchor.x) * 180 / Math.PI + 180) / 90) || 4
}

/**
 * Calculates the distance between two points.
 */
function getDistance (anchor: ElementPosition, relative: ElementPosition) {
  return Math.hypot(relative.x - anchor.x, relative.y - anchor.y)
}

/**
 * Gets keyboard-focusable elements within a specified element.
 */
function getKeyboardFocusableElements (element: Element = document.body) {
  return [...element.querySelectorAll<HTMLElement>('a[href]:not([disabled=""], [disabled="true"], [tabindex="-1"]), button:not([disabled=""], [disabled="true"], [tabindex="-1"]), fieldset:not([disabled=""], [disabled="true"]), input:not([disabled=""], [disabled="true"], [readonly]), optgroup:not([disabled=""], [disabled="true"]), option:not([disabled=""], [disabled="true"]), select:not([disabled=""], [disabled="true"]), textarea:not([disabled=""], [disabled="true"]), details, [tabindex]:not([tabindex="-1"], [disabled=""], [disabled="true"]), [contenteditable], [controls]')].filter(
    el => !el.getAttribute('aria-hidden')
  )
}

/**
 * Gets the position of an element.
 */
function getElementPosition (element: HTMLElement): ElementPosition {
  const { x, y, width, height, top, left, bottom, right } = element.getBoundingClientRect()
  const inViewport = isInViewport({ top, left, bottom, right, width, height })
  return { element, x: x + width * 0.5, y: y + height * 0.5, inViewport }
}

/**
 * Gets the positions of all focusable elements.
 */
function getFocusableElementPositions (): ElementPosition[] {
  const elements = []
  let listbox: Element | null = null
  try {
    // support for :has() pseudo-class, which is not widely supported yet
    listbox = document.querySelector(':has(> [role="listbox"])')
  } catch {}
  for (const element of getKeyboardFocusableElements(document.querySelector('[role="dialog"]') ?? document.querySelector('[role="application"]') ?? listbox ?? document.body)) {
    const position = getElementPosition(element)
    elements.push(position)
  }
  return elements
}

/**
 * Checks if an element is within the viewport.
 */
function isInViewport ({ top, left, bottom, right, width, height }: { top: number, left: number, bottom: number, right: number, width: number, height: number }) {
  return top + height >= 0 && left + width >= 0 && bottom - height <= window.innerHeight && right - width <= window.innerWidth
}

// function isVisible ({ top, left, bottom, right }, element) {
//   for (const [x, y] of [[left, top], [right, top], [left, bottom], [right, bottom]]) {
//     if (document.elementFromPoint(x, y)?.isSameNode(element)) return true
//   }
//   return false
// }

function getElementsInDesiredDirection (keyboardFocusable: ElementPosition[], currentElement: ElementPosition, direction: string): ElementPosition[] {
  // first try finding visible elements in desired direction
  return keyboardFocusable.filter(position => {
    // in order of computation cost
    if (position.element === currentElement.element) return false
    if (getDirection(currentElement, position) !== Directions[direction as Direction]) return false

    // filters out elements which are in the viewport, but are overlayed by other elements like a modal
    if (position.inViewport && !position.element.checkVisibility()) return false
    if (!position.inViewport && direction === 'right') return false // HACK: prevent right navigation from going to offscreen elements, but allow vertical elements!
    return true
  })
}

// is input utility class
function inInputEl (element: HTMLElement): element is HTMLInputElement {
  return element.matches('input, textarea')
}

/**
 * Navigates using D-pad keys.
 */
function navigateDPad (direction = 'up', e: KeyboardEvent) {
  const keyboardFocusable = getFocusableElementPositions()
  const nofocus = !document.activeElement || document.activeElement === document.body
  const currentElement = nofocus ? keyboardFocusable[0]! : getElementPosition(document.activeElement as HTMLElement)

  if (nofocus) return focusElement(currentElement.element)
  if (inInputEl(currentElement.element)) {
    const input = currentElement.element
    if (direction === 'left' && input.selectionStart !== 0) return
    if (direction === 'right' && input.selectionEnd !== input.value.length) return
  }

  e.preventDefault()
  e.stopPropagation()

  // allow overrides via data attributes ex: <div data-up="#id, #id2"?> but order them, as querySelectorAll returns them in order of appearance rather than order of selectors
  for (const selector of currentElement.element.dataset[direction]?.split(',') ?? []) {
    const element = document.querySelector<HTMLElement>(selector.trim())
    if (!element) continue // skip if no element found
    if (!element.checkVisibility()) continue // skip elements that are not visible
    if (focusElement(element)) return
  }

  const elementsInDesiredDirection = getElementsInDesiredDirection(keyboardFocusable, currentElement, direction)

  // if there are elements in desired direction
  if (elementsInDesiredDirection.length) {
    const closestElement = elementsInDesiredDirection.reduce<{ distance: number, element?: HTMLElement }>((reducer, position) => {
      const distance = getDistance(currentElement, position)
      if (distance < reducer.distance) return { distance, element: position.element }
      return reducer
    }, { distance: Infinity })

    focusElement(closestElement.element)
    // return
  }

  // no elements in desired direction, go to opposite end [wrap around] // this wasnt a good idea in the long run
  // const elementsInOppositeDirection = getElementsInDesiredDirection(keyboardFocusable, currentElement, InverseDirections[direction])
  // if (elementsInOppositeDirection.length) {
  //   const furthestElement = elementsInOppositeDirection.reduce((reducer, position) => {
  //     const distance = getDistance(currentElement, position)
  //     if (distance > reducer.distance) return { distance, element: position.element }
  //     return reducer
  //   }, { distance: -Infinity, element: null })

  //   furthestElement.element.focus()
  // }
}

function focusElement (element?: HTMLElement | null) {
  if (!element) return false
  const isInput = inInputEl(element)
  if (isInput) {
    const input = element
    input.readOnly = true
  }
  element.focus()
  if (isInput) setTimeout(() => { element.readOnly = false })
  element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })

  element.dispatchEvent(new CustomEvent('navigate', { bubbles: true, composed: true, detail: { target: element.id, value: element.dataset.value } }))

  return true
}

// hacky, but make sure keybinds system loads first so it can prevent this from running

document.addEventListener('keydown', navigate)

export function navigate (e: KeyboardEvent) {
  if (e.key in DirectionKeyMap) {
    inputType.value = 'dpad'
    navigateDPad(DirectionKeyMap[e.key as 'ArrowDown' | 'ArrowUp' | 'ArrowLeft' | 'ArrowRight'], e)
  }
}

export function dragScroll (node: HTMLElement) {
  let x = 0
  let y = 0
  let isDragging = false
  let deltaX = 0
  let deltaY = 0

  const ctrl = new AbortController()

  node.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.buttons !== 1) return
    isDragging = true
    x = e.clientX
    y = e.clientY
    deltaX = 0
    deltaY = 0
  }, ctrl)
  node.addEventListener('click', e => {
    isDragging = false
  }, ctrl)

  node.addEventListener('mousemove', e => {
    if (!isDragging) return true
    deltaX += Math.abs(e.clientX - x)
    deltaY += Math.abs(e.clientY - y)
    node.scrollBy(x - e.clientX, y - e.clientY)
    x = e.clientX
    y = e.clientY
    if (deltaX > 15 || deltaY > 15) {
      e.target?.dispatchEvent(new MouseEvent('drag', { bubbles: true }))
    }
  }, ctrl)

  node.addEventListener('mouseleave', () => {
    isDragging = false
  }, ctrl)

  node.addEventListener('mouseup', () => {
    isDragging = false
  }, ctrl)

  return { destroy: () => ctrl.abort() }
}
