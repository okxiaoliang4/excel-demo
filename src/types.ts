import { VirtualItem } from "@tanstack/vue-virtual";

export type IndexMap<T> = { [key: number]: T; length: number }

export type Row = { h: number }
export type IndexRow = IndexMap<Row>

export type Column = { w: number }
export type IndexColumn = IndexMap<Column>

export type Cell = { v: string, m: string, f: string }
export type CellData = IndexMap<IndexMap<Cell>>

export interface RenderInfo {
  data: any;
  virtualRows: VirtualItem[];
  virtualColumns: VirtualItem[];
  totalHeight: number;
  totalWidth: number;
  scrollTop: number | null;
  scrollLeft: number | null;
}