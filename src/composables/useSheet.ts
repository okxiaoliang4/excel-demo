import RenderWorker from './worker.ts?url'
import { evaluate } from 'mathjs';
import { computed, onMounted, Ref, ref, toRaw, watch, watchEffect } from "vue";
import { CellData, CellInfo } from "../types";
import { Virtualizer } from "@tanstack/vue-virtual";
import { useMagicKeys, useWebWorker } from '@vueuse/core';
import { codeToPosition, withDpr } from '../util';
import { Doc } from 'yjs'

interface UseSheetOptions {
  canvas: Ref<HTMLCanvasElement | undefined>
  rowVirtualizer: Ref<Virtualizer<HTMLDivElement, HTMLDivElement>>
  columnVirtualizer: Ref<Virtualizer<HTMLDivElement, HTMLDivElement>>
  data: CellData
  doc: Doc
}

function createCell() {
  return { v: '', m: '', f: '', s: {} }
}

export function useSheet(options: UseSheetOptions) {
  const worker = useWebWorker(RenderWorker)
  const sheetState = ref({
    scrollTop: 0,
    scrollLeft: 0,
    input: {
      isInputing: false,
      rowIndex: 0,
      columnIndex: 0,
      value: '',
    }
  })

  const data = ref<CellData>()

  const yData = options.doc.getMap('data')
  yData.observe((e) => {
    console.log('yData changed', e);
    data.value = updateData()
  })
  if (yData.size === 0) {
    Object.entries(options.data).forEach(([rowKey, row]) => {
      Object.entries(row).forEach(([colKey, cell]) => {
        yData.set(`${rowKey},${colKey}`, cell)
      })
    })
  }

  function updateData() {
    const result: CellData = {}
    yData.forEach((value, key) => {
      const [row, col] = key.split(',')
      if (!result[row]) result[row] = {}
      result[row][col] = value
    })
    return result
  }

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
    const newCell = { ...cell, s: { ...cell.s, b: !cell.s?.b } }
    yData.set(`${rowIndex},${columnIndex}`, newCell)
  }

  function render() {
    worker.post({
      command: 'render',
      data: {
        cells: toRaw(cells.value),
        virtualRows: virtualRows.value,
        virtualColumns: virtualColumns.value,
        sheetState: {
          scrollTop: sheetState.value.scrollTop,
          scrollLeft: sheetState.value.scrollLeft,
          input: toRaw(sheetState.value.input),
        }
      }
    })
  }

  const handleScroll = (e: Event) => {
    sheetState.value.scrollTop = (e.target as HTMLDivElement)?.scrollTop ?? 0
    sheetState.value.scrollLeft = (e.target as HTMLDivElement)?.scrollLeft ?? 0
  }

  const handleClick = (e: MouseEvent) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const adjustedX = withDpr(x + sheetState.value.scrollLeft);
    const adjustedY = withDpr(y + sheetState.value.scrollTop);
    const blank = withDpr(30)
    if (adjustedX < blank || adjustedY < blank) {
      return
    }

    console.log('Canvas click position:', { x: adjustedX, y: adjustedY });

    const cell = getCellByPosition(adjustedX, adjustedY)
    selectedCell.value = cell!
    sheetState.value.input.isInputing = false
  }

  const handleDblClick = () => {
    sheetState.value.input.isInputing = true
    sheetState.value.input.value = selectedCell.value!.data?.f ?? selectedCell.value!.data?.v ?? ''
    sheetState.value.input.rowIndex = selectedCell.value!.rowIndex
    sheetState.value.input.columnIndex = selectedCell.value!.columnIndex
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

  function getCell(rowIndex: number, columnIndex: number) {
    return data.value[rowIndex]?.[columnIndex]
  }

  function handleInput(rowIndex: number, columnIndex: number, value: string) {
    if (value.startsWith('=')) {
      // TODO: 公式, 还差依赖收集更新，输入更新的已完成
      let result = ''
      const cell = data.value[rowIndex]?.[columnIndex] || createCell()
      try {
        const formula = value.slice(1)
        // 替换公式中的单元格引用
        const expression = formula.replace(/[A-Z]\d+/g, (match) => {
          const { columnIndex, rowIndex } = codeToPosition(match)
          const cell = getCell(rowIndex, columnIndex)
          return cell?.v ?? ''
        })
        result = evaluate(expression, data.value)
      } catch (error) {
        result = '计算错误'
        console.error(error)
      }
      const newCell = { ...cell, m: result, v: result, f: value }
      yData.set(`${rowIndex},${columnIndex}`, newCell)
    } else {
      const cell = data.value[rowIndex]?.[columnIndex] || createCell()
      const newCell = { ...cell, m: value, v: value }
      yData.set(`${rowIndex},${columnIndex}`, newCell)
    }
    render()
  }
  function handleEnter(e: KeyboardEvent) {
    (e.target as HTMLInputElement).blur()
  }
  function handleBlur() {
    sheetState.value.input.isInputing = false
    handleInput(sheetState.value.input.rowIndex, sheetState.value.input.columnIndex, sheetState.value.input.value)
  }

  const keys = useMagicKeys()
  watch(keys['ctrl+b'], (value) => {
    if (value && selectedCell.value) {
      // 加粗
      toggleBold(selectedCell.value.rowIndex, selectedCell.value.columnIndex)
    }
  })

  watchEffect(() => {
    console.log('render');
    render()
  })

  yData.observe(() => {
    render()
  })

  return {
    sheetState,
    data,
    cells,
    selectedCell,
    getCell: getCellByPosition,
    toggleBold,
    handleScroll,
    handleClick,
    handleDblClick,
    handleInput,
    handleEnter,
    handleBlur,
  }
}
