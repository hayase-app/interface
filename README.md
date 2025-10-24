<p align="center">
	<a href="https://github.com/hayase-app/ui">
		<img src="./static/logo_white.svg" width="300">
	</a>
</p>
<h1 align="center"><b>Hayase</b></h1>

<h4 align="center"><b>A bring-your-own-content torrent streaming client for anime 🍿</b></h4>


> [!WARNING]  
> Hayase does not provide, host, or link to any content sources. Users must supply their own torrents.</strong>

<p align="center">
  <a href="https://hayase.watch/#about">About</a> •
  <a href="https://hayase.watch/features/">Features</a> •
  <a href="https://hayase.watch/faq/">Frequently Asked Questions</a> •
  <a href="https://hayase.watch/download/">Download</a>
</p>
<p align="center">
  <a href="https://discord.gg/Z87Nh7c4Ac">
    <img src="https://img.shields.io/discord/953341991134064651?style=flat-square" alt="chat">
  </a>
  <a href="https://hayase.watch/download/">
    <img alt="Download" src="https://img.shields.io/github/downloads/hayase-app/ui/total?style=flat-square">
  </a>
</p>

https://github.com/user-attachments/assets/bbbe2966-b773-4ebb-9d69-08248ae77ae4

## ✨ About

**Hayase** is a bring-your-own-content torrent streaming client designed for anime enthusiasts. It provides the technology to stream torrents in real-time, with no waiting for downloads to finish.

> [!IMPORTANT]
> Hayase is purely a torrent client and media player. It does not provide, index, host, or link to any content sources, torrent files, or unofficial repositories. Users are fully responsible for sourcing their own content legally and in compliance with their local laws.

The app is designed to look, work and perform like a premium streaming service, but with all the benefits you control: file downloads, higher download speeds, better video quality, and advanced playback features.

## 🌟 Highlights

* 📚 **Anime list integration:** Sync with AniList, Kitsu, MAL, or use local storage.
* ⚡ **Instant torrent streaming:** Watch as you download.
* 📴 **Offline viewing:** Enjoy already-downloaded content anytime.
* 🎬 **Advanced video player:** Full support for all subtitle formats, softcoded and external tracks, and more.
* 👥 **Social features:** Connect with friends, join discussions, and watch together.
* 🔒 **No content provided:** You maintain full control and responsibility for your content sources, no takedowns, no dissapearances.

***

## 🏆 Features

### 🎞️ Anime Management

* Effortlessly manage your anime list with support for AniList, Kitsu, ~~MAL~~, and local storage.
* Automatically track watched episodes.
* See what you’re behind on, and discover sequels you’ve missed.
* Keep up to date and browse upcoming episodes with airing calendars.
* Edit entries (score, progress, status, favorite, etc.) even while offline.
* Search by image, name, genre, year, season, and more.
* View trailers, OP/ED themes, and detailed episode lists with thumbnails, descriptions and filler indicators.

<p align="center">
  <img src='https://raw.githubusercontent.com/hayase-app/website/main/static/viewanime.webp' width='400px'></img>
</p>

### 🤝 Social & Community

* Instantly see which friends are following an anime or episode.
* See friends profiles and watch progress in the episodes list.
* Track your friends’ watch progress in real time.
* Join episode discussions and forums, even offline.
* Global app chat.
* Discord rich pressence.
* Host or join Watch Together lobbies with synced playback and chat.

### 🎥 Video Experience

* Full subtitle support.
  * Softcoded, external and manually added subtitles.
  * VTT, SSA, ASS, SUB, TXT formats.
  * Subtitle display in PiP.
  * Override default dialog styles.
  * Override default fonts for Asian languages \[fix for bad torrents].
* Picture In Picture.
  * PiP on lost visiblity.
* Pause on lost visibility.
* Specify preferred language for video and subtitle tracks.
* Remove video compression artifacts.
* Miniplayer.
* Media Session display.
* Media Keys support.
* Discord rich pressence.
* Seek and preview thumbnails.
* Autoplay next episode.
* Skip intro/outro, manually or automatically.
* Skip filler episodes automatically.
* Change playback rate.
* Browse playlist.
* Multi-track support for video, audio and subtitles.
* Editable keybinds for all player functions.
* Exponential volume \[better control at lower volumes].
* External player support.

<p align="center">
  <img src='https://raw.githubusercontent.com/hayase-app/website/main/static/videoplayer.webp' width='400px'></img>
</p>

### 🧲 Torrents

* Stream your own torrents instantly, no waiting for full downloads.
* Download only what you need for playback.
* Choose your downloads folder and set speed/connection limits.
* Support for custom extensions and trackers (you provide the sources).
* Specify download/upload speeds, ports and connections.
* Support for most popular BEP's.
* Persist torrents, cache progress, and rescan instantly.
* View detailed torrent and peer info.
* Batch downloads.

**Note:** Hayase does not provide any torrent sources, indexes, or repositories. All content must be supplied by the user.

<p align="center">
  <img src='https://raw.githubusercontent.com/hayase-app/website/main/static/modal.webp' width='400px'></img>
</p>

### ⚙️ Performance & Security

* Highly secure.
  * Operates on a Zero Trust model.
  * Protects data integrity and settings from external attacks.
  * Protects from attacks via malicious torrent extensions.
  * Uses up to date best security practices for native apps.
* Insanely performant.
  * Fully hardware/GPU accelerated.
  * GPU based shaders, animations and paints.
* Very low resource utilisation.
  * Only loads code as required by user navigation.
  * Unloads code not in use.
  * Doesn't render unnecessary UI updates.
  * Disables rendering when not visible.
  * Doesn't render any UI when immersed in fullscreen video.
* Minimise to tray.
* In-app changelog.
* Custom themes.

<p align="center">
  <img src='https://raw.githubusercontent.com/hayase-app/website/main/static/simple.webp' width='400px'></img>
</p>

## **Building and Development**

Requires `Node 20` or above and `pnpm`. VSCode is recommended.

```js
pnpm i // to install
pnpm run dev // to develop
pnpm run build // to build
pnpm run sync && pnpm run lint && pnpm run gql:check && pnpm run check // to test
```

***

<h2 align="center">
  <b>Enjoy streaming anime the way it should be! 🍿</b>
</h2>
