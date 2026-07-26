export const BOARD_CELL_PX = 40;
export const BOARD_MIN_WIDTH_PX = 280;
export const BOARD_CELL_GAP = 3;

export function boardContentWidthPx(width: number): number {
  return Math.max(width * BOARD_CELL_PX, BOARD_MIN_WIDTH_PX);
}

export function boardContentHeightPx(width: number, height: number): number {
  return boardContentWidthPx(width) * (height / Math.max(width, 1));
}
