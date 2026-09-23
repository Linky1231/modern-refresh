// ═══════════════════════════════════════════════════════════════════
// CATÁLOGO DE RECURSOS DEL EDITOR DE NIVELES
//
// Cada recurso (asset) es una textura pixel art con su categoría:
// Bloque · Deco · Actor · Útil · Ítem · Arma.
//
// Los recursos INTEGRADOS vienen del motor (id "cat:nombre") y los del
// usuario se guardan en el dispositivo con un id propio. En el nivel se
// guarda el id del recurso + su ajuste (giro/volteo).
// ═══════════════════════════════════════════════════════════════════
import { pixelsFrom, type PixelRows } from "@/lib/textures";

export type AssetCategory = "bloque" | "deco" | "actor" | "util" | "item" | "arma";

export const ASSET_CATEGORIES: Array<{ id: AssetCategory; label: string }> = [
  { id: "bloque", label: "Bloque" },
  { id: "deco", label: "Deco" },
  { id: "actor", label: "Actor" },
  { id: "util", label: "Útil" },
  { id: "item", label: "Ítem" },
  { id: "arma", label: "Arma" },
];

export const CATEGORY_LABEL: Record<AssetCategory, string> = {
  bloque: "Bloque",
  deco: "Deco",
  actor: "Actor",
  util: "Útil",
  item: "Ítem",
  arma: "Arma",
};

export interface LevelAsset {
  id: string;
  name: string;
  category: AssetCategory;
  pixels: PixelRows;
  palette: string[];
  /** true = recurso del motor (no editable, se copia para modificarlo). */
  builtin: boolean;
}

const SIZE = 16;

function make(
  id: string,
  name: string,
  category: AssetCategory,
  palette: string[],
  fn: (x: number, y: number) => number,
): LevelAsset {
  return { id, name, category, palette, pixels: pixelsFrom(SIZE, fn), builtin: true };
}

const speck = (x: number, y: number, a: number, b: number, m: number, k: number) =>
  ((x * a + y * b) % m) === k;

// ── Bloque ─────────────────────────────────────────────────────────
const BLOCKS: LevelAsset[] = [
  make("bloque:pasto", "Pasto", "bloque", ["#8b5a2b", "#6b4423", "#5fbb46", "#3f9e33"], (x, y) => {
    if (y < 4) return y === 0 || (x + y) % 4 === 0 ? 3 : 2;
    return speck(x, y, 7, 13, 7, 0) ? 1 : 0;
  }),
  make("bloque:tierra", "Tierra", "bloque", ["#8b5a2b", "#6b4423", "#a16207"], (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return 1;
    return speck(x, y, 5, 11, 9, 0) ? 2 : 0;
  }),
  make("bloque:piedra", "Piedra", "bloque", ["#94a3b8", "#64748b", "#cbd5e1"], (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return 1;
    if ((x + y * 2) % 8 === 0) return 1;
    return speck(x, y, 3, 5, 11, 0) ? 2 : 0;
  }),
  make("bloque:ladrillo", "Ladrillo", "bloque", ["#b91c1c", "#7f1d1d", "#fca5a5"], (x, y) => {
    if (y % 4 === 0) return 1;
    const offset = Math.floor(y / 4) % 2 === 0 ? 0 : 4;
    if ((x + offset) % 8 === 0) return 1;
    return speck(x, y, 3, 7, 13, 0) ? 2 : 0;
  }),
  make("bloque:plataforma", "Plataforma", "bloque", ["#a16207", "#78350f", "#eab308"], (x, y) => {
    if (y < 3) return 2;
    if (y === 3 || y > 12) return 1;
    return x % 5 === 0 ? 1 : 0;
  }),
  make("bloque:pinchos", "Pinchos", "bloque", ["#e2e8f0", "#64748b"], (x, y) => {
    const phase = x % 4;
    const height = phase === 1 || phase === 2 ? 10 : 4;
    if (y >= 16 - height) return y > 13 ? 1 : 0;
    return -1;
  }),
];

// ── Deco ───────────────────────────────────────────────────────────
const DECO: LevelAsset[] = [
  make("deco:arbol", "Árbol", "deco", ["#14532d", "#16a34a", "#65a30d", "#78350f"], (x, y) => {
    if (y > 11) return x >= 6 && x <= 9 ? 3 : -1;
    const d = Math.hypot(x - 7.5, y - 6);
    if (d > 7) return -1;
    if (d > 5.6) return 0;
    return (x + y) % 5 === 0 ? 2 : 1;
  }),
  make("deco:arbusto", "Arbusto", "deco", ["#14532d", "#22c55e", "#86efac"], (x, y) => {
    if (Math.hypot(x - 7.5, y - 9.5) > 6 || y > 13) return -1;
    return speck(x, y, 3, 1, 6, 0) ? 2 : 1;
  }),
  make("deco:escalera", "Escalera", "deco", ["#b45309", "#78350f"], (x, y) => {
    if ((x >= 3 && x <= 4) || (x >= 11 && x <= 12)) return x === 3 || x === 11 ? 1 : 0;
    if (y % 4 === 1 && x > 4 && x < 11) return 0;
    return -1;
  }),
  make("deco:nube", "Nube", "deco", ["#ffffff", "#cbd5e1"], (x, y) => {
    if (y < 5 || y > 10 || x < 2 || x > 13) return -1;
    if (y >= 9 || x <= 3 || x >= 12) return 1;
    return 0;
  }),
  make("deco:agua", "Agua", "deco", ["#3b82f6", "#93c5fd"], (x, y) => ((x + y) % 6 === 0 ? 1 : 0)),
  make("deco:flor", "Flor", "deco", ["#16a34a", "#f472b6", "#facc15"], (x, y) => {
    if (x === 7 || x === 8) return y > 7 ? 0 : -1;
    if (y < 6 && Math.hypot(x - 7.5, y - 4) < 3.6) return y === 4 && x > 6 && x < 9 ? 2 : 1;
    if (y > 6 && y < 10 && (x === 5 || x === 10)) return 0;
    return -1;
  }),
];

// ── Actor ──────────────────────────────────────────────────────────
const ACTORS: LevelAsset[] = [
  make("actor:jugador", "Jugador", "actor", ["#1e40af", "#2563eb", "#0f172a", "#7c2d12", "#f5d0a9"], (x, y) => {
    if (y < 5) {
      if (x < 5 || x > 10) return -1;
      return y < 2 ? 3 : y === 4 ? 2 : 4;
    }
    if (y < 12) return x >= 5 && x <= 10 ? (y % 2 === 0 ? 0 : 1) : -1;
    if (y > 15) return -1;
    return x >= 5 && x <= 7 ? 2 : x >= 9 && x <= 11 ? 2 : -1;
  }),
  make("actor:enemigo", "Enemigo", "actor", ["#991b1b", "#ef4444", "#ffffff", "#0f172a"], (x, y) => {
    if (y < 3 || y > 14) return -1;
    if (x < 3 || x > 12) return -1;
    if ((y === 8 || y === 9) && (x === 5 || x === 10)) return 2;
    if ((y === 8 || y === 9) && (x === 6 || x === 9)) return 3;
    return (x + y) % 4 === 0 ? 0 : 1;
  }),
  make("actor:npc", "Aldeano", "actor", ["#7c3aed", "#a78bfa", "#0f172a", "#fde68a", "#fbbf24"], (x, y) => {
    if (y < 5) {
      if (x < 5 || x > 10) return -1;
      return y < 2 ? 4 : 3;
    }
    if (y < 12) return x >= 5 && x <= 10 ? 0 : -1;
    return x >= 5 && x <= 10 ? 2 : -1;
  }),
  make("actor:meta", "Meta", "actor", ["#16a34a", "#dc2626", "#f8fafc", "#94a3b8"], (x, y) => {
    if (x >= 7 && x <= 8) return y > 12 ? 3 : 2;
    if (y < 8 && x > 8 && x < 14) return y > 1 ? 1 : -1;
    if (x < 4 || x > 13 || y > 12) return y === 13 ? 3 : -1;
    return -1;
  }),
];

// ── Útil (interfaz) ────────────────────────────────────────────────
const UTILS: LevelAsset[] = [
  make("util:boton", "Botón", "util", ["#2563eb", "#1d4ed8", "#93c5fd"], (x, y) => {
    if (y < 5 || y > 12 || x < 1 || x > 14) return -1;
    if (y === 5 || x === 1) return 2;
    if (y === 12 || x === 14) return 1;
    return 0;
  }),
  make("util:panel", "Panel", "util", ["#1e293b", "#0f172a", "#38bdf8"], (x, y) => {
    if (y < 4 || y > 13 || x < 1 || x > 14) return -1;
    if (y === 4 || y === 13 || x === 1 || x === 14) return 2;
    return (x * 5 + y * 3) % 7 === 0 ? 1 : 0;
  }),
  make("util:texto", "Texto", "util", ["#0f172a", "#38bdf8"], (x, y) => {
    if (y === 5 || y === 9) return x > 2 && x < 13 ? 1 : -1;
    return -1;
  }),
  make("util:cursor", "Cursor", "util", ["#f8fafc", "#0f172a"], (x, y) => {
    if (y < 3 || x > 9) return -1;
    if (x > y * 0.7 + 2 && x < 9 - (y % 3)) return 1;
    return 0;
  }),
];

// ── Ítem ───────────────────────────────────────────────────────────
const ITEMS: LevelAsset[] = [
  make("item:moneda", "Moneda", "item", ["#facc15", "#b45309", "#fef9c3"], (x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d > 6) return -1;
    if (d > 5) return 1;
    return x > 6 && y < 6 ? 2 : 0;
  }),
  make("item:pocion", "Poción", "item", ["#dc2626", "#f87171", "#f8fafc", "#78350f"], (x, y) => {
    if (y < 4) return x >= 6 && x <= 9 ? 3 : -1;
    if (y < 6) return x >= 5 && x <= 10 ? 2 : -1;
    const d = Math.hypot(x - 7.5, y - 10);
    if (d > 5) return -1;
    return y > 9 ? 0 : 1;
  }),
  make("item:gema", "Gema", "item", ["#22d3ee", "#0e7490", "#cffafe"], (x, y) => {
    const dy = Math.abs(y - 8);
    const half = 8 - dy;
    if (Math.abs(x - 7.5) > half) return -1;
    return x < 7 ? 2 : x > 8 ? 1 : 0;
  }),
  make("item:cofre", "Cofre", "item", ["#a16207", "#78350f", "#facc15"], (x, y) => {
    if (y < 4 || y > 13 || x < 1 || x > 14) return -1;
    if (y === 7 || y === 8) return 1;
    if ((y === 6 || y === 9) && (x === 7 || x === 8)) return 2;
    if (y === 4 || x === 1 || x === 14 || y === 13) return 1;
    return 0;
  }),
];

// ── Arma ───────────────────────────────────────────────────────────
const WEAPONS: LevelAsset[] = [
  make("arma:espada", "Espada", "arma", ["#e2e8f0", "#94a3b8", "#78350f", "#facc15"], (x, y) => {
    if (x === y && x < 11) return 0;
    if (x === y + 1 && x < 11) return 1;
    if (y === 11 && x > 2 && x < 9) return 3;
    if (y === 12 && x > 3 && x < 8) return 2;
    if (y > 12 && x === 6) return 2;
    return -1;
  }),
  make("arma:hacha", "Hacha", "arma", ["#94a3b8", "#cbd5e1", "#78350f"], (x, y) => {
    if (x >= 6 && x <= 8) return y > 4 ? 2 : -1;
    if (y < 8 && x > 3 && x < 13) {
      if (x < 6 || y > 2) return 0;
      return 1;
    }
    return -1;
  }),
  make("arma:arco", "Arco", "arma", ["#a16207", "#f8fafc", "#78350f"], (x, y) => {
    const d = Math.hypot(x - 10.5, y - 7.5);
    if (d > 7 || d < 5) return -1;
    if (x > 10) return 2;
    return 0;
  }),
];

export const BUILTIN_ASSETS: LevelAsset[] = [
  ...BLOCKS,
  ...DECO,
  ...ACTORS,
  ...UTILS,
  ...ITEMS,
  ...WEAPONS,
];

const BUILTIN_MAP = new Map(BUILTIN_ASSETS.map((a) => [a.id, a]));

export function builtinAsset(id: string): LevelAsset | undefined {
  return BUILTIN_MAP.get(id);
}

/**
 * Compatibilidad con el pizarrón anterior: los niveles ya guardados usan
 * ids cortos ("grass", "coin"…) que se pintan con el recurso equivalente
 * del motor para no perder el trabajo hecho.
 */
export const LEGACY_TILE_MAP: Record<string, string> = {
  grass: "bloque:pasto",
  path: "bloque:tierra",
  ground: "bloque:tierra",
  water: "deco:agua",
  tree: "deco:arbol",
  mountain: "bloque:piedra",
  house: "bloque:ladrillo",
  brick: "bloque:ladrillo",
  platform: "bloque:plataforma",
  spike: "bloque:pinchos",
  chest: "item:cofre",
  coin: "item:moneda",
  boss: "actor:enemigo",
  goal: "actor:meta",
  spawn: "actor:jugador",
};

// ═══════════════════════════════════════════════════════════════════
// CELDAS DEL NIVEL
// ═══════════════════════════════════════════════════════════════════

/** Capa de interfaz: se guarda con el prefijo "ui:" en la misma rejilla. */
export const UI_PREFIX = "ui:";

export interface CellValue {
  id: string;
  /** Giro aplicado al recurso colocado (0, 90, 180, 270). */
  rot: number;
  flipH: boolean;
  flipV: boolean;
}

export function parseCell(raw: string | undefined): CellValue | null {
  if (!raw) return null;
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as Partial<CellValue>;
      if (!parsed.id) return null;
      return {
        id: String(parsed.id),
        rot: typeof parsed.rot === "number" ? parsed.rot : 0,
        flipH: !!parsed.flipH,
        flipV: !!parsed.flipV,
      };
    } catch {
      return null;
    }
  }
  return { id: raw, rot: 0, flipH: false, flipV: false };
}

export function serializeCell(cell: CellValue): string {
  if (cell.rot === 0 && !cell.flipH && !cell.flipV) return cell.id;
  return JSON.stringify(cell);
}

/** Clave de la rejilla para una celda según la capa. */
export function cellKey(x: number, y: number, layer: "map" | "ui"): string {
  return layer === "ui" ? `${UI_PREFIX}${x},${y}` : `${x},${y}`;
}

/** CSS transform para un recurso colocado (giro + volteo). */
export function cellTransform(cell: CellValue): string {
  const parts: string[] = [];
  if (cell.rot) parts.push(`rotate(${cell.rot}deg)`);
  if (cell.flipH || cell.flipV) parts.push(`scale(${cell.flipH ? -1 : 1}, ${cell.flipV ? -1 : 1})`);
  return parts.join(" ");
}
