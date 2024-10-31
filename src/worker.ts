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
    // Perform some drawing using the gl context
    // function render(time) {
    //   // console.log("🚀 ~ render ~ time:", time)
    //   // Perform some drawing using the gl context
    //   requestAnimationFrame(render);
    // }
    // requestAnimationFrame(render);
  } else if (evt.data.command === 'render') {
    if (!ctx || !canvas) return
    console.time('render')
    ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
    const { virtualRows, virtualColumns, data, scrollTop, scrollLeft } = evt.data.data as RenderInfo
    ctx.save()

    ctx.translate(-(scrollLeft ?? 0), -(scrollTop ?? 0))
    virtualRows.forEach((vrow) => {
      virtualColumns.forEach((vcolumn) => {
        const rowIndex = vrow.index + 1
        const columnIndex = vcolumn.index + 1
        const cell = data[rowIndex]?.[columnIndex]

        ctx?.beginPath()
        ctx!.rect(vcolumn.start, vrow.start, vcolumn.end, vrow.end)
        ctx!.stroke()
        // const text = cell?.m || '1'
        const cellPadding = 10
        const centerY = vrow.start + (vrow.end - vrow.start) / 2
        ctx!.fillText(`${rowIndex}-${columnIndex}`, vcolumn.start + cellPadding, centerY)
      })
    })
    ctx.restore()
    console.timeEnd('render')
    // ctx!.fillStyle = "red"
    // ctx!.fillRect(0, 0, totalWidth, totalHeight)
  }
};
