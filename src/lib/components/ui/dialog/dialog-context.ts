import type { Writable } from 'svelte/store'

export const DIALOG_KEY = Symbol('dialog-key')

export interface DialogContext {
  open: Writable<boolean>
  portal: string | HTMLElement
  openDialog: () => void
  closeDialog: () => void
}
