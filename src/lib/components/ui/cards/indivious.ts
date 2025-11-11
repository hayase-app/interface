interface IndiviousResponseClass {
  flag?: string
  region?: string
  stats?: Stats | null
  cors?: boolean | null
  api?: boolean | null
  type?: string
  uri?: string
  monitor?: Monitor | null
}

interface Monitor {
  token?: string
  url?: string
  type?: string
  alias?: string
  uptime?: number
  down?: boolean
  down_since?: null
  up_since?: Date
  error?: null
  period?: number
  string_match?: string
  enabled?: boolean
  published?: boolean
  recipients?: string[]
  last_check_at?: Date
  next_check_at?: Date
  created_at?: Date
  mute_until?: null | string
  last_status?: number
  apdex_t?: number
  disabled_locations?: unknown[]
  custom_headers?: unknown
  favicon_url?: string
  http_verb?: string
  http_body?: string
  ssl?: SSL
  domain?: Domain
}

interface Domain {
  tested_at?: Date
  expires_at?: Date
  remaining_days?: number
  source?: string
}

interface SSL {
  tested_at?: Date
  expires_at?: Date
  valid?: boolean
  error?: null
}

interface Stats {
  version?: string
  software?: Software
  openRegistrations?: boolean
  usage?: Usage
  metadata?: Metadata
  playback?: Playback
}

interface Metadata {
  updatedAt?: number
  lastChannelRefreshedAt?: number
}

interface Playback {
  totalRequests?: number
  successfulRequests?: number
  ratio?: number
}

interface Software {
  name?: string
  version?: string
  branch?: string
}

interface Usage {
  users?: Users
}

interface Users {
  total?: number
  activeHalfyear?: number
  activeMonth?: number
}

const KNOWN_BAD_INSTANCES = [
  'invidious.nerdvpn.de', // validates session id, so gives perm error
  'inv.perditum.com', // cookie based ORB errors
  'yewtu.be' // also ORB
]

let cachedGoodInstances: string[] | null = null

async function getInstances (): Promise<string[]> {
  if (cachedGoodInstances) return cachedGoodInstances

  const res = await fetch('https://api.invidious.io/instances.json?sort_by=type,health')
  const json = await res.json() as Array<[string, IndiviousResponseClass]>
  const filtered = json.filter(([url, { type }]) => type === 'https' && !KNOWN_BAD_INSTANCES.includes(url))
  const instances = filtered.map(([url]) => url)

  cachedGoodInstances = instances
  return instances
}

export async function createSourceList (id: string) {
  const instances = await getInstances()

  if (instances.length === 0) return []

  return instances.map((uri) => `https://${uri}/companion/latest_version?id=${id}&itag=18`)
}
