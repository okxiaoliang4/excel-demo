<script lang="ts" setup>
import { PartialKeys, useVirtualizer, VirtualizerOptions } from "@tanstack/vue-virtual";
// import stringify from 'fast-json-stringify'
import { computed, onMounted, ref, toRaw, watchEffect } from "vue";
import RenderWorker from './worker.ts?worker'
import { IndexRow, IndexColumn, CellData } from "./types";
import { useElementSize } from "@vueuse/core";

const canvasRef = ref<HTMLCanvasElement>()
let offscreen: OffscreenCanvas | null = null
const parentRef = ref<HTMLDivElement | null>(null);

const size = useElementSize(parentRef)

const dpr = window.devicePixelRatio

const worker = new RenderWorker()
worker.onmessage = (e) => {
  console.log(e);
}
worker.onerror = (e) => {
  console.error(e)
  worker.terminate()
}


const rows: IndexRow = {
  length: 1000,
}
const columns: IndexColumn = {
  length: 1000,
}

const data = ref<CellData>({
  1: {
    1: { v: "1", m: "1", f: "1" },
    length: 1
  },
  length: 1
});

const defaultWidth = 80
const defaultHeight = 30

// const table = useVueTable({
//   defaultColumn: {
//     size: defaultWidth
//   },
//   get data() {
//     return data.value;
//   },
//   columns: columns.value,
//   getCoreRowModel: getCoreRowModel(),
//   debugTable: true,
// });

// const rows = computed(() => table.getRowModel().rows);


const canvasWidth = computed(() => (size.width.value || window.innerWidth) * dpr)
const canvasHeight = computed(() => (size.height.value || window.innerHeight) * dpr)

let scrollTop = 0
let scrollLeft = 0

const rowVirtualizerOptions = computed(() => {
  return {
    count: rows.length,
    getScrollElement: () => parentRef.value,
    estimateSize: () => defaultHeight,
    overscan: 5,
    paddingStart: 30,
    initialRect: {
      width: canvasWidth.value,
      height: canvasHeight.value
    },
    observeElementRect(instance, cb) {
      let resizeObserver: ResizeObserver | null = null
      if (instance.scrollElement) {
        resizeObserver = new ResizeObserver((result) => {
          cb({
            width: result[0].contentRect.width * dpr,
            height: result[0].contentRect.height * dpr
          })
        })
        resizeObserver.observe(instance.scrollElement)
      }
      return () => resizeObserver?.disconnect()
    },
    onChange() {
      render()
    }
  } satisfies PartialKeys<VirtualizerOptions<HTMLDivElement, HTMLDivElement>, 'onChange' | 'observeElementRect' | 'observeElementOffset' | 'scrollToFn'>
});
const columnVirtualizerOptions = computed(() => {
  return {
    horizontal: true,
    count: columns.length,
    getScrollElement: () => parentRef.value,
    estimateSize: () => defaultWidth,
    paddingStart: 30,
    overscan: 5,
    initialRect: {
      width: canvasWidth.value,
      height: canvasHeight.value
    },
    observeElementRect(instance, cb) {
      let resizeObserver: ResizeObserver | null = null
      if (instance.scrollElement) {
        resizeObserver = new ResizeObserver((result) => {
          cb({
            width: result[0].contentRect.width * dpr,
            height: result[0].contentRect.height * dpr
          })
        })
        resizeObserver.observe(instance.scrollElement)
      }
      return () => resizeObserver?.disconnect()
    },
    onChange() {
      render()
    }
  } satisfies PartialKeys<VirtualizerOptions<HTMLDivElement, HTMLDivElement>, 'onChange' | 'observeElementRect' | 'observeElementOffset' | 'scrollToFn'>
});

const rowVirtualizer = useVirtualizer(rowVirtualizerOptions);
const columnVirtualizer = useVirtualizer(columnVirtualizerOptions);

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems());
const virtualColumns = computed(() => columnVirtualizer.value.getVirtualItems());

const totalHeight = computed(() => rowVirtualizer.value.getTotalSize());
const totalWidth = computed(() => columnVirtualizer.value.getTotalSize());


function render() {
  worker.postMessage({
    command: 'render',
    data: {
      data: toRaw(data.value), // 不toRaw无法通过postMessage传递
      virtualRows: virtualRows.value,
      virtualColumns: virtualColumns.value,
      scrollTop: scrollTop,
      scrollLeft: scrollLeft,
    }
  })
}

onMounted(() => {
  offscreen = canvasRef.value!.transferControlToOffscreen()!
  worker.postMessage({ command: 'init', canvas: offscreen, dpr }, [offscreen as Transferable]);
  render()
})

// watch(renderInfo, (info) => {
//   worker.postMessage({ command: 'render', data: info })
// }, {
//   immediate: true
// })

const handleScroll = (e: Event) => {
  scrollTop = (e.target as HTMLDivElement)?.scrollTop ?? 0
  scrollLeft = (e.target as HTMLDivElement)?.scrollLeft ?? 0
  render()
}
</script>

<template>
  <div
    ref="parentRef"
    class="container"
    @scroll="handleScroll"
  >
    <canvas
      ref="canvasRef"
      class="canvas"
      :width="canvasWidth"
      :height="canvasHeight"
    />
    <div :style="{ width: `${totalWidth}px`, height: `${totalHeight}px` }"></div>
  </div>
</template>