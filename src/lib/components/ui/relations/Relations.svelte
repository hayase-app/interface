<script lang='ts'>
  import Dagre from '@dagrejs/dagre'
  import { SvelteFlow, Background, useSvelteFlow, type Node, type Edge, Controls, ControlButton, type NodeTypes } from '@xyflow/svelte'
  import '@xyflow/svelte/dist/style.css'
  import Maximize2 from 'lucide-svelte/icons/maximize-2'
  import Minimize2 from 'lucide-svelte/icons/minimize-2'
  import { writable } from 'simple-store-svelte'
  import { onMount } from 'svelte'

  import TextNode from './TextNode.svelte'

  import type { Media } from '$lib/modules/anilist'

  import { client } from '$lib/modules/anilist'

  export let media: Media

  export let expanded: boolean

  // WARN: this is non-reactive, only set on init, but it shouldn't matter as the anime page can only navigate to entries already visible in the graph
  // this is done to make sure the graph doesn't reset when navigating to a relation
  const nodesStore = client.relationsTree(media)

  const nodes = writable<Node[]>([])
  const edges = writable<Edge[]>([])

  $: $nodes = [...$nodesStore.nodes.values()]
  $: $edges = [...$nodesStore.edges.values()]

  const { fitView } = useSvelteFlow()

  $: media && onLayout()

  $: $nodesStore && fitAndLayout()

  function getLayoutedElements (nodes: Node[], edges: Edge[]) {
    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'LR', edgesep: 50, nodesep: 50, ranksep: 120, ranker: 'tight-tree' })
    // TODO: switch between longest-path and tight-tree based on number of nodes?

    edges.forEach((edge) => g.setEdge(edge.source, edge.target))
    nodes.forEach((node) =>
      g.setNode(node.id, {
        ...node,
        width: node.measured?.width ?? 120,
        height: node.measured?.height ?? 32
      })
    )

    Dagre.layout(g)

    return {
      nodes: nodes.map((node) => {
        const position = g.node(node.id)
        // We are shifting the dagre node position (anchor=center center) to the top left
        // so it matches the Svelte Flow node anchor point (top left).
        const x = position.x - (node.measured?.width ?? 0) / 2
        const y = position.y - (node.measured?.height ?? 0) / 2

        return {
          ...node,
          data: {
            ...node.data,
            current: node.data.id === media.id
          },
          type: 'customText',
          position: { x, y },
          sourcePosition: 'right',
          targetPosition: 'left'
        }
      }) as Node[],
      edges: edges.map(e => ({
        ...e,
        style: (e.data?.ids as number[]).includes(media.id) ? '--xy-edge-stroke: var(--custom)' : '',
        labelStyle: (e.data?.ids as number[]).includes(media.id) ? '--xy-edge-label-color: var(--custom)' : ''
      }))
    }
  }

  function onLayout () {
    const { nodes, edges } = getLayoutedElements($nodes, $edges)

    $nodes = nodes
    $edges = edges
  }
  function fitAndLayout () {
    onLayout()
    fitView()
  }

  // turbo hacky but cba
  let frameId: number
  function loopFitView () {
    cancelAnimationFrame(frameId)
    fitView()
    frameId = requestAnimationFrame(loopFitView)
  }

  let timeoutId: ReturnType<typeof setTimeout>
  function expand () {
    expanded = !expanded
    loopFitView()
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      cancelAnimationFrame(frameId)
      if (expanded) document.querySelector('.svelte-flow')?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      fitView()
    }, 150)
  }

  onMount(() => {
    fitAndLayout()
    setTimeout(fitAndLayout)
  })

  const nodeTypes = {
    customText: TextNode as NodeTypes['customText']
  }
</script>

<SvelteFlow {nodes} {edges} colorMode='dark'
  proOptions={{ hideAttribution: true }}
  nodesConnectable={false}
  nodesDraggable={false}
  panOnScroll={false}
  zoomOnScroll={expanded}
  preventScrolling={expanded}
  zoomActivationKey={['Control', 'Meta', 'Ctrl', 'Shift', 'ShiftLeft']}
  onlyRenderVisibleElements={true}
  minZoom={0}
  maxZoom={1.2}
  {nodeTypes}
  elementsSelectable={false}
  class='!overflow-clip'>
  <Background bgColor='black' />
  <Controls showLock={false} orientation='horizontal'>
    <ControlButton on:click={expand}>
      {#if expanded}
        <Minimize2 />
      {:else}
        <Maximize2 />
      {/if}
    </ControlButton>
  </Controls>
</SvelteFlow>
