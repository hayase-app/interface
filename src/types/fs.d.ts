declare module 'fs' {
  export const writeFileSync: (
    file: string | URL,
    data: string | Uint8Array,
    options?: { encoding?: string, mode?: number, flag?: string }
  ) => void

  export const readFileSync: (
    file: string | URL,
    options?: { encoding?: string, flag?: string }
  ) => string | Uint8Array
}

declare module 'node:fs' {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  import path = require('fs')
  export = path
}

declare module 'node:fs/promises' {
  export function readdir(path: string | URL): Promise<string[]>
  export function readFile(path: string | URL, options?: { encoding?: string, flag?: string } | string): Promise<string | Uint8Array>
  export function writeFile(path: string | URL, data: string | Uint8Array, options?: { encoding?: string, mode?: number, flag?: string } | string): Promise<void>
  export function glob(pattern?: string): AsyncIterable<string>
}
