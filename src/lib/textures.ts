// ═══════════════════════════════════════════════════════════════════
// MOTOR DE TEXTURAS (pixel art) — Asternal
//
// Una textura es una rejilla cuadrada de píxeles. Cada fila es una
// cadena donde cada carácter es un índice de la paleta en base36
// (0-9, a-z) y "." significa transparente.
//
// Se guarda en el dispositivo como texto (compacto) y se convierte a
// imagen (data URL) solo cuando hay que dibujarla.
// ═══════════════════════════════════════════════════════════════════

export type PixelRows = string[];

export const TRANSPARENT = ".";
export const TEXTURE_SIZES = [8, 12, 16, 24, 32];

/** Paleta por defecto del estudio de texturas (16 colores). */
export const DEFAULT_PALETTE = [
  "#000000",
  "#ffffff",
  "#64748b",
  "#94a3b8",
  "#e2e8f0",
  "#7f1d1d",
  "#dc2626",
  "#f97316",
  "#facc15",
  "#4ade80",
  "#16a34a",
  "#22d3ee",
  "#2563eb",
  "#8b5cf6",
  "#8b5a2b",
  "#f5d0a9",
];

export function charToIndex(ch: string): number {
  if (ch === TRANSPARENT) return -1;
  const i = parseInt(ch, 36);
  return Number.isNaN(i) ? -1 : i;
}

export function indexToChar(i: number): string {
  if (i < 0) return TRANSPARENT;
  return i.toString(36);
}

/** Rejilla vacía del tamaño indicado. */
export function emptyPixels(size: number): PixelRows {
  return Array.from({ length: size }, () => TRANSPARENT.repeat(size));
}

/** Ajusta una rejilla a un tamaño cuadrado concreto (recortando o rellenando). */
export function normalizePixels(rows: PixelRows | undefined, size: number): PixelRows {
  const out: PixelRows = [];
  for (let y = 0; y < size; y++) {
    const row = rows?.[y] ?? "";
    let next = "";
    for (let x = 0; x < size; x++) {
      const ch = row[x];
      next += ch && /[0-9a-z.]/.test(ch) ? ch : TRANSPARENT;
    }
    out.push(next);
  }
  return out;
}

export function clonePixels(rows: PixelRows): PixelRows {
  return [...rows];
}

export function isPixelsEmpty(rows: PixelRows | undefined): boolean {
  if (!rows || rows.length === 0) return true;
  return rows.every((r) => !r || r.split("").every((c) => c === TRANSPARENT || c === ""));
}

/** Cuenta los píxeles pintados (para las estadísticas del editor). */
export function countPaintedPixels(rows: PixelRows | undefined): number {
  if (!rows) return 0;
  let total = 0;
  for (const row of rows) {
    for (const ch of row) if (ch !== TRANSPARENT && ch !== undefined) total++;
  }
  return total;
}

// ── Cache de imágenes generadas ────────────────────────────────────
const urlCache = new Map<string, string>();

/**
 * Convierte una rejilla de píxeles en una imagen (data URL PNG) lista
 * para pintar en el nivel. El resultado se cachea por contenido.
 */
export function pixelsToDataUrl(pixels: PixelRows, palette: string[]): string {
  const size = pixels.length;
  if (!size || typeof document === "undefined") return "";
  const key = `${size}|${palette.join(",")}|${pixels.join("")}`;
  const cached = urlCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  for (let y = 0; y < size; y++) {
    const row = pixels[y] ?? "";
    for (let x = 0; x < size; x++) {
      const idx = charToIndex(row[x] ?? TRANSPARENT);
      if (idx < 0) continue;
      const color = palette[idx];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const url = canvas.toDataURL("image/png");
  if (urlCache.size > 500) urlCache.clear();
  urlCache.set(key, url);
  return url;
}

// ── Herramientas de dibujo ─────────────────────────────────────────

/** Rellena una región contigua del mismo color (bote de pintura). */
export function floodFill(
  rows: PixelRows,
  palette: string[],
  x: number,
  y: number,
  colorIndex: number,
): PixelRows {
  const size = rows.length;
  if (x < 0 || y < 0 || x >= size || y >= size) return rows;
  const grid = rows.map((r) => r.split(""));
  const target = grid[y][x] ?? TRANSPARENT;
  const replacement = indexToChar(colorIndex);
  if (target === replacement) return rows;

  const stack: Array<[number, number]> = [[x, y]];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= size || cy >= size) continue;
    const k = `${cx},${cy}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if ((grid[cy][cx] ?? TRANSPARENT) !== target) continue;
    grid[cy][cx] = replacement;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  void palette;
  return grid.map((r) => r.join(""));
}

/** Pinta o borra un píxel. */
export function setPixel(
  rows: PixelRows,
  x: number,
  y: number,
  colorIndex: number,
): PixelRows {
  const size = rows.length;
  if (x < 0 || y < 0 || x >= size || y >= size) return rows;
  const ch = indexToChar(colorIndex);
  if (rows[y][x] === ch) return rows;
  const next = [...rows];
  next[y] = next[y].slice(0, x) + ch + next[y].slice(x + 1);
  return next;
}

// ── Pinceles ──────────────────────────────────────────────────────
// El lienzo se dibuja con pinceles de tamaño y forma variables: cada
// trazo interpola los puntos intermedios para no dejar huecos.

/**
 * Forma del pincel: redondo (trazo limpio), cuadrado (en bloque) o
 * suave (el borde va tramado, como un pincel de tinta).
 */
export type BrushShape = "round" | "square" | "soft";

/** Tamaños de pincel ofrecidos por el estudio (en píxeles del lienzo). */
export const BRUSH_SIZES = [1, 2, 3, 4, 6, 8];

/** Pincel máximo razonable para un lienzo de `size` píxeles. */
export function maxBrushFor(size: number): number {
  return Math.max(1, Math.min(BRUSH_SIZES[BRUSH_SIZES.length - 1], Math.floor(size / 4)));
}

/** Ruido estable por píxel: el tramado del borde suave no parpadea. */
function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Casillas que cubre un pincel centrado en (cx, cy). */
function brushCells(
  cx: number,
  cy: number,
  brush: number,
  shape: BrushShape,
): Array<[number, number]> {
  if (brush <= 1) return [[cx, cy]];
  const offset = Math.floor((brush - 1) / 2);
  const radius = brush / 2;
  // El límite deja fuera las esquinas para que el trazo salga redondeado.
  const limit = radius - 0.25;
  const cells: Array<[number, number]> = [];
  for (let dy = 0; dy < brush; dy++) {
    for (let dx = 0; dx < brush; dx++) {
      const x = cx - offset + dx;
      const y = cy - offset + dy;
      if (shape !== "square") {
        const px = dx + 0.5 - radius;
        const py = dy + 0.5 - radius;
        const d2 = px * px + py * py;
        if (d2 > limit * limit) continue;
        // El pincel suave deja el núcleo sólido y difumina el borde.
        if (shape === "soft" && d2 > 0.45 * limit * limit && hash2(x, y) > 0.45) continue;
      }
      cells.push([x, y]);
    }
  }
  return cells;
}

/**
 * Casilla rectangular que ocupa un pincel en (cx, cy): se usa para el
 * cursor de previsualización del lienzo.
 */
export function brushBounds(
  cx: number,
  cy: number,
  brush: number,
): { x: number; y: number; w: number; h: number } {
  const size = Math.max(1, brush);
  const offset = Math.floor((size - 1) / 2);
  return { x: cx - offset, y: cy - offset, w: size, h: size };
}

/**
 * Pinta un trazo de pincel de `from` a `to`. Interpola las casillas
 * intermedias para que un arrastre rápido no deje huecos, y aplica la
 * forma y el tamaño del pincel en cada paso. `-1` borra.
 */
export function paintStroke(
  rows: PixelRows,
  from: { x: number; y: number },
  to: { x: number; y: number },
  colorIndex: number,
  options: { brush: number; shape: BrushShape },
): PixelRows {
  const size = rows.length;
  const grid = rows.map((r) => r.split(""));
  const ch = indexToChar(colorIndex);
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.round(from.x + (to.x - from.x) * t);
    const cy = Math.round(from.y + (to.y - from.y) * t);
    for (const [x, y] of brushCells(cx, cy, options.brush, options.shape)) {
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      grid[y][x] = ch;
    }
  }
  return grid.map((r) => r.join(""));
}

/** Genera una rejilla a partir de una función (x, y) -> índice de paleta (-1 = vacío). */
export function pixelsFrom(size: number, fn: (x: number, y: number) => number): PixelRows {
  const out: PixelRows = [];
  for (let y = 0; y < size; y++) {
    let row = "";
    for (let x = 0; x < size; x++) row += indexToChar(fn(x, y));
    out.push(row);
  }
  return out;
}
