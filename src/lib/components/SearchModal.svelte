<script lang='ts' context='module'>
  /* eslint-disable no-self-assign */
  import BadgeCheck from 'lucide-svelte/icons/badge-check'
  import Download from 'svelte-radix/Download.svelte'
  import File from 'svelte-radix/File.svelte'
  import MagnifyingGlass from 'svelte-radix/MagnifyingGlass.svelte'

  import { SingleCombo } from './ui/combobox'
  import { Input } from './ui/input'

  import type { AnitomyResult } from 'anitomyscript'

  import * as Dialog from '$lib/components/ui/dialog'
  import { title } from '$lib/modules/anilist'
  import { type ExtensionError, extensions, type StreamedTorrentResult } from '$lib/modules/extensions/extensions'
  import { click, dragScroll } from '$lib/modules/navigate'
  import { settings, videoResolutions } from '$lib/modules/settings'
  import { breakpoints, cn, colors, fastPrettyBytes, since, transferToFileList } from '$lib/utils'

  const termMapping: Record<string, {text: string, color: string}> = {}
  termMapping['5.1'] = termMapping['5.1CH'] = { text: '5.1', color: '#f67255' }
  termMapping['TRUEHD5.1'] = { text: 'TrueHD 5.1', color: '#f67255' }
  termMapping.AAC = termMapping.AACX2 = termMapping.AACX3 = termMapping.AACX4 = { text: 'AAC', color: '#f67255' }
  termMapping.AC3 = { text: 'AC3', color: '#f67255' }
  termMapping.EAC3 = termMapping['E-AC-3'] = { text: 'EAC3', color: '#f67255' }
  termMapping.FLAC = termMapping.FLACX2 = termMapping.FLACX3 = termMapping.FLACX4 = { text: 'FLAC', color: '#f67255' }
  termMapping.VORBIS = { text: 'Vorbis', color: '#f67255' }
  termMapping.DUALAUDIO = termMapping['DUAL AUDIO'] = { text: 'Dual Audio', color: '#ffcb3b' }
  termMapping['10BIT'] = termMapping['10BITS'] = termMapping['10-BIT'] = termMapping['10-BITS'] = termMapping.HI10 = termMapping.HI10P = { text: '10 Bit', color: '#0c8ce9' }
  termMapping.HI444 = termMapping.HI444P = termMapping.HI444PP = { text: 'HI444', color: '#0c8ce9' }
  termMapping.HEVC = termMapping.H265 = termMapping['H.265'] = termMapping.X265 = { text: 'HEVC', color: '#0c8ce9' }
  termMapping.AV1 = { text: 'AV1', color: '#0c8ce9' }
  termMapping.BD = termMapping.BDRIP = termMapping.BLURAY = termMapping['BLU-RAY'] = { text: 'BD', color: '#ab1b31' }
  termMapping.DVD5 = termMapping.DVD9 = termMapping['DVD-R2J'] = termMapping.DVDRIP = termMapping.DVD = termMapping['DVD-RIP'] = termMapping.R2DVD = termMapping.R2J = termMapping.R2JDVD = termMapping.R2JDVDRIP = { text: 'DVD', color: '#ab1b31' }
  termMapping.MULTISUB = termMapping['MULTI-SUB'] = termMapping['MULTI SUB'] = termMapping.MULTISUBS = termMapping['MULTI-SUBS'] = termMapping['MULTI SUBS'] = { text: 'Multi Sub', color: '#ffcb3b' }
  // termMapping.HDTV = termMapping.HDTVRIP = termMapping.TVRIP = termMapping['TV-RIP'] = { text: 'TV', color: '#ab1b31' }
  // termMapping.WEBCAST = termMapping.WEBRIP = { text: 'WEB', color: '#ab1b31' }

  function sanitiseTerms ({ video_term: video, audio_term: audio, video_resolution: resolution, source, subtitles }: AnitomyResult) {
    const terms = [...new Set([...video ?? [], ...audio ?? [], ...source ?? [], ...subtitles ?? []].map(term => termMapping[term.toUpperCase() ?? '']).filter(t => t))] as Array<{text: string, color: string}>
    if (resolution.length) terms.unshift({ text: resolution[0]!, color: '#c6ec58' })

    return terms
  }

  function simplifyFilename ({ video_term: video, audio_term: audio, video_resolution: resolution, file_name: name, release_group: group, file_checksum: checksum }: AnitomyResult) {
    let simpleName = name[0]!
    if (group.length) simpleName = simpleName.replace(group[0]!, '')
    if (resolution.length) simpleName = simpleName.replace(resolution[0]!, '')
    if (checksum.length) simpleName = simpleName.replace(checksum[0]!, '')
    for (const term of video ?? []) simpleName = simpleName.replace(term, '')
    for (const term of audio ?? []) simpleName = simpleName.replace(term, '')
    return simpleName.replace(/[[{(]\s*[\]})]/g, '').replace(/\s+/g, ' ').trim()
  }

  function getGroup ({ release_group: group, file_name: name }: AnitomyResult) {
    return group[0] && group[0].length < 20 ? group[0] : /^(?!\[[^\]]*\]).*-(\w+)(?=\s\(|\.\w+$|$)/.exec(name[0] ?? '')?.[1] ?? 'No Group'
  }
</script>

<script lang='ts'>
  import Folder from 'lucide-svelte/icons/folder'
  import { flip } from 'svelte/animate'
  import { quartInOut } from 'svelte/easing'

  import ProgressButton from './ui/button/progress-button.svelte'
  import { Banner } from './ui/img'

  import type { TorrentResult } from '$lib/modules/extensions/types'

  import { goto } from '$app/navigation'
  import { searchStore } from '$lib'
  import { savedConfigs } from '$lib/modules/extensions'
  import { server } from '$lib/modules/torrent'

  const downloaded = server.downloaded

  $: open = !!$searchStore?.media

  $: searchResGenerator = !!$searchStore?.media && extensions.torrentResults({ media: $searchStore.media, episode: $searchStore.episode, resolution: $settings.searchQuality })

  $: searchResult = searchResGenerator && processResults(searchResGenerator)

  let concatResults: StreamedTorrentResult[] = []
  let errors: ExtensionError[] = []

  async function processResults (iterable: ReturnType<typeof extensions.torrentResults>) {
    concatResults = errors = []
    for await (const { results, error } of iterable) {
      if (iterable !== searchResGenerator) return { results: [], errors: [] }
      concatResults = extensions.dedupe([...concatResults, ...results])
      if (error) {
        errors.push(error)
        errors = errors
      }
    }

    return { results: concatResults, errors }
  }

  function close (state = false) {
    if (!state) {
      searchStore.set(undefined)
      open = false
      inputText = ''
    }
  }

  let inputText = ''

  function play ({ hash, link }: TorrentResult) {
    server.playHash(hash, $searchStore!.media, $searchStore!.episode, link)
    close()
    goto('/#/app/player')
  }

  async function playBest () {
    if (!searchResult) return
    const { results } = await searchResult
    if (!results.length) return
    const best = filterAndSortResults(results, inputText, $downloaded)[0]

    if (best) play(best)
  }

  function filterAndSortResults (results: Array<TorrentResult & { parseObject: AnitomyResult, extension: Set<string> }>, searchText: string, downloaded: Set<string>) {
    const preference = $settings.lookupPreference
    return results
      .filter(({ title }) => title.toLowerCase().includes(searchText.toLowerCase()))
      .sort((a, b) => {
        // pre-emtively sort by deal breaker conditions
        // the higher the rank the worse the result... don't ask
        function getRank (res: typeof results[0]) {
          if (res.accuracy === 'low') return 3
          if (downloaded.has(res.hash)) return 0
          if (res.seeders <= 15) return 2
          if ((res.type === 'best' || res.type === 'alt') && preference === 'quality') return 0
          return 1
        }

        const rankA = getRank(a)
        const rankB = getRank(b)
        if (rankA !== rankB) return rankA - rankB
        if (rankA === 1) {
          const scoreA = a.accuracy === 'high' ? 1 : 0
          const scoreB = b.accuracy === 'high' ? 1 : 0
          const diff = scoreB - scoreA
          if (diff !== 0) return diff

          // sort by preference, quality is sorted in rank, so quality and seeders is both as seeders here.
          if (preference === 'size') return a.size - b.size
          return b.seeders - a.seeders
        }
        return 0
      })
  }

  let animating = false

  async function startAnimation (searchRes: typeof searchResult) {
    if (!$settings.searchAutoSelect) return
    animating = false
    const results = await searchRes
    if (searchRes === searchResult && results && results.results.length) animating = true
  }

  function stopAnimation () {
    animating = false
  }

  const torrentRx = /(^magnet:){1}|(^[A-F\d]{8,40}$){1}|(.*\.torrent$){1}/i

  function findTorrentIdentifiers (identifier: string) {
    if (torrentRx.test(identifier) && $searchStore) {
      server.playIdentifier(identifier, $searchStore.media, $searchStore.episode)
      close()
      goto('/#/app/player')
    }
  }

  $: findTorrentIdentifiers(inputText)

  $: searchResult && startAnimation(searchResult)

  $: ({ r, g, b } = colors($searchStore?.media.coverImage?.color ?? undefined))

  async function handleTransfer (e: { dataTransfer?: DataTransfer | null, clipboardData?: DataTransfer | null } & Event) {
    if ($searchStore) {
      for (const file of await transferToFileList(e)) {
        if (file instanceof Blob) {
          if (file.type === 'application/x-bittorrent' || file.name.endsWith('.torrent')) {
            server.playIdentifier(new Uint8Array(await file.arrayBuffer()), $searchStore.media, $searchStore.episode)
            close()
            goto('/#/app/player')
          }
        } else if (file.type === 'text/plain') {
          findTorrentIdentifiers(file.text)
        }
      }
    }
  }
</script>

<svelte:window on:drop={handleTransfer} on:paste={handleTransfer} />

<Dialog.Root bind:open onOpenChange={close} portal='#episodeListTarget'>
  <Dialog.Content class='bg-background h-full max-w-5xl w-full max-h-[calc(100%-1rem)] border-b-0 !rounded-b-none mt-2 p-0 items-center flex-col flex lg:rounded-t-xl overflow-clip z-[100] gap-0'>
    <!-- this hacky thing is required for dialog root focus trap... pitiful -->
    <div class='size-0' tabindex='0' />
    {#if $searchStore}
      <div class='absolute top-0 left-0 size-full max-h-36 overflow-hidden flex items-end'>
        <Banner media={$searchStore.media} class='object-cover size-full absolute bottom-[0.5px] left-0 -z-10 opacity-40' />
        <div class='w-full h-[70%] bg-gradient-to-t from-background/80 to-transparent' />
      </div>
      <div class='gap-4 w-full relative h-full flex flex-col pt-8' style:--custom={$searchStore.media.coverImage?.color ?? '#fff'} style:--red={r} style:--green={g} style:--blue={b}>
        <div class='px-4 sm:px-6 space-y-4'>
          <div class='font-weight-bold text-2xl font-bold text-ellipsis text-nowrap overflow-hidden'>{title($searchStore.media)}</div>
          <div class='flex items-center relative scale-parent'>
            <Input
              class='pl-9 select:bg-accent select:text-accent-foreground shadow-sm no-scale placeholder:opacity-50'
              placeholder='Filter by text, or paste a magnet link or torrent file here to specify a torrent manually'
              bind:value={inputText} />
            <MagnifyingGlass class='h-4 w-4 shrink-0 opacity-50 absolute left-3 text-muted-foreground z-10 pointer-events-none' />
          </div>
          <div class='flex items-center gap-4 justify-around flex-wrap'>
            <div class='flex items-center space-x-2 grow'>
              <span>Episode</span>
              <Input type='number' inputmode='numeric' pattern='[0-9]*' min='0' max='65536' bind:value={$searchStore.episode} class='w-32 shrink-0 grow' />
            </div>
            <div class='flex items-center space-x-2 grow'>
              <span>Resolution</span>
              <SingleCombo bind:value={$settings.searchQuality} items={videoResolutions} forcePopover={true} portal='#episodeListTarget' class='w-32 shrink-0 grow border-border border' />
            </div>
          </div>
          <ProgressButton
            onclick={playBest}
            size='default'
            class='w-full font-bold bg-custom select:bg-custom-600 text-contrast'
            bind:animating>
            Auto Select Torrent
          </ProgressButton>
        </div>
        <div class='h-full overflow-y-auto px-4 sm:px-6 pt-2' role='menu' tabindex='-1' on:keydown={stopAnimation} on:focusin={stopAnimation} on:pointerenter={stopAnimation} on:pointermove={stopAnimation} use:dragScroll style:--custom={$searchStore.media.coverImage?.color ?? '#fff'} style:--red={r} style:--green={g} style:--blue={b}>
          {#if $searchStore.media}
            {#each filterAndSortResults(concatResults, inputText, $downloaded) as result (result.hash)}
              <div class='p-3 flex cursor-pointer mb-2 relative rounded-md overflow-hidden bg-muted group/card select:ring-1 select:ring-custom select:bg-accent select:scale-[1.02] select:shadow-lg scale-100 transition-all [content-visibility:auto] [contain-intrinsic-height:auto_106px]'
                class:opacity-40={result.accuracy === 'low'}
                use:click={() => play(result)}
                title={result.parseObject.file_name[0]}
                animate:flip={{ duration: 400, easing: quartInOut }}>
                {#if result.accuracy === 'high' || result.accuracy === 'medium'}
                  <BadgeCheck class={cn('absolute top-4 left-4 md:top-3 md:left-3 mix-blend-difference', result.accuracy === 'high' ? 'text-[#53da33]' : 'text-muted-foreground/20')} fill='currentColor' color='#000' size='1.2rem' />
                {/if}
                {#if $breakpoints.md}
                  <div class='size-20 relative shrink-0 flex items-center justify-center text-xs px-1 text-wrap break-all font-bold text-center overflow-clip'>
                    {#if $downloaded.has(result.hash)}
                      <Download class='text-[#53da33] size-12 opacity-80' stroke-width='0.5' color='currentColor' stroke='currentColor' />
                    {:else if result.type}
                      <Folder class='text-yellow-300 size-12 opacity-80' fill='currentColor' />
                    {:else}
                      <File class='text-muted-foreground size-12 opacity-80' />
                    {/if}
                  </div>
                {/if}
                <div class='flex pl-2 flex-col justify-between w-full h-20 relative min-w-0 text-[.7rem]'>
                  <div class='flex w-full items-center'>
                    <div class='text-xl font-bold text-nowrap group-select/card:text-custom transition-colors pl-6 md:pl-0'>{getGroup(result.parseObject)}</div>
                    <div class='ml-auto flex gap-2 self-start'>
                      {#each result.extension as id (id)}
                        {#if $savedConfigs[id]}
                          <img src={$savedConfigs[id].icon} alt={id} class='size-4' title='Provided by {id}' decoding='async' loading='lazy' />
                        {/if}
                      {/each}
                    </div>
                  </div>
                  <div class='text-muted-foreground text-ellipsis text-nowrap overflow-hidden'>{simplifyFilename(result.parseObject)}</div>
                  <div class='flex flex-row leading-none'>
                    <div class='details text-light flex'>
                      {#if result.type === 'best'}
                        <span class='rounded px-3 py-1 mr-0.5 border text-nowrap flex items-center' style='background: #1d2d1e; border-color: #53da33 !important; color: #53da33'>
                          Best Release
                        </span>
                      {:else if result.type === 'alt'}
                        <span class='rounded px-3 py-1 mr-0.5 border text-nowrap flex items-center' style='background: #391d20; border-color: #c52d2d !important; color: #c52d2d'>
                          Alt Release
                        </span>
                      {:else if result.type === 'batch'}
                        <span class='rounded px-3 py-1 mr-0.5 border text-nowrap flex items-center' style='background: #1d2031; border-color: #2d5ec5 !important; color: #2d5ec5'>
                          Batch
                        </span>
                      {/if}
                      <span class={cn('text-nowrap flex items-center', result.seeders > 20 ? 'text-green-600' : result.seeders < 5 ? 'text-red-600' : 'text-yellow-600')}>{result.seeders} Seeders</span>
                      <span class='text-nowrap flex items-center text-foreground/80'>{fastPrettyBytes(result.size)}</span>
                      <span class='text-nowrap flex items-center text-foreground/80'>{since(new Date(result.date))}</span>
                    </div>
                    <div class='flex ml-auto flex-row-reverse'>
                      {#each sanitiseTerms(result.parseObject) as { text, color }, i (i)}
                        <div class='rounded px-3 py-1 ml-2 text-nowrap font-bold flex items-center' style:background={color}>
                          <div class='text-contrast-filter'>
                            {text}
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              </div>
            {/each}
            {#each errors as error, i (i)}
              <div class='p-5 flex items-center justify-center w-full h-80'>
                <div>
                  <div class='mb-1 font-bold text-2xl text-center '>
                    Extensions {error.extension} encountered an error
                  </div>
                  <div class='text-md text-center text-muted-foreground whitespace-pre-wrap'>
                    {error.error.message}
                  </div>
                </div>
              </div>
            {/each}
          {/if}
          {#await searchResult}
            {#each Array.from({ length: 12 }) as _, i (i)}
              <div class='p-3 h-[106px] flex cursor-pointer mb-2 relative rounded-md overflow-hidden bg-muted flex-col justify-between [content-visibility:auto] [contain-intrinsic-height:auto_106px]'>
                <div class='h-4 w-40 bg-primary/5 animate-pulse rounded mt-2' />
                <div class='bg-primary/5 animate-pulse rounded h-2 w-28 mt-1' />
                <div class='flex justify-between mb-1'>
                  <div class='flex gap-2'>
                    <div class='mt-2 bg-primary/5 animate-pulse rounded h-2 w-20' />
                    <div class='mt-2 bg-primary/5 animate-pulse rounded h-2 w-20' />
                  </div>
                  <div class='mt-2 bg-primary/5 animate-pulse rounded h-2 w-20' />
                </div>
              </div>
            {/each}
          {:then results}
            {#if results && !results.results.length}
              <div class='p-5 flex items-center justify-center w-full h-80'>
                <div>
                  <div class='mb-3 font-bold text-4xl text-center '>
                    Ooops!
                  </div>
                  <div class='text-lg text-center text-muted-foreground'>
                    No results found.<br />Try specifying a torrent manually by pasting a magnet link or torrent file into the filter bar.
                  </div>
                </div>
              </div>
            {/if}
          {:catch error}
            <div class='p-5 flex items-center justify-center w-full h-80'>
              <div>
                <div class='mb-3 font-bold text-4xl text-center '>
                  Ooops!
                </div>
                <div class='text-lg text-center text-muted-foreground whitespace-pre-wrap'>
                  {error.message}
                </div>
              </div>
            </div>
          {/await}
        </div>
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
