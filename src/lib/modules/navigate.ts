import { writable, type Writable } from 'simple-store-svelte'

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
    // navigator.vibrate(15)
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
    // navigator.vibrate(15)
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

const HOVER_TIME = 30
let lastHoverElement: ((_: boolean) => unknown) | null = null
/**
 * Adds hover and click event listeners to the specified node.
 */
export function hover (node: HTMLElement, [cb = noop, hoverUpdate = noop]: [typeof noop, (_: boolean) => void]) {
  const ctrl = new AbortController()
  let hoverTimer: ReturnType<typeof setTimeout>
  function cleanupTimer () {
    clearTimeout(hoverTimer)
    hoverTimer = 0
  }
  function hoverElement () {
    unhoverLastElement()
    hoverUpdate(true)
    lastHoverElement = hoverUpdate
  }
  function unhoverLastElement () {
    cleanupTimer()
    lastHoverElement?.(false)
    hoverUpdate(false)
    lastHoverElement = null
  }
  function clickElement () {
    if (inputType.value === 'mouse') {
      unhoverLastElement()
      cb()
      return
    }

    // hover touch
    if (lastHoverElement === hoverUpdate) {
      unhoverLastElement()
      cb()
    } else {
      hoverElement()
    }
  }
  node.addEventListener('wheel', e => {
    if (inputType.value !== 'mouse') return
    // cheap way to update hover state on scroll
    if (document.elementsFromPoint(e.clientX + e.deltaX, e.clientY + e.deltaY).includes(node)) {
      hoverElement()
    } else {
      unhoverLastElement()
    }
  }, { passive: true, signal: ctrl.signal })
  node.tabIndex = 0
  node.role = 'button'
  node.addEventListener('pointerenter', () => {
    if (inputType.value === 'touch') return
    if (inputType.value === 'mouse') {
      cleanupTimer()
      hoverTimer = setTimeout(hoverElement, HOVER_TIME)
    } else {
      hoverElement()
    }
  }, ctrl)
  node.addEventListener('click', e => {
    e.stopPropagation()
    if (inputType.value === 'dpad') return
    clickElement()
  }, ctrl)
  node.addEventListener('keydown', (e: KeyboardEvent) => {
    if (inputType.value !== 'dpad') return
    if (e.key === 'Enter') {
      e.stopPropagation()
      clickElement()
    }
  }, ctrl)
  node.addEventListener('pointerleave', () => {
    if (inputType.value === 'touch') return
    unhoverLastElement()
  }, ctrl)
  node.addEventListener('pointercancel', () => {
    unhoverLastElement()
  }, ctrl)
  node.addEventListener('pointermove', (e) => {
    if (inputType.value === 'touch') {
      if (Math.abs(e.movementY) > 0) {
        unhoverLastElement()
      }
    } else if (inputType.value === 'mouse' && hoverTimer) {
      cleanupTimer()
      hoverTimer = setTimeout(hoverElement, HOVER_TIME)
    }
  }, ctrl)
  node.addEventListener('drag', () => {
    unhoverLastElement()
  }, ctrl)
  node.addEventListener('contextmenu', e => {
    e.preventDefault()
    clickElement()
  }, ctrl)

  return {
    destroy: () => {
      cleanupTimer()
      ctrl.abort()
    }
  }
}

interface ElementPosition { element: HTMLElement, x: number, y: number, inViewport: boolean, fullyVisible: boolean, rect: DOMRect }

type Direction = 'up' | 'right' | 'down' | 'left'

// const InverseDirections = { up: 'down', down: 'up', left: 'right', right: 'left' }
const DirectionKeyMap: Record<'ArrowDown' | 'ArrowUp' |'ArrowLeft' | 'ArrowRight', Direction> = { ArrowDown: 'down', ArrowUp: 'up', ArrowLeft: 'left', ArrowRight: 'right' }

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
  const rect = element.getBoundingClientRect()
  const inViewport = isInViewport(rect)
  const fullyVisible = inViewport ? isFullyVisible(element, rect) : false
  return { element, x: rect.x + rect.width * 0.5, y: rect.y + rect.height * 0.5, inViewport, fullyVisible, rect }
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
    if (position.fullyVisible) elements.push(position)
  }
  return elements
}

/**
 * Checks if an element is within the viewport.
 */
function isInViewport ({ top, left, bottom, right, width, height }: { top: number, left: number, bottom: number, right: number, width: number, height: number }) {
  return top + height >= 0 && left + width >= 0 && bottom - height <= window.innerHeight && right - width <= window.innerWidth
}

/**
 * Check if an element is clipped by any overflow parent containers.
 */
function isFullyVisible (el: HTMLElement, rect: DOMRect): boolean {
  let parent = el.parentElement
  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent)
    if (style.overflow !== 'visible') {
      const parentRect = parent.getBoundingClientRect()
      if (
        rect.top < parentRect.top ||
        rect.left < parentRect.left ||
        rect.bottom > parentRect.bottom ||
        rect.right > parentRect.right
      ) {
        return false
      }
    }
    parent = parent.parentElement
  }

  return true
}

// function isVisible ({ top, left, bottom, right }, element) {
//   for (const [x, y] of [[left, top], [right, top], [left, bottom], [right, bottom]]) {
//     if (document.elementFromPoint(x, y)?.isSameNode(element)) return true
//   }
//   return false
// }

function getElementsInDesiredDirection (keyboardFocusable: ElementPosition[], currentElement: ElementPosition, direction: string): ElementPosition[] {
  const { rect: currentRect } = currentElement
  return keyboardFocusable.filter(position => {
    if (position.element === currentElement.element) return false
    if (position.inViewport && !position.element.checkVisibility()) return false
    if (!position.inViewport && direction === 'right') return false

    const { rect: candidateRect } = position
    switch (direction) {
      case 'right': return candidateRect.right > currentRect.right
      case 'left': return candidateRect.left < currentRect.left
      case 'down': return candidateRect.bottom > currentRect.bottom
      case 'up': return candidateRect.top < currentRect.top
      default: return false
    }
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

  if (!document.activeElement || document.activeElement === document.body) return focusElement((keyboardFocusable.find(({ element }) => element.checkVisibility()) ?? keyboardFocusable[0])?.element)

  const currentElement = getElementPosition(document.activeElement as HTMLElement)

  if (inInputEl(currentElement.element)) {
    const input = currentElement.element
    if (direction === 'left' && input.selectionStart !== 0) return
    if (direction === 'right' && input.selectionEnd !== input.value.length) return
  }

  e.preventDefault()
  e.stopPropagation()

  // allow overrides via data attributes ex: <div data-up="#id, #id2"?> but order them, as querySelectorAll returns them in order of appearance rather than order of selectors
  // TODO: re-enable after testing
  // for (const selector of currentElement.element.dataset[direction]?.split(',') ?? []) {
  //   const element = document.querySelector<HTMLElement>(selector.trim())
  //   if (!element) continue // skip if no element found
  //   if (!element.checkVisibility()) continue // skip elements that are not visible
  //   if (focusElement(element)) return
  // }

  const elementsInDesiredDirection = getElementsInDesiredDirection(keyboardFocusable, currentElement, direction)

  if (elementsInDesiredDirection.length) {
    const { rect: currentRect } = currentElement
    const isHorizontal = direction === 'left' || direction === 'right'

    const scored = elementsInDesiredDirection.map(position => {
      const { rect: candidateRect } = position

      let overlap: number
      let distance: number

      if (isHorizontal) {
        const overlapTop = Math.max(currentRect.top, candidateRect.top)
        const overlapBottom = Math.min(currentRect.bottom, candidateRect.bottom)
        overlap = Math.max(0, overlapBottom - overlapTop)
        distance = direction === 'right'
          ? candidateRect.left - currentRect.right
          : currentRect.left - candidateRect.right
      } else {
        const overlapLeft = Math.max(currentRect.left, candidateRect.left)
        const overlapRight = Math.min(currentRect.right, candidateRect.right)
        overlap = Math.max(0, overlapRight - overlapLeft)
        distance = direction === 'down'
          ? candidateRect.top - currentRect.bottom
          : currentRect.top - candidateRect.bottom
      }

      return { element: position.element, distance, overlap: overlap > 0, fallbackDistance: getDistance(currentElement, position) }
    })

    const overlapping = scored.filter(s => s.overlap)
    const best = overlapping.length
      ? overlapping.sort((a, b) => a.distance - b.distance)[0]!
      : scored.sort((a, b) => a.fallbackDistance - b.fallbackDistance)[0]!

    focusElement(best.element)
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

window.addEventListener('keydown', navigate)

let repeatCount = 0

export function navigate (e: KeyboardEvent) {
  if (e.key in DirectionKeyMap) {
    // slow down, so its not as jarring
    repeatCount = e.repeat ? ++repeatCount % 8 : 0
    e.preventDefault()
    if (repeatCount) return
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

  // never implement this, it breaks touch interactions on custom click and hoverclick
  // node.addEventListener('pointerdown', e => {
  //   if (e.pointerType !== 'mouse') return
  //   e.stopImmediatePropagation()
  //   e.stopPropagation()
  //   node.setPointerCapture(e.pointerId)
  // })

  // node.addEventListener('pointerup', e => {
  //   node.releasePointerCapture(e.pointerId)
  // })

  return { destroy: () => ctrl.abort() }
}

export function customDoubleClick (node: HTMLElement, { double, single = _ => {}, condition = true, delay = 250 }: { condition?: boolean, double: (_: PointerEvent) => unknown, single?: (_: PointerEvent) => unknown, delay?: number }) {
  const ctrl = new AbortController()
  let _condition = condition
  let dblTimer: ReturnType<typeof setTimeout> | null = null

  node.addEventListener('click', e => {
    if (!_condition || e.button !== 0) return
    if (dblTimer) {
      clearTimeout(dblTimer)
      dblTimer = null
      double(e)
    } else {
      dblTimer = setTimeout(() => {
        dblTimer = null
        single(e)
      }, delay)
    }
  }, ctrl)

  return {
    destroy: () => {
      dblTimer && clearTimeout(dblTimer)
      ctrl.abort()
    },
    update: ({ condition: newCondition = true }: { condition?: boolean, cb: (_: PointerEvent) => unknown, single?: (_: PointerEvent) => unknown, delay?: number }) => { _condition = newCondition }
  }
}
