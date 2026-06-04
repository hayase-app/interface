export { default as Extensions } from './extensions.svelte'
export { default as InstallPrompt } from './ExtensionInstallPrompt.svelte'
export { extensionInstalURL } from './ExtensionInstallPrompt.svelte'

export function sanitizeExtensionUrl (url: string): string {
  if (url.startsWith('https:/') && !url.startsWith('https://')) {
    url = 'https://' + url.slice(7)
  } else if (url.startsWith('http:/') && !url.startsWith('http://')) {
    url = 'http://' + url.slice(6)
  }
  return url.replace(/\/+$/, '')
}
