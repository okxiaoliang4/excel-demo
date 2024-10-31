import RenderWorker from './worker.ts?url'
import { computed, onMounted, Ref, ref, toRaw, watch, watchEffect } from "vue";
import { CellData, CellInfo } from "../types";
import { set } from "lodash-es";
import { Virtualizer } from "@tanstack/vue-virtual";
import { useMagicKeys, useWebWorker } from '@vueuse/core';
import { withDpr } from '../util';

interface UseSheetOptions {
  canvas: Ref<HTMLCanvasElement | undefined>
  rowVirtualizer: Ref<Virtualizer<HTMLDivElement, HTMLDivElement>>
  columnVirtualizer: Ref<Virtualizer<HTMLDivElement, HTMLDivElement>>
  data: CellData
}

function createCell() {
  return { v: '', m: '', f: '', s: {} }
}

export function useSheet(options: UseSheetOptions) {
  const worker = useWebWorker(RenderWorker)
  const sheetState = ref({
    scrollTop: 0,
    scrollLeft: 0,
  })
  const data = ref<CellData>(options.data)

  const virtualRows = computed(() => options.rowVirtualizer.value.getVirtualItems());
  const virtualColumns = computed(() => options.columnVirtualizer.value.getVirtualItems());

  const selectedCell = ref<CellInfo | null>(null)

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
          isSelected: selectedCell.value?.rowIndex === row.index + 1 && selectedCell.value?.columnIndex === column.index + 1
        } satisfies CellInfo
      })
    })
  })

  function toggleBold(rowIndex: number, columnIndex: number) {
    const cell = data.value[rowIndex]?.[columnIndex] || createCell()
    set(cell, 's.b', !cell.s?.b)
    data.value[rowIndex][columnIndex] = cell
  }

  function render() {
    worker.post({
      command: 'render',
      data: {
        cells: toRaw(cells.value),
        virtualRows: virtualRows.value,
        virtualColumns: virtualColumns.value,
        scrollTop: sheetState.value.scrollTop,
        scrollLeft: sheetState.value.scrollLeft,
      }
    })
  }

  const handleScroll = (e: Event) => {
    sheetState.value.scrollTop = (e.target as HTMLDivElement)?.scrollTop ?? 0
    sheetState.value.scrollLeft = (e.target as HTMLDivElement)?.scrollLeft ?? 0
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

    const cell = getCellByPosition(adjustedX, adjustedY)
    console.log(adjustedX, adjustedY, cell);
    selectedCell.value = cell!
    console.log("🚀 ~ handleClick ~ selectedCell.value:", selectedCell.value)
  }

  onMounted(() => {
    const offscreen = options.canvas.value!.transferControlToOffscreen()!
    worker.post({ command: 'init', canvas: offscreen, dpr: window.devicePixelRatio }, [offscreen as Transferable]);
    render()
  })

  // 检测x,y是否在某个cell内
  function isInCell(x: number, y: number, cell: CellInfo) {
    return x >= withDpr(cell.x) && x <= withDpr(cell.x) + withDpr(cell.width) && y >= withDpr(cell.y) && y <= withDpr(cell.y) + withDpr(cell.height)
  }

  // 根据坐标获取cell
  function getCellByPosition(x: number, y: number) {
    // TODO: 可以优化查询匹配
    return cells.value.find((cell) => isInCell(x, y, cell))
  }

  const keys = useMagicKeys()
  watch(keys['ctrl+b'], (value) => {
    if (value && selectedCell.value) {
      // 加粗
      toggleBold(selectedCell.value.rowIndex, selectedCell.value.columnIndex)
    }
  })

  watchEffect(() => {
    render()
  })

  return {
    data,
    cells,
    selectedCell,
    getCell: getCellByPosition,
    toggleBold,
    handleScroll,
    handleClick,
  }
}
