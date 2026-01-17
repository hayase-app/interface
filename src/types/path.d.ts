declare module 'path' {
  export function resolve(...paths: string[]): string
  export function join(...paths: string[]): string
  export function basename(path: string, ext?: string): string
}

declare module 'node:path' {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  import path = require('path')
  export = path
}
