<script lang="ts" setup>
import { PartialKeys, useVirtualizer, VirtualizerOptions } from "@tanstack/vue-virtual";
import { computed, nextTick, ref, watch } from "vue";
import { IndexRow, IndexColumn } from "./types";
import { useElementSize } from "@vueuse/core";
import { withDpr } from "./util";
import { useSheet } from "./composables/useSheet";
import { clamp } from "lodash-es";
import { Doc } from 'yjs'
import { WebsocketProvider } from 'y-websocket'

const canvasRef = ref<HTMLCanvasElement>()
const inputRef = ref<HTMLInputElement>()
const parentRef = ref<HTMLDivElement | null>(null);

const size = useElementSize(parentRef)

const dpr = window.devicePixelRatio

const rows: IndexRow = {
  length: 1000,
}
const columns: IndexColumn = {
  length: 1000,
}

const defaultWidth = 80
const defaultHeight = 30


const canvasWidth = computed(() => withDpr(size.width.value || window.innerWidth))
const canvasHeight = computed(() => withDpr(size.height.value || window.innerHeight))

const rowVirtualizerOptions = computed(() => {
  return {
    count: rows.length,
    getScrollElement: () => parentRef.value,
    estimateSize: () => defaultHeight,
    overscan: 0,
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
            width: withDpr(result[0].contentRect.width),
            height: withDpr(result[0].contentRect.height)
          })
        })
        resizeObserver.observe(instance.scrollElement)
      }
      return () => resizeObserver?.disconnect()
    },
  } satisfies PartialKeys<VirtualizerOptions<HTMLDivElement, HTMLDivElement>, 'onChange' | 'observeElementRect' | 'observeElementOffset' | 'scrollToFn'>
});
const columnVirtualizerOptions = computed(() => {
  return {
    horizontal: true,
    count: columns.length,
    getScrollElement: () => parentRef.value,
    estimateSize: () => defaultWidth,
    paddingStart: 30,
    overscan: 0,
    initialRect: {
      width: canvasWidth.value,
      height: canvasHeight.value
    },
    observeElementRect(instance, cb) {
      let resizeObserver: ResizeObserver | null = null
      if (instance.scrollElement) {
        resizeObserver = new ResizeObserver((result) => {
          cb({
            width: withDpr(result[0].contentRect.width),
            height: withDpr(result[0].contentRect.height)
          })
        })
        resizeObserver.observe(instance.scrollElement)
      }
      return () => resizeObserver?.disconnect()
    },
    // }
  } satisfies PartialKeys<VirtualizerOptions<HTMLDivElement, HTMLDivElement>, 'onChange' | 'observeElementRect' | 'observeElementOffset' | 'scrollToFn'>
});

const rowVirtualizer = useVirtualizer(rowVirtualizerOptions);
const columnVirtualizer = useVirtualizer(columnVirtualizerOptions);

const totalHeight = computed(() => rowVirtualizer.value.getTotalSize());
const totalWidth = computed(() => columnVirtualizer.value.getTotalSize());

const doc = new Doc()

new WebsocketProvider(
  'ws://localhost:1234', // 你的 WebSocket 服务器地址
  'sheet-room', // 房间名称
  doc
)

const {
  sheetState,
  selectedCell,
  handleScroll,
  handleClick,
  handleDblClick,
  handleEnter,
  handleBlur,
} = useSheet({
  canvas: canvasRef,
  rowVirtualizer: rowVirtualizer,
  columnVirtualizer: columnVirtualizer,
  data: {
    1: {
      1: { v: "1", m: "1", f: "1" },
      2: { v: "2", m: "2", f: "2" },
      3: { v: "3", m: "3", f: "=A1+B1*B1" },
      length: 2
    },
    length: 1
  },
  doc
})

watch(() => sheetState.value.input.isInputing, (v) => {
  if (v) {
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
})
</script>

<template>
  <div class="app">
    <div>
      <input :value="selectedCell?.data?.f || selectedCell?.data?.v" />
    </div>
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
        :style="{
          width: `${canvasWidth / dpr}px`,
          height: `${canvasHeight / dpr}px`
        }"
        @click="handleClick"
        @dblclick="handleDblClick"
      />
      <input
        v-if="sheetState.input.isInputing"
        v-model="sheetState.input.value"
        ref="inputRef"
        class="input"
        resize="none"
        :style="{
          position: 'absolute',
          left: `${clamp(selectedCell!.x, selectedCell!.x + (sheetState.scrollLeft - selectedCell!.x) + 30, canvasWidth)}px`,
          top: `${clamp(selectedCell!.y, selectedCell!.y + (sheetState.scrollTop - selectedCell!.y) + 30, canvasHeight)}px`,
          width: `${selectedCell!.width}px`,
          height: `${selectedCell!.height}px`,
        }"
        @keydown.enter="handleEnter"
        @blur="handleBlur"
      />
      <div :style="{ width: `${totalWidth}px`, height: `${totalHeight}px` }"></div>
    </div>
  </div>
</template>
