import { releaseProxy, type Remote } from 'abslink'
import { wrap } from 'abslink/w3c'
import Debug from 'debug'
import { set, getMany } from 'idb-keyval'
import { get } from 'svelte/store'
import { persisted } from 'svelte-persisted-store'
import { toast } from 'svelte-sonner'

import native from '../native.ts'

import Worker from './worker?worker'

import type { ExtensionConfig } from './types'
import type extensionLoader from './worker'

const debug = Debug('ui:extensions')

type ExtensionID = string

type SavedExtensions = Record<ExtensionID, ExtensionConfig>

type ExtensionsOptions = {
  [K in keyof SavedExtensions]: {
    // this is bad, but w/e
    options: Record<string, never>
    enabled: boolean
  }
}

// Usage:
export const savedConfigs = persisted<SavedExtensions>('extensions', {})
export const savedOptions = persisted<ExtensionsOptions>('extensionoptions', {})

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
class CodeManager {
  extensions: Map<ExtensionID, Remote<typeof extensionLoader>> = new Map<ExtensionID, Remote<typeof extensionLoader>>()

  async delete (id: ExtensionID) {
    debug('Deleting extension', id)
    if (this.extensions.has(id)) {
      await this.extensions.get(id)![releaseProxy]()
      this.extensions.delete(id)
      debug('Extension deleted', id)
    } else {
      debug('Extension not found for delete', id)
    }
  }

  async initiate (configs: ExtensionConfig[]) {
    debug('Initiating extensions', configs.map(c => c.id))
    const configIDs = configs.map(c => c.id)
    const urls = configs.filter(c => !!c.url).map(c => atob(c.url!))
    await this.enableCORS(urls)

    const codeList = await getMany<string>(configIDs)

    const workerPromises = configIDs.map((id, index) => {
      const code = codeList[index]!
      debug('Loading worker for', id)
      return this._loadWorker(code, id)
    })

    await Promise.allSettled(workerPromises)
    debug('All workers initiated')
  }

  async enableCORS (urls: string[]) {
    try {
      await native.enableCORS(urls)
      debug('CORS enabled for', urls)
    } catch (error) {
      debug('Failed to enable CORS for', urls, 'error:', error)
    }
  }

  async downloadScripts (configs: ExtensionConfig[], update = false) {
    debug('Downloading scripts', configs.map(c => c.id), 'update:', update)
    const invalidIDs: ExtensionID[] = []

    for (const config of configs) {
      if (this.extensions.has(config.id) && !update) {
        debug('Extension already loaded and not updating, skipping', config.id)
        continue
      }

      const code = await safejs(config.code)
      if (!code) {
        debug('Failed to fetch code for', config.id)
        invalidIDs.push(config.id)
        continue
      }

      try {
        await this._loadWorker(code, config.id)
        set(config.id, code)
        debug('Loaded and cached code for', config.id)
      } catch (e) {
        debug('Failed to load worker for', config.id, e)
        invalidIDs.push(config.id)
      }
    }

    debug('Invalid extension IDs after download', invalidIDs)
    return invalidIDs
  }

  async _loadWorker (code: string, id: string) {
    debug('Creating worker for', id)
    const Loader = wrap<typeof extensionLoader>(new Worker({ name: id })) as unknown as Remote<typeof extensionLoader>

    try {
      await Loader.construct(code)
      await Loader.loaded()
      if (this.extensions.has(id)) {
        debug('Releasing previous worker for', id)
        await this.extensions.get(id)![releaseProxy]()
      }
      this.extensions.set(id, Loader)
      debug('Worker loaded and set for', id)
      try {
        const testResult = await Promise.race([Loader.test(), new Promise((resolve, reject) => setTimeout(() => reject(new Error('Extension check timed out.')), 5000))])
        debug('Worker test passed for', id, testResult)
      } catch (e) {
        debug('Worker test failed for', id, e)
        if (get(savedOptions)[id]?.enabled) {
          toast.error(`Extension ${id} Failed to load!`, { description: (e as Error).message })
        }
      }
    } catch (e) {
      debug('Error loading worker for', id, e)
      await Loader[releaseProxy]()
      throw e
    }
  }
}

export const storage = new class ConfigManager {
  codeManager = new CodeManager()
  ready = this.codeManager.initiate(Object.values(get(savedConfigs)))

  constructor () {
    this.update()
  }

  _validateConfig (config: Partial<ExtensionConfig> | null): boolean {
    const valid = !!config && ['name', 'version', 'id', 'type', 'accuracy', 'icon', 'update', 'code'].every(prop => prop in (config ?? {}))
    debug('_validateConfig', config, 'result:', valid)
    return valid
  }

  _ensureOptions (ids: ExtensionID[], enabled = true) {
    debug('_ensureOptions for', ids, 'enabled:', enabled)
    savedOptions.update(options => {
      for (const id of ids) {
        if (!(id in options)) {
          options[id] = { options: {}, enabled }
        }
      }
      return options
    })
  }

  _updateSaved (configs: ExtensionConfig[]) {
    debug('_updateSaved', configs.map(c => c.id))
    savedConfigs.update(value => {
      const newConfigs = { ...value }
      for (const c of configs) {
        newConfigs[c.id] = c
      }
      this.codeManager.enableCORS(Object.values(newConfigs).filter(c => !!c.url).map(c => atob(c.url!)))
      return newConfigs
    })
  }

  configs () {
    const configs = get(savedConfigs)
    debug('configs()', configs)
    return configs
  }

  // handles user input, needs validation
  async import (url: string) {
    debug('Importing extension config from', url)
    const config = await safejson<ExtensionConfig[]>(url)
    if (!config) {
      debug('Import failed: invalid JSON config', url)
      throw new Error('Make sure the link you provided is a valid JSON config for Hayase', { cause: 'Invalid extension URI' })
    }

    const attemptedOverrides: string[] = []
    const validConfigs: ExtensionConfig[] = []
    for (const c of config) {
      if (!this._validateConfig(c)) {
        debug('Invalid extension config found during import', c)
        throw new Error('Make sure the link you provided is a valid extension config for Hayase', { cause: 'Invalid extension config' })
      }

      if (c.id in this.configs()) {
        debug('Extension already exists, will not import', c.id)
        attemptedOverrides.push(c.id)
      } else {
        validConfigs.push(c)
      }
    }

    const urls = validConfigs.filter(c => !!c.url).map(c => atob(c.url!))
    await this.codeManager.enableCORS(urls)

    const invalidExtensions = await this.codeManager.downloadScripts(validConfigs)

    const validExtensions = validConfigs.filter(c => !invalidExtensions.includes(c.id))
    this._ensureOptions(validExtensions.map(c => c.id))

    this._updateSaved(validExtensions)

    debug('Import complete')
    if (attemptedOverrides.length) {
      debug('Attempted to override existing extensions', attemptedOverrides)
      throw new Error(`The following extensions already exist and were not imported: \n\n${attemptedOverrides.join(', ')}\n\nIf you want to override them, please delete the existing extensions first.`, { cause: 'Extension Already Exists!' })
    }
  }

  async delete (id: ExtensionID) {
    debug('Deleting extension from storage', id)
    await this.codeManager.delete(id)
    savedConfigs.update(configs => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete configs[id]
      return configs
    })
    savedOptions.update(options => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete options[id]
      return options
    })
    debug('Extension deleted from storage', id)
  }

  async update () {
    await this.ready
    debug('Updating extensions')
    const currentConfigs = this.configs()
    const updateURLs = new Set<string>(Object.values(currentConfigs).map(({ update }) => update).filter(e => e != null))

    const newConfigs = (await Promise.all([...updateURLs].map(url => safejson<ExtensionConfig[]>(url)))).filter(e => !!e).flat()

    // valid config, same update link, different version
    const safeToUpdate = newConfigs.filter(f => this._validateConfig(f) && currentConfigs[f.id]?.update === f.update && f.version !== currentConfigs[f.id]?.version)

    debug('Extensions safe to update', safeToUpdate.map(f => f.id))
    const invalidExtensions = await this.codeManager.downloadScripts(safeToUpdate, true)

    const validExtensions = safeToUpdate.filter(c => !invalidExtensions.includes(c.id))
    this._ensureOptions(validExtensions.map(c => c.id), false)

    this._updateSaved(validExtensions)
    debug('Update complete')
  }
}()
