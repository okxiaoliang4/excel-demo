<script lang="ts" setup>
import { PartialKeys, useVirtualizer, VirtualizerOptions } from "@tanstack/vue-virtual";
import { computed, ref } from "vue";
import { IndexRow, IndexColumn } from "./types";
import { useElementSize } from "@vueuse/core";
import { withDpr } from "./util";
import { useSheet } from "./composables/useSheet";

const canvasRef = ref<HTMLCanvasElement>()
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

const {
  handleScroll,
  handleClick,
} = useSheet({
  canvas: canvasRef,
  rowVirtualizer: rowVirtualizer,
  columnVirtualizer: columnVirtualizer,
  data: {
    1: {
      1: { v: "1", m: "1", f: "1" },
      length: 1
    },
    length: 1
  }
})
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
      :style="{
        width: `${canvasWidth / dpr}px`,
        height: `${canvasHeight / dpr}px`
      }"
      @click="handleClick"
    />
    <!-- <input
      v-if="selectedCell"
      v-model="input"
      class="input"
      :style="{
        position: 'absolute',
        left: `${(selectedCell.x) + 5}px`,
        top: `${(selectedCell.y) + 5}px`,
        width: `${selectedCell.width - 10}px`,
        height: `${selectedCell.height - 10}px`,
      }"
    /> -->
    <div :style="{ width: `${totalWidth}px`, height: `${totalHeight}px` }"></div>
  </div>
</template>
