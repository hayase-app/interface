<script lang='ts'>
  import Logo from '#lib/components/icons/Logo.svelte'
  import { storagePromise } from '#lib/modules/anilist/urql-client'
  import { goto, preloadData } from '$app/navigation'

  interface Spotlight {
    tox: number
    toy: number
    toangle: number
    tosize: number
    todistance: number
    fromx: number
    fromy: number
    fromdist: number
    fromangle: number
    fromsize: number
  }
  export let data

  // hydrating the cache re-starts all queries, it's better to wait for cache to hydrate, than waste rate limit on requests which are dumped anyways
  // this was previously in anilist/client but it was a top level await, which isn't a great solution, this *should* be better?

  // we want to wait for the cache to be ready, for the page preload to finish, and for the animation to finish, in that order, but as fast as possible for each
  const promise = storagePromise.promise.then(() => preloadData(data.goto))

  async function navigate () {
    await promise
    goto(data.goto, { replace: true })
  }

  // storing hardcoded objects is faster as json, https://www.youtube.com/watch?v=ff4fgQxPaO0
  const spotlightData: Spotlight[] = JSON.parse('[{"tox":37,"toy":9,"toangle":-2.056662501122422,"tosize":8,"todistance":15,"fromx":39,"fromy":9,"fromdist":15,"fromangle":-2.08562414586023,"fromsize":5},{"tox":35.5,"toy":8.5,"toangle":-0.12083697915707219,"tosize":8,"todistance":15,"fromx":35.5,"fromy":8.5,"fromdist":15,"fromangle":-1.709436063929055,"fromsize":6},{"tox":9,"toy":13,"toangle":3.0890095919788516,"tosize":16,"todistance":15,"fromx":9,"fromy":13,"fromdist":15,"fromangle":1.6368324342229479,"fromsize":16},{"tox":24,"toy":12,"toangle":2.1149541274082813,"tosize":20,"todistance":15,"fromx":23,"fromy":11,"fromdist":15,"fromangle":1.6101247484847512,"fromsize":20},{"tox":32,"toy":20,"toangle":1.07942520581382,"tosize":13,"todistance":15,"fromx":35,"fromy":20,"fromdist":15,"fromangle":1.4487802605792384,"fromsize":13},{"tox":33,"toy":9,"toangle":-0.9299524305252777,"tosize":8,"todistance":15,"fromx":33,"fromy":9,"fromdist":15,"fromangle":-1.402804055149021,"fromsize":6}]')
</script>

<div class='size-full flex justify-center items-center'>
  <div class='size-10 relative logo-container' on:animationend|self={navigate}>
    <Logo class='size-10 [filter:url(#chromaticAberration)]' />
    {#each spotlightData as s, i (i)}
      <div class='spotlight absolute blurred origin-left'
        style:--to-x={s.tox}
        style:--to-y={s.toy}
        style:--to-dist={s.todistance}
        style:--to-angle={s.toangle + 'rad'}
        style:--to-size={s.tosize}
        style:--from-x={s.fromx}
        style:--from-y={s.fromy}
        style:--from-dist={s.fromdist}
        style:--from-angle={s.fromangle + 'rad'}
        style:--from-size={s.fromsize} />
    {/each}
  </div>
</div>

<svg width='0' height='0'>
  <filter id='chromaticAberration'>
    <feColorMatrix type='matrix'
      result='red_'
      values='4 0 0 0 0
        0 0 0 0 0
        0 0 0 0 0
        0 0 0 1 0' />
    <feOffset in='red_' dy='0' dx='4' result='red'>
      <animate attributeName='dx'
        values='4; 0'
        dur='0.1s'
        fill='freeze'
        begin='0.15s' />
    </feOffset>
    <feColorMatrix type='matrix'
      in='SourceGraphic'
      result='blue_'
      values='0 0 0 0 0
        0 3 0 0 0
        0 0 10 0 0
        0 0 0 1 0' />
    <feOffset in='blue_' dy='0' dx='-6' result='blue'>
      <animate attributeName='dx'
        values='-6; 0'
        dur='0.1s'
        fill='freeze'
        begin='0.15s' />
    </feOffset>
    <feBlend mode='screen' in='red' in2='blue' />
  </filter>
</svg>

<style>
  @property --spotlight-opacity {
    syntax: '<number>';
    inherits: false;
    initial-value: 1;
  }

  @property --to-x {
    syntax: '<number>';
    inherits: false;
    initial-value: 0;
  }

  @property --to-y {
    syntax: '<number>';
    inherits: false;
    initial-value: 0;
  }

  @property --to-dist {
    syntax: '<number>';
    inherits: false;
    initial-value: 0;
  }

  @property --to-angle {
    syntax: '<angle>';
    inherits: false;
    initial-value: 0rad;
  }

  @property --to-size {
    syntax: '<number>';
    inherits: false;
    initial-value: 0;
  }

  .logo-container {
    animation: logo-scale .2s ease-out .2s both;
  }

  @keyframes logo-scale {
    from { transform: scale(5) }
    to { transform: scale(1) }
  }

  .spotlight {
    filter: url('#chromaticAberration') blur(3px);
    --impect-radius: 192;
    --dist-factor: calc((192 - min(var(--to-dist), 192)) / 192);
    left: calc(var(--to-x) * 1px);
    top: calc(var(--to-y) * 1px);
    width: calc(var(--to-size) * 2.1px);
    height: calc(var(--to-size) * 1px);
    background: linear-gradient(to right, #fff, transparent);
    opacity: calc(var(--dist-factor, 0) * var(--spotlight-opacity, 1));
    transform: rotate(var(--to-angle)) perspective(calc(var(--to-size) * 2px)) rotateY(calc(var(--dist-factor) * -50deg - 20deg));
    animation: spotlight-properties .1s ease-out .15s both, spotlight-fade .55s ease-out both;
  }

  @keyframes spotlight-properties {
    from {
      --to-x: var(--from-x);
      --to-y: var(--from-y);
      --to-dist: var(--from-dist);
      --to-angle: var(--from-angle);
      --to-size: var(--from-size);
    }
  }

  @keyframes spotlight-fade {
    from { --spotlight-opacity: 1 }
    to { --spotlight-opacity: 0 }
  }
</style>
