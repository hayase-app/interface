import { releaseProxy, type Remote } from 'abslink'
import { wrap } from 'abslink/w3c'
import Debug from 'debug'
import { set, getMany, delMany, del } from 'idb-keyval'
import { get } from 'svelte/store'
import { persisted } from 'svelte-persisted-store'
import { toast } from 'svelte-sonner'

import Worker from './worker?worker'

import type { ExtensionConfig } from './types'
import type extensionLoader from './worker'

const debug = Debug('ui:extensions')

type SavedExtensions = Record<ExtensionConfig['id'], ExtensionConfig>

type ExtensionsOptions = {
  [K in keyof SavedExtensions]: {
    // this is bad, but w/e
    options: Record<string, never>
    enabled: boolean
  }
}

// Usage:
export const saved = persisted<SavedExtensions>('extensions', {})
export const options = persisted<ExtensionsOptions>('extensionoptions', {})

// `http${string}` | `gh:${string}` | `npm:${string}`
// http[s]://[url] -> http[s]://[url]
// gh:[username]/[repo]/[path] -> https://esm.sh/[username]/[repo]/es2022/[path].mjs
// npm:[package]/[path] -> https://esm.sh/[package]/es2022/[path].mjs

const jsonurl = (url: string) => {
  if (url.startsWith('http')) return url
  const { pathname, protocol } = new URL(url)

  if (protocol !== 'gh:' && protocol !== 'npm:') throw new Error('Invalid URL')

  const processed = `https://esm.sh${protocol === 'gh:' ? '/gh' : ''}/${pathname}`

  if (processed.endsWith('.json')) return processed
  return `${processed}/index.json`
}

const jsurl = (url: string) => {
  if (url.startsWith('http')) return url
  const parsedUrl = new URL(url)

  if (parsedUrl.protocol === 'gh:') {
    const [username, repo, ...pathParts] = parsedUrl.pathname.split('/')
    const path = pathParts.join('/')
    return `https://esm.sh/gh/${username}/${repo}/es2022/${path}.mjs`
  } else if (parsedUrl.protocol === 'npm:') {
    const [pkg, ...pathParts] = parsedUrl.pathname.split('/')
    const path = pathParts.join('/')
    return `https://esm.sh/${pkg}/es2022/${path}.mjs`
  }
  throw new Error('Invalid URL')
}

const safejson = async <T> (url: string): Promise<T | null> => {
  try {
    const res = await fetch(jsonurl(url))
    return await res.json()
  } catch (e) {
    return null
  }
}

const safejs = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(jsurl(url))
    return await res.text()
  } catch (e) {
    return null
  }
}

export const storage = new class Storage {
  modules!: Promise<Record<string, string>>
  workers: Record<string, Remote<typeof extensionLoader>> = {}

  constructor () {
    saved.subscribe(async value => {
      debug('saved extensions changed', value)
      this.modules = this.load(value)
      await this.modules
      this.update(value)
    })
  }

  async reload () {
    debug('reloading extensions')
    for (const worker of Object.values(this.workers)) {
      worker[releaseProxy]()
    }
    this.workers = {}
    this.modules = this.load(get(saved))
  }

  async delete (id: string) {
    debug('deleting extension', id)
    if (id in this.workers) this.workers[id]![releaseProxy]()
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this.workers[id]
    await del(id)
    saved.update(value => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete value[id]
      return value
    })
  }

  async import (url: string) {
    debug('importing extension from', url)
    const config = await safejson<ExtensionConfig[]>(url)
    if (!config) throw new Error('Make sure the link you provided is a valid JSON config for Hayase', { cause: 'Invalid extension URI' })
    for (const c of config) {
      if (!this._validateConfig(c)) throw new Error('Make sure the link you provided is a valid extension config for Hayase', { cause: 'Invalid extension config' })
    }
    debug('imported config', config)
    for (const c of config) {
      saved.update(value => {
        value[c.id] = c
        return value
      })
    }
  }

  async load (config: Record<string, ExtensionConfig>) {
    const ids = Object.keys(config)
    const values = await getMany<string>(ids)

    const modules: Record<string, string> = {}

    debug('loading extensions', ids)

    options.update(options => {
      for (const id of ids) {
        if (!(id in options)) {
          options[id] = { options: {}, enabled: true }
        }
      }
      return options
    })

    for (let i = 0; i < ids.length; i++) {
      const module = values[i]
      const id = ids[i]!

      if (module) {
        modules[id] = module
      } else {
        debug('loading module', id)
        const module = await safejs(config[id]!.code)
        if (!module) continue
        modules[id] = module
        set(id, module)
      }
      if (!(id in this.workers)) {
        debug('creating worker for', id)
        const worker = new Worker({ name: id })
        const Loader = wrap<typeof extensionLoader>(worker)
        try {
          await Loader.construct(modules[id])
          this.workers[id] = Loader as unknown as Remote<typeof extensionLoader>
          await Loader.test()
        } catch (e) {
          debug('failed to load extension', id, e)
          // worker.terminate()
          console.error(e, id)
          toast.error(`Failed to load extension ${config[id]!.name}`, { description: (e as Error).message })
        }
      }
    }
    return modules
  }

  async update (config: Record<string, ExtensionConfig>) {
    const ids = Object.keys(config)
    const configs = Object.values(config)
    debug('updating extensions', ids)

    const updateURLs = new Set<string>(configs.map(({ update }) => update).filter(e => e != null))

    const values = await Promise.all([...updateURLs].map(url => safejson<ExtensionConfig[]>(url)))
    if (!values.filter(e => e).length) return
    const newconfig: Record<string, ExtensionConfig> = Object.fromEntries((values.flat().filter(f => this._validateConfig(f) && ids.includes(f!.id)) as ExtensionConfig[]).map((config) => [config.id, config]))

    const toDelete = ids.filter(id => newconfig[id]?.version !== config[id]!.version)
    if (toDelete.length) {
      debug('deleting old extensions', toDelete)
      await delMany(toDelete)
      for (const id of toDelete) {
        if (id in this.workers) {
          this.workers[id]![releaseProxy]()
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete this.workers[id]
        }
      }
      saved.set(newconfig)
      this.modules = this.load(newconfig)
    }
  }

  _validateConfig (config: Partial<ExtensionConfig> | null): boolean {
    if (!config) return false
    const properties: Array<keyof ExtensionConfig> = ['name', 'version', 'id', 'type', 'accuracy', 'icon', 'update', 'code']

    return properties.every(prop => prop in config)
  }
}()
