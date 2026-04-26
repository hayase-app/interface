<script lang='ts'>
  import OverType from 'overtype'

  import { cn } from '$lib/utils'

  let className: string | undefined | null = ''
  export let value = ''
  export { className as class }

  export let placeholder: string | undefined = undefined

  function markdown (el: HTMLDivElement) {
    const [editor] = new OverType(el, {
      toolbar: true,
      placeholder,
      value,
      autoResize: false,
      theme: {
        name: 'custom',
        colors: {
          bgPrimary: '#282c34',
          bgSecondary: '#21252b',
          text: '#abb2bf',
          h1: '#e06c75',
          h2: '#e5c07b',
          h3: '#98c379',
          strong: '#e5c07b',
          em: '#c678dd',
          link: '#61afef',
          code: '#98c379',
          codeBg: 'rgba(40, 44, 52, 0.5)',
          blockquote: '#5c6370',
          hr: '#3b4048',
          syntaxMarker: 'rgba(97, 175, 239, 0.5)',
          cursor: '#61afef',
          selection: 'rgba(97, 175, 239, 0.3)',
          listMarker: '#e5c07b',
          toolbarBg: '#21252b',
          toolbarBorder: '#3b4048',
          toolbarIcon: '#abb2bf',
          toolbarHover: '#333842',
          toolbarActive: '#282c34'
        }
      },
      onChange: (val: string) => {
        value = val
      }
    })

    return {
      destroy () {
        editor!.destroy()
      }
    }
  }
</script>

<div use:markdown
  class={cn(
    'border-input placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[60px] w-full overflow-clip rounded-md border bg-transparent text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50',
    className
  )} />
