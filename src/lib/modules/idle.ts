import { writable } from 'simple-store-svelte'
import { readable } from 'svelte/store'

export const activityState = readable<'active' | 'inactive'>(document.hasFocus() ? 'active' : 'inactive', set => {
  set(document.hasFocus() ? 'active' : 'inactive')
  const ctrl = new AbortController()

  window.addEventListener('pointermove', () => set('active'), ctrl)
  window.addEventListener('focus', () => set('active'), ctrl)
  window.addEventListener('blur', () => set('inactive'), ctrl)

  document.addEventListener('mouseenter', () => set('active'), ctrl)
  document.addEventListener('mouseleave', () => {
    if (!document.hasFocus()) set('inactive')
  }, ctrl)
  return () => ctrl.abort()
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let idleDetector: any = { userState: 'active', screenState: 'unlocked' }
try {
  // @ts-expect-error non-standard API
  idleDetector = typeof IdleDetector !== 'undefined' && new IdleDetector()
  if (idleDetector) {
    idleDetector.start({ threshold: 60_000 }).catch((error: Error) => {
      console.warn(error)
    })
  }
} catch (error) {
  console.warn(error)
}

export const idleState = readable<'active' | 'idle'>(idleDetector.userState, set => {
  if (!idleDetector) return set('active')
  set(idleDetector.userState)
  const ctrl = new AbortController()

  idleDetector.addEventListener('change', () => set(idleDetector.userState), ctrl)
  window.addEventListener('pointermove', () => set('active'), ctrl)

  return () => ctrl.abort()
})

export const lockedState = readable<'locked' | 'unlocked'>(idleDetector.screenState, set => {
  if (!idleDetector) return set('unlocked')
  set(idleDetector.screenState)
  const ctrl = new AbortController()

  idleDetector.addEventListener('change', () => set(idleDetector.screenState), ctrl)

  return () => ctrl.abort()
})

export const isPlaying = writable(false)
