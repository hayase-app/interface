import type { Transport } from '@sveltejs/kit/hooks'

const files = new Map<number, File>()
let nextFileId = 0

export const transport: Transport = {
  File: {
    encode: (value: unknown) => {
      if (!(value instanceof File)) return false
      const id = ++nextFileId
      files.set(id, value)
      return id
    },
    decode: (id: number) => files.get(id)
  }
}
