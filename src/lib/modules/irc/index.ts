import Client, { createChannelConstructor } from '@thaunknown/web-irc'
import { writable } from 'simple-store-svelte'
import { toast } from 'svelte-sonner'

// import { decryptMessage, encryptMessage } from './crypt'

import type IrcChannel from '@thaunknown/web-irc/channel'
import type IrcClient from '@thaunknown/web-irc/client'
import type { EventEmitter } from 'events'

import { page } from '$app/state'
import { MessageToast, type ChatMessage, type ChatUser } from '$lib/components/ui/chat'

export const prevAgreed = writable(false)

export type UserType = 'al' | 'guest'
export interface IRCChatUser {
  nick: string
  id: string
  pfpid: string
  prefix: string
  ext: string
  type: UserType
}
const EXT_MAP: Record<string, string> = { j: 'jpg', p: 'png', w: 'webp', g: 'gif' }

export function getPFP (user: Pick<IRCChatUser, 'id' | 'pfpid' | 'type' | 'prefix' | 'ext'>) {
  if (user.type === 'al' && user.id && user.pfpid && user.prefix && user.ext) {
    return `https://s4.anilist.co/file/anilistcdn/user/avatar/large/${user.prefix}${user.id}-${user.pfpid}.${user.ext}`
  }
  return 'https://s4.anilist.co/file/anilistcdn/user/avatar/medium/default.png'
}

export interface IRCUser { nick: string, ident: string, hostname: string, modes: string[], tags: object }
export interface PrivMessage {
  from_server: boolean
  nick: string
  ident: string
  hostname: string
  target: string
  message: string
  outgoing?: boolean
  tags: {
    msgid: string
    time: string
  }
  time: number
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type IRCEvents = {
  userlist: [{ users: IRCUser[] }]
  join: [IRCUser]
  part: [IRCUser]
  quit: [IRCUser]
  kick: [IRCUser]
  privmsg: [PrivMessage]
  connected: []
}

function ircUserToChatUser ({ id, pfpid, type, nick, prefix, ext }: IRCChatUser): ChatUser {
  return { id, avatar: { large: getPFP({ id, pfpid, type, prefix, ext }) }, name: nick }
}

function ircIdentToChatUser (user: IRCUser): ChatUser {
  const [pfp, ...rest] = user.nick.split('_')
  const [type, id] = user.ident.split('_')
  const nick = rest.join('_') || user.nick

  if (type !== 'al' || pfp == null) return { id: id ?? '0', avatar: { large: 'https://s4.anilist.co/file/anilistcdn/user/avatar/medium/default.png' }, name: nick }

  const extLetter = pfp[0] ?? ''
  const prefix = pfp[1] ?? ''
  return ircUserToChatUser({ id: id ?? '0', prefix, pfpid: pfp.slice(2), type: 'al', nick, ext: EXT_MAP[extLetter] ?? extLetter })
}

export default class MessageClient {
  irc = new Client(null) as IrcClient & EventEmitter<IRCEvents>
  users = writable<Record<string, ChatUser>>({})
  messages = writable<ChatMessage[]>([])
  channel?: IrcChannel
  ident

  constructor (ident: IRCChatUser) {
    this.ident = ident
    this.irc.on('userlist', async ({ users }) => {
      this.users.value = users.reduce((acc, ircuser) => {
        const user = ircIdentToChatUser(ircuser)
        acc[ircuser.ident] = user
        return acc
      }, this.users.value)
    })

    this.irc.on('join', async ircuser => {
      try {
        const user = ircIdentToChatUser(ircuser)
        this.users.value[ircuser.ident] = user
        this.users.update(users => users)
      } catch (error) {
        console.error(error)
      }
    })

    const deleteUser = (user: IRCUser) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this.users.value[user.ident]
      this.users.update(users => users)
    }
    this.irc.on('quit', deleteUser)
    this.irc.on('part', deleteUser)
    this.irc.on('kick', deleteUser)

    this.irc.on('privmsg', async priv => {
      try {
        // const message = await decryptMessage(priv.message)
        const msg: ChatMessage = {
          message: priv.message,
          user: this.users.value[priv.ident]!,
          type: 'incoming',
          date: priv.time ? new Date(priv.time) : new Date()
        }

        if (page.route.id !== '/app/chat' && !msg.user.name.startsWith('Guest-')) {
          // @ts-expect-error using svelte 4 components in s5
          toast.custom(MessageToast, {
            classes: { toast: '!bg-transparent w-full !shadow-none h-auto flex' },
            componentProps: { msg }
          })
        }
        this.messages.update(messages => [...messages, msg].slice(-150))
      } catch (e) {
        // some1 sent a message without encryption
        console.error(e)
      }
    })
  }

  async say (message: string) {
    // const encrypted = await encryptMessage(message)
    this.channel!.say(message)
    this.messages.update(messages => [...messages, {
      user: ircUserToChatUser(this.ident),
      message,
      date: new Date(),
      type: 'outgoing' as const
    }].slice(-150))
  }

  static async new ({ nick, id, pfpid, type, prefix, ext }: IRCChatUser) {
    const client = new this({ nick, id, pfpid, type, prefix, ext })

    await new Promise<void>(resolve => {
      client.irc.once('connected', resolve)
      client.irc.connect({
        version: null,
        enable_chghost: true,
        enable_setname: true,
        message_max_length: 350,
        host: 'irc.rizon.net',
        port: 6697,
        tls: true,
        path: '',
        password: '',
        account: {},
        nick: `${ext[0]}${prefix}${pfpid}_${nick.replace('.', '')}`,
        username: `${type}_${id}`,
        gecos: 'https://kiwiirc.com/',
        encoding: 'utf8',
        auto_reconnect: true,
        transport: createChannelConstructor('http://do-e.clients.kiwiirc.com/webirc/kiwiirc/', '', '1') // this people are dumb enough to not refresh the ssl cert so don't use https
      })
    })

    await new Promise(resolve => {
      client.irc.once('join', resolve)
      client.channel = client.irc.channel('#4e63ad91532eb8849330')
    })
    return client
  }

  destroy () {
    this.irc.removeAllListeners()
    this.irc.connection?.end()
  }
}
