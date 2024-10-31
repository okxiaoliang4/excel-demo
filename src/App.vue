<script lang="ts" setup>
import { PartialKeys, useVirtualizer, VirtualizerOptions } from "@tanstack/vue-virtual";
import { computed, onMounted, ref, toRaw, watchEffect } from "vue";
import RenderWorker from './worker.ts?worker'
import { IndexRow, IndexColumn, CellData, CellInfo } from "./types";
import { useElementSize } from "@vueuse/core";

const canvasRef = ref<HTMLCanvasElement>()
let offscreen: OffscreenCanvas | null = null
const parentRef = ref<HTMLDivElement | null>(null);

const size = useElementSize(parentRef)

const dpr = window.devicePixelRatio

const sheetState = ref({
  scrollTop: 0,
  scrollLeft: 0,
  selectedRange: [],
})

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

const cells = computed(() => {
  return virtualRows.value.flatMap((row) => {
    return virtualColumns.value.map((column) => {
      return {
        rowIndex: row.index + 1,
        columnIndex: column.index + 1,
        x: column.start,
        y: row.start,
        width: column.size,
        height: row.size,
        data: toRaw(data.value)[row.index + 1]?.[column.index + 1],
        isSelected: row.index === 1 && column.index === 1
      } satisfies CellInfo
    })
  })
})

watchEffect(() => {
  console.log(cells.value);
})

function render() {
  worker.postMessage({
    command: 'render',
    data: {
      // data: toRaw(data.value), // 不toRaw无法通过postMessage传递
      cells: toRaw(cells.value),
      virtualRows: virtualRows.value,
      virtualColumns: virtualColumns.value,
      scrollTop: sheetState.value.scrollTop,
      scrollLeft: sheetState.value.scrollLeft,
    }
  })
}

onMounted(() => {
  offscreen = canvasRef.value!.transferControlToOffscreen()!
  worker.postMessage({ command: 'init', canvas: offscreen, dpr }, [offscreen as Transferable]);
  render()
})

const handleScroll = (e: Event) => {
  sheetState.value.scrollTop = (e.target as HTMLDivElement)?.scrollTop ?? 0
  sheetState.value.scrollLeft = (e.target as HTMLDivElement)?.scrollLeft ?? 0
  render()
}

const handleClick = (e: MouseEvent) => {
  // 获取canvas元素的边界信息
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();

  // 计算实际点击位置相对于canvas的坐标（考虑DPR）
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // 考虑滚动位置
  const adjustedX = withDpr(x + sheetState.value.scrollLeft);
  const adjustedY = withDpr(y + sheetState.value.scrollTop);
  // 左上角空白区域
  const blank = withDpr(30)
  if (adjustedX < blank || adjustedY < blank) {
    // 点击空白区域或行号列标题区域
    return
  }

  console.log('Canvas click position:', { x: adjustedX, y: adjustedY });

  // 可以将这些坐标发送给worker进行处理
  // worker.postMessage({
  //   command: 'click',
  //   position: { x: adjustedX, y: adjustedY }
  // });
  const cell = getCell(adjustedX, adjustedY)
  console.log(adjustedX, adjustedY, cell);
}

function withDpr(value: number) {
  return value * dpr
}

// 检测x,y是否在某个cell内
function isInCell(x: number, y: number, cell: CellInfo) {
  return x >= withDpr(cell.x) && x <= withDpr(cell.x) + withDpr(cell.width) && y >= withDpr(cell.y) && y <= withDpr(cell.y) + withDpr(cell.height)
}
// 根据坐标获取cell
function getCell(x: number, y: number) {
  return cells.value.find((cell) => isInCell(x, y, cell))
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
      :style="{
        width: `${canvasWidth / dpr}px`,
        height: `${canvasHeight / dpr}px`
      }"
      @click="handleClick"
    />
    <div :style="{ width: `${totalWidth}px`, height: `${totalHeight}px` }"></div>
  </div>
</template>