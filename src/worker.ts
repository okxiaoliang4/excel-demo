import { RenderInfo } from "./types";

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let dpr = 1
onmessage = (evt) => {
  // console.log("🚀 ~ evt.data.command:", evt.data.command)
  if (evt.data.command === 'init') {
    canvas = evt.data.canvas!;
    ctx = canvas!.getContext("2d");
    dpr = evt.data.dpr
    ctx!.scale(dpr, dpr)
    ctx!.font = '16px'
    ctx!.textBaseline = 'middle'
    ctx!.strokeStyle = '#ccc'
  } else if (evt.data.command === 'render') {
    render(evt.data.data as RenderInfo)
  }
};

function render(renderInfo: RenderInfo) {
  if (!ctx || !canvas) return
  console.time('render')
  ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
  const { virtualRows, virtualColumns, data, scrollTop = 0, scrollLeft = 0 } = renderInfo
  ctx.save()

  ctx.fillStyle = '#000'
  // 处理滚动
  ctx.translate(-scrollLeft, -scrollTop)
  virtualRows.forEach((vrow) => {
    virtualColumns.forEach((vcolumn) => {
      const rowIndex = vrow.index + 1
      const columnIndex = vcolumn.index + 1
      const cell = data[rowIndex]?.[columnIndex]

      ctx!.beginPath()
      ctx!.rect(vcolumn.start, vrow.start, vcolumn.size, vrow.size)
      ctx!.stroke()
      const text = cell?.m || ''
      const cellPadding = 10
      const centerY = vrow.start + (vrow.end - vrow.start) / 2
      ctx!.fillText(text, vcolumn.start + cellPadding, centerY)
    })
  })


  // 绘制行号列
  ctx.fillStyle = '#f3f3f3'
  virtualRows.forEach((vrow) => {
    const rowIndex = vrow.index + 1
    ctx!.fillRect(scrollLeft, vrow.start, 30, vrow.size) // 绘制行号背景
    ctx!.strokeRect(scrollLeft, vrow.start, 30, vrow.size)
    ctx!.fillStyle = '#333'
    ctx!.fillText(rowIndex.toString(), scrollLeft + 10, vrow.start + vrow.size / 2)
    ctx!.fillStyle = '#f3f3f3'
  })

  // 绘制列标题行
  virtualColumns.forEach((vcolumn) => {
    const columnIndex = vcolumn.index + 1
    const alpha = getAlpha(columnIndex)
    ctx!.fillRect(vcolumn.start, scrollTop, vcolumn.size, 30) // 绘制列标题背景
    ctx!.strokeRect(vcolumn.start, scrollTop, vcolumn.size, 30)
    ctx!.fillStyle = '#333'
    ctx!.fillText(alpha, vcolumn.start + 10, scrollTop + 15)
    ctx!.fillStyle = '#f3f3f3'
  })
  ctx.fillRect(scrollLeft, scrollTop, 30, 30)
  ctx.strokeRect(scrollLeft, scrollTop, 30, 30)
  ctx.restore()

  console.timeEnd('render')
}


/**
 * excel column alpha
 */
function getAlpha(num: number) {
  let n = num
  let result = ''
  while (n > 0) {
    const remainder = (n - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}
