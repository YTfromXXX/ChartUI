// Shared 48-cell ("48 mass field") grid geometry used by ProjectionField, the
// Arcana Tactic drop targets, and the trap-shatter overlay so all three stay
// pixel-perfectly aligned with a single source of truth.
export const PROJECTION_GRID_COLUMNS = 8;
export const PROJECTION_GRID_ROWS = 6;
export const PROJECTION_CELL_COUNT = PROJECTION_GRID_COLUMNS * PROJECTION_GRID_ROWS; // 48

export type ProjectionGridMetrics = {
  gridX: number;
  gridY: number;
  gridWidth: number;
  gridHeight: number;
  cellWidth: number;
  cellHeight: number;
};

export function computeProjectionGrid(width: number, height: number): ProjectionGridMetrics {
  const gridX = width * 0.15;
  const gridY = height * 0.11;
  const gridWidth = width * 0.76;
  const gridHeight = height * 0.78;
  return {
    gridX,
    gridY,
    gridWidth,
    gridHeight,
    cellWidth: gridWidth / PROJECTION_GRID_COLUMNS,
    cellHeight: gridHeight / PROJECTION_GRID_ROWS,
  };
}

export type CellRect = { x: number; y: number; width: number; height: number; column: number; row: number };

export function cellRect(index: number, metrics: ProjectionGridMetrics): CellRect {
  const column = index % PROJECTION_GRID_COLUMNS;
  const row = Math.floor(index / PROJECTION_GRID_COLUMNS);
  return {
    x: metrics.gridX + column * metrics.cellWidth,
    y: metrics.gridY + row * metrics.cellHeight,
    width: metrics.cellWidth,
    height: metrics.cellHeight,
    column,
    row,
  };
}

/**
 * Maps a 48-cell grid index onto a point on the unit sphere (theta = polar
 * angle from the "buy" pole, phi = azimuth across the price/time axis). This
 * is the same quadrature used to fit spherical-harmonic coefficients to the
 * gravity tensor, so a "cell" and a "plane" on the distorted sphere are the
 * same physical direction.
 */
export function cellAngles(index: number): { theta: number; phi: number } {
  const column = index % PROJECTION_GRID_COLUMNS;
  const row = Math.floor(index / PROJECTION_GRID_COLUMNS);
  const theta = ((row + 0.5) / PROJECTION_GRID_ROWS) * Math.PI;
  const phi = ((column + 0.5) / PROJECTION_GRID_COLUMNS) * Math.PI * 2;
  return { theta, phi };
}
