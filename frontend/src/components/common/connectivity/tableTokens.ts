export type TableDensity = "compact" | "comfortable";

/**
 * Shared table geometry tokens across all Sentinel modules
 * (Uptime, Senti9, Certificados SSL, Registros DNS).
 *
 * Row height is controlled by the <tr> (h-12 compact = 48px, h-16 comfortable = 64px)
 * and <thead> row (h-10 = 40px), never by bloated cell padding or 44px inner buttons.
 */
export const TABLE_ROW_COMPACT = "h-12";
export const TABLE_ROW_COMFORTABLE = "h-16";
export const TABLE_HEAD_ROW = "h-10 text-xs";
export const TABLE_CELL = "px-3 py-0 align-middle";
export const TABLE_HEAD_CELL = "px-3 py-0 align-middle";
export const TABLE_CHECK_CELL = "pl-3.5 pr-3 py-0 align-middle w-11";
export const TABLE_CHECK_BTN =
  "sentinel-selection compact-btn grid h-6 w-6 place-items-center rounded bg-transparent p-0 cursor-pointer mr-1";
export const TABLE_CHECK_BOX =
  "grid h-4 w-4 shrink-0 place-items-center rounded transition-colors";
export const TABLE_PILL = "px-2 py-0.5 text-xs leading-tight";
export const TABLE_ACTION_BTN =
  "table-action-btn compact-btn h-8 w-8 grid shrink-0 place-items-center rounded-md transition-colors cursor-pointer";

export function getTableRowClass(density: TableDensity): string {
  return density === "compact" ? TABLE_ROW_COMPACT : TABLE_ROW_COMFORTABLE;
}
