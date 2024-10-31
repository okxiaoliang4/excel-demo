import { VirtualItem } from "@tanstack/vue-virtual";

export type IndexMap<T> = { [key: number]: T; length: number }

export type Row = { h: number }
export type IndexRow = IndexMap<Row>

export type Column = { w: number }
export type IndexColumn = IndexMap<Column>

export type Cell = {
  v: string,
  m: string,
  f?: string,
  s?: {
    b?: boolean,
    fs?: number,
  }
}
export type CellData = IndexMap<IndexMap<Cell>>

export type CellInfo = {
  rowIndex: number;
  columnIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  data?: Cell;
  isSelected?: boolean;
}
export interface RenderInfo {
  cells: CellInfo[];
  virtualRows: VirtualItem[];
  virtualColumns: VirtualItem[];
  totalHeight: number;
  totalWidth: number;
  scrollTop: number;
  scrollLeft: number;
}
