// ▶ EDITOR DE NIVELES (Avanzado) — Asternal
// ------------------------------------------------------------------
// Amplía el pizarrón del editor de escenas con lo que faltaba para
// construir un nivel de verdad:
//
//   · DOS MODOS: "Pintar" (casillas de terreno) y "Objetos" (assets).
//   · NAVEGADOR DE ASSETS con la biblioteca del motor (sprites SVG
//     incluidos, categorías y buscador) y las fuentes externas de
//     Google: imágenes (Programmable Search / SerpAPI) y carpetas de
//     Google Drive. Los assets se eligen y se colocan DIRECTAMENTE
//     sobre la escena visible.
//   · CAPA DE OBJETOS sobre el terreno: mover arrastrando, rotar,
//     voltear, cambiar tamaño, capas (z), duplicar y borrar.
//   · Deshacer / rehacer, imán a la cuadrícula, visibilidad de capas,
//     zoom/ajuste a pantalla y exportar el nivel en JSON.
//
// Todo se guarda en el dispositivo (localStorage vía @/lib/db).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { updateMap, type MapGenre, type MapObject, type MapView } from "@/lib/db";
import {
  ASSET_CATEGORIES,
  filterEngineAssets,
  getCachedAssets,
  hasDriveLibrary,
  hasGoogleImages,
  loadAssetsConfig,
  saveAssetsConfig,
  type AssetSource,
  type AssetsConfig,
  type LibraryAsset,
} from "@/lib/asset-library";
import { listDriveImages, searchGoogleImages, testGoogleConnection } from "@/lib/google-assets";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  CircleDot,
  Copy,
  Crown,
  Download,
  Droplets,
  Eraser,
  Eye,
  EyeOff,
  Flag,
  FlipHorizontal,
  Globe,
  Grid3x3,
  HardDrive,
  Home,
  Layers,
  Link2,
  Magnet,
  Minus,
  Mountain,
  MousePointer2,
  Package,
  Pencil,
  Plus,
  Redo2,
  RotateCw,
  Search,
  Sparkles,
  Trash2,
  TreePine,
  Undo2,
  X,
} from "lucide-react";

// ── Paletas de terreno (mismas piezas que el editor de escenas) ─────
interface TileDef {
  id: string;
  label: string;
  color: string;
  icon?: React.ReactNode;
}

const RPG_TILES: TileDef[] = [
  { id: "grass", label: "Pasto", color: "#86efac" },
  { id: "path", label: "Camino", color: "#fde68a" },
  { id: "water", label: "Agua", color: "#7dd3fc", icon: <Droplets className="h-3.5 w-3.5" /> },
  { id: "tree", label: "Árbol", color: "#16a34a", icon: <TreePine className="h-3.5 w-3.5" /> },
  { id: "mountain", label: "Montaña", color: "#a8a29e", icon: <Mountain className="h-3.5 w-3.5" /> },
  { id: "house", label: "Casa", color: "#f97316", icon: <Home className="h-3.5 w-3.5" /> },
  { id: "chest", label: "Tesoro", color: "#eab308", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: "boss", label: "Jefe", color: "#dc2626", icon: <Crown className="h-3.5 w-3.5" /> },
  { id: "spawn", label: "Inicio", color: "#2563eb", icon: <CircleDot className="h-3.5 w-3.5" /> },
];

const PLATFORMER_TILES: TileDef[] = [
  { id: "ground", label: "Suelo", color: "#78716c" },
  { id: "brick", label: "Ladrillo", color: "#ea580c" },
  { id: "platform", label: "Plataforma", color: "#a3a3a3" },
  { id: "spike", label: "Pinchos", color: "#ef4444", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: "coin", label: "Moneda", color: "#facc15", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: "goal", label: "Meta", color: "#22c55e", icon: <Flag className="h-3.5 w-3.5" /> },
  { id: "spawn", label: "Inicio", color: "#2563eb", icon: <CircleDot className="h-3.5 w-3.5" /> },
];

type TileGrid = Record<string, string>;
type EditorMode = "paint" | "objects";

interface Snapshot {
  tiles: TileGrid;
  objects: MapObject[];
}

const MAX_HISTORY = 40;

function tilesForGenre(genre: MapGenre) {
  return genre === "rpg" ? RPG_TILES : PLATFORMER_TILES;
}

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "nivel"
  );
}

export interface LevelEditorProps {
  scene: MapView;
  ownerId: string;
  onBack: () => void;
}

// ════════════════════════════════════════════════════════════════════
// Editor de niveles
// ════════════════════════════════════════════════════════════════════
export default function LevelEditor({ scene, ownerId, onBack }: LevelEditorProps) {
  const tiles = useMemo(() => tilesForGenre(scene.genre), [scene.genre]);

  const [mode, setMode] = useState<EditorMode>("paint");
  const [activeTile, setActiveTile] = useState<string>(tiles[0].id);
  const [erasing, setErasing] = useState(false);
  const [grid, setGrid] = useState<TileGrid>(scene.tiles ?? {});
  const [objects, setObjects] = useState<MapObject[]>(scene.objects ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [armed, setArmed] = useState<LibraryAsset | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [snap, setSnap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showTiles, setShowTiles] = useState(true);
  const [showObjects, setShowObjects] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [config, setConfig] = useState<AssetsConfig>(() => loadAssetsConfig());

  const painting = useRef(false);
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const canvasWrap = useRef<HTMLDivElement | null>(null);
  const [viewportW, setViewportW] = useState(360);

  // El estado se inicializa desde la escena y el componente se remonta con
  // `key={scene._id}` al cambiar de mapa (ver SceneEditorPage).

  // Ancho disponible: define el tamaño de casilla y el ajuste a pantalla.
  useEffect(() => {
    const el = canvasWrap.current;
    if (!el) return;
    const measure = () => setViewportW(el.clientWidth || 360);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const baseCell = clamp(Math.floor((viewportW - 18) / scene.width), 8, 26);
  const cellPx = clamp(Math.round(baseCell * zoom), 6, 44);

  const selected = objects.find((o) => o.id === selectedId) ?? null;
  const sorted = useMemo(() => [...objects].sort((a, b) => a.z - b.z), [objects]);

  // ── Historial ─────────────────────────────────────────────
  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), { tiles: grid, objects }]);
    setFuture([]);
    setDirty(true);
  }, [grid, objects]);

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture((f) => [{ tiles: grid, objects }, ...f].slice(0, MAX_HISTORY));
    setHistory((h) => h.slice(0, -1));
    setGrid(prev.tiles);
    setObjects(prev.objects);
    setSelectedId(null);
    setDirty(true);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), { tiles: grid, objects }]);
    setFuture((f) => f.slice(1));
    setGrid(next.tiles);
    setObjects(next.objects);
    setSelectedId(null);
    setDirty(true);
  };

  // ── Terreno ───────────────────────────────────────────────
  const paintAt = useCallback(
    (x: number, y: number) => {
      const key = `${x},${y}`;
      setGrid((prev) => {
        if (erasing) {
          if (!(key in prev)) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        }
        if (prev[key] === activeTile) return prev;
        return { ...prev, [key]: activeTile };
      });
    },
    [activeTile, erasing],
  );

  const handleCellDown = (x: number, y: number) => {
    if (mode !== "paint") return;
    painting.current = true;
    pushHistory();
    paintAt(x, y);
  };

  const handleCellEnter = (x: number, y: number) => {
    if (mode !== "paint" || !painting.current) return;
    paintAt(x, y);
  };

  useEffect(() => {
    const stop = () => {
      painting.current = false;
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  // ── Objetos ───────────────────────────────────────────────
  const nextZ = useCallback(() => {
    return objects.reduce((max, o) => Math.max(max, o.z), 0) + 1;
  }, [objects]);

  const placeAsset = useCallback(
    (asset: LibraryAsset, cellX: number, cellY: number) => {
      const span = clamp(Math.round(asset.span || 1), 1, 8);
      pushHistory();
      const maxX = Math.max(0, scene.width - span);
      const maxY = Math.max(0, scene.height - span);
      const rawX = cellX - Math.floor(span / 2);
      const rawY = cellY - Math.floor(span / 2);
      const x = clamp(snap ? Math.round(rawX) : rawX, 0, maxX);
      const y = clamp(snap ? Math.round(rawY) : rawY, 0, maxY);
      const object: MapObject = {
        id: uid(),
        assetId: asset.id,
        name: asset.name,
        url: asset.url,
        source: asset.source,
        x,
        y,
        w: span,
        h: span,
        rotation: 0,
        flipX: false,
        opacity: 1,
        z: nextZ(),
      };
      setObjects((prev) => [...prev, object]);
      setSelectedId(object.id);
    },
    [nextZ, pushHistory, scene.height, scene.width, snap],
  );

  const updateObject = (id: string, patch: Partial<MapObject>) => {
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    setDirty(true);
  };

  const onObjectPointerDown = (event: React.PointerEvent, object: MapObject) => {
    // Con un asset armado, el toque pasa a la escena para colocarlo.
    if (mode !== "objects" || armed) return;
    event.stopPropagation();
    setSelectedId(object.id);
    drag.current = {
      id: object.id,
      sx: event.clientX,
      sy: event.clientY,
      ox: object.x,
      oy: object.y,
    };
    setDragging(true);
    pushHistory();
  };

  useEffect(() => {
    if (!dragging) return;
    const target = drag.current;
    if (!target) {
      setDragging(false);
      return;
    }
    const step = snap ? 1 : 0.25;
    const onMove = (event: PointerEvent) => {
      setObjects((prev) =>
        prev.map((o) => {
          if (o.id !== target.id) return o;
          const dx = (event.clientX - target.sx) / cellPx;
          const dy = (event.clientY - target.sy) / cellPx;
          const maxX = Math.max(0, scene.width - o.w);
          const maxY = Math.max(0, scene.height - o.h);
          return {
            ...o,
            x: clamp(Math.round((target.ox + dx) / step) * step, 0, maxX),
            y: clamp(Math.round((target.oy + dy) / step) * step, 0, maxY),
          };
        }),
      );
      setDirty(true);
    };
    const onUp = () => {
      drag.current = null;
      setDragging(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, cellPx, snap, scene.width, scene.height]);

  const resizeSelected = (delta: number) => {
    if (!selected) return;
    pushHistory();
    const size = clamp(Math.round(selected.w) + delta, 1, 10);
    updateObject(selected.id, {
      w: size,
      h: size,
      x: clamp(selected.x, 0, Math.max(0, scene.width - size)),
      y: clamp(selected.y, 0, Math.max(0, scene.height - size)),
    });
  };

  const duplicateSelected = () => {
    if (!selected) return;
    pushHistory();
    const copy: MapObject = {
      ...selected,
      id: uid(),
      x: clamp(selected.x + 1, 0, Math.max(0, scene.width - selected.w)),
      y: clamp(selected.y + 1, 0, Math.max(0, scene.height - selected.h)),
      z: nextZ(),
    };
    setObjects((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  };

  const deleteSelected = () => {
    if (!selected) return;
    pushHistory();
    setObjects((prev) => prev.filter((o) => o.id !== selected.id));
    setSelectedId(null);
  };

  const clearLayer = (layer: "tiles" | "objects") => {
    pushHistory();
    if (layer === "tiles") setGrid({});
    else setObjects([]);
    toast.success(layer === "tiles" ? "Terreno borrado" : "Objetos borrados");
  };

  // ── Guardar / exportar ────────────────────────────────────
  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateMap(ownerId, scene._id, { tiles: grid, objects });
      setDirty(false);
      toast.success("Nivel guardado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar el nivel");
    } finally {
      setSaving(false);
    }
  };

  const exportLevel = () => {
    const payload = {
      name: scene.name,
      description: scene.description,
      genre: scene.genre,
      width: scene.width,
      height: scene.height,
      background: scene.background,
      tiles: grid,
      objects,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(scene.name)}.nivel.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Nivel exportado");
  };

  const handleBack = () => {
    if (dirty) setConfirmExit(true);
    else onBack();
  };

  const cellFromEvent = (event: { clientX: number; clientY: number }, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return {
      x: Math.floor((event.clientX - rect.left) / cellPx),
      y: Math.floor((event.clientY - rect.top) / cellPx),
    };
  };

  const canvasWidth = scene.width * cellPx;
  const canvasHeight = scene.height * cellPx;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto flex min-h-0 w-full max-w-sm flex-1 flex-col"
      >
        {/* ── Cabecera ── */}
        <div className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Volver a las escenas"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <div className="h-6 w-px shrink-0 bg-slate-200" />
          <div className="min-w-0 flex-1 pl-1">
            <p className="truncate text-[13px] font-semibold tracking-tight text-slate-800">
              {scene.name}
            </p>
            <p className="text-[10px] text-slate-400">
              {scene.genre === "rpg" ? "RPG" : "Plataformas"} · {scene.width}×{scene.height}
              {dirty ? " · sin guardar" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
          >
            {saving ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Guardar
          </button>
        </div>

        {/* ── Modo + herramientas ── */}
        <div className="mt-2 flex shrink-0 items-center gap-1.5">
          <div className="flex h-9 flex-1 rounded-xl bg-slate-200/70 p-0.5">
            {(
              [
                { id: "paint" as EditorMode, label: "Pintar", icon: <Pencil className="h-3.5 w-3.5" /> },
                { id: "objects" as EditorMode, label: "Objetos", icon: <Package className="h-3.5 w-3.5" /> },
              ]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMode(m.id);
                  if (m.id === "paint") setArmed(null);
                  else painting.current = false;
                }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] text-xs font-semibold transition-all ${
                  mode === m.id
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setBrowserOpen(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-2.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15"
          >
            <Package className="h-3.5 w-3.5" />
            Assets
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={history.length === 0}
            aria-label="Deshacer"
            title="Deshacer"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={future.length === 0}
            aria-label="Rehacer"
            title="Rehacer"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-40"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ── Franja contextual ── */}
        <div className="mt-2 shrink-0">
          {mode === "paint" ? (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setErasing((v) => !v)}
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
                  erasing
                    ? "border-red-300 bg-red-50 text-red-600"
                    : "border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:text-red-500"
                }`}
              >
                <Eraser className="h-3.5 w-3.5" />
                Borrar
              </button>
              <div className="mx-0.5 w-px self-stretch bg-slate-200" />
              {tiles.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setActiveTile(t.id);
                    setErasing(false);
                  }}
                  title={t.label}
                  className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-all ${
                    !erasing && activeTile === t.id
                      ? "border-primary/60 ring-2 ring-primary/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded text-white"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.icon ?? null}
                  </span>
                  <span className="text-slate-700">{t.label}</span>
                </button>
              ))}
            </div>
          ) : armed ? (
            <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-1.5">
              <img
                src={armed.thumb ?? armed.url}
                alt=""
                referrerPolicy="no-referrer"
                className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain p-0.5"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-slate-800">{armed.name}</p>
                <p className="text-[10px] text-slate-500">Toca la escena para colocarlo</p>
              </div>
              <button
                type="button"
                onClick={() => setArmed(null)}
                className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-2.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-200"
              >
                Listo
              </button>
            </div>
          ) : selected ? (
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MousePointer2 className="h-3.5 w-3.5" />
              </span>
              <p className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-700">
                {selected.name}
              </p>
              {[
                {
                  label: "Rotar 90°",
                  icon: <RotateCw className="h-3.5 w-3.5" />,
                  run: () => {
                    pushHistory();
                    updateObject(selected.id, { rotation: (selected.rotation + 90) % 360 });
                  },
                },
                {
                  label: "Voltear",
                  icon: <FlipHorizontal className="h-3.5 w-3.5" />,
                  run: () => {
                    pushHistory();
                    updateObject(selected.id, { flipX: !selected.flipX });
                  },
                },
                {
                  label: "Hacer más pequeño",
                  icon: <Minus className="h-3.5 w-3.5" />,
                  run: () => resizeSelected(-1),
                },
                {
                  label: "Hacer más grande",
                  icon: <Plus className="h-3.5 w-3.5" />,
                  run: () => resizeSelected(1),
                },
                {
                  label: "Subir capa",
                  icon: <ArrowUp className="h-3.5 w-3.5" />,
                  run: () => {
                    pushHistory();
                    updateObject(selected.id, { z: nextZ() });
                  },
                },
                {
                  label: "Bajar capa",
                  icon: <ArrowDown className="h-3.5 w-3.5" />,
                  run: () => {
                    pushHistory();
                    const min = objects.reduce((m, o) => Math.min(m, o.z), 1);
                    updateObject(selected.id, { z: min - 1 });
                  },
                },
                {
                  label: "Duplicar",
                  icon: <Copy className="h-3.5 w-3.5" />,
                  run: duplicateSelected,
                },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.run}
                  aria-label={action.label}
                  title={action.label}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  {action.icon}
                </button>
              ))}
              <button
                type="button"
                onClick={deleteSelected}
                aria-label="Eliminar objeto"
                title="Eliminar objeto"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 transition-colors hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/60 px-3 py-2">
              <Package className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <p className="min-w-0 flex-1 text-[11px] leading-snug text-slate-500">
                Abre <span className="font-semibold text-slate-600">Assets</span> y toca una pieza
                para colocarla. Arrastra los objetos sobre la escena para moverlos.
              </p>
            </div>
          )}
        </div>

        {/* ── Escena ── */}
        <div
          ref={canvasWrap}
          className="mt-2 flex min-h-0 flex-1 flex-col overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
        >
          <div
            className="relative select-none"
            style={{ width: canvasWidth, height: canvasHeight, background: scene.background }}
            onPointerLeave={() => {
              painting.current = false;
            }}
          >
            {showTiles && (
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${scene.width}, ${cellPx}px)`,
                  gridTemplateRows: `repeat(${scene.height}, ${cellPx}px)`,
                }}
              >
                {Array.from({ length: scene.width * scene.height }, (_, i) => {
                  const x = i % scene.width;
                  const y = Math.floor(i / scene.width);
                  const key = `${x},${y}`;
                  const tileId = grid[key];
                  const tile = tileId ? tiles.find((t) => t.id === tileId) : null;
                  return (
                    <div
                      key={key}
                      onPointerDown={(e) => {
                        if (mode !== "paint") return;
                        e.preventDefault();
                        handleCellDown(x, y);
                      }}
                      onPointerEnter={() => handleCellEnter(x, y)}
                      className={showGrid ? "border-[0.5px] border-slate-300/50" : ""}
                      style={{
                        backgroundColor: tile ? tile.color : undefined,
                        cursor: mode === "paint" ? "crosshair" : "default",
                      }}
                    >
                      {tile?.icon ? (
                        <span className="flex h-full w-full items-center justify-center text-white/85">
                          {tile.icon}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Capa de objetos */}
            <div
              className="absolute inset-0"
              style={{ pointerEvents: mode === "objects" && !dragging ? "auto" : "none" }}
              onPointerDown={(e) => {
                if (mode !== "objects") return;
                if (armed) {
                  const cell = cellFromEvent(e, e.currentTarget);
                  placeAsset(armed, cell.x, cell.y);
                  return;
                }
                setSelectedId(null);
              }}
            >
              {showObjects &&
                sorted.map((object) => (
                  <motion.div
                    key={object.id}
                    initial={{
                      scale: 0.85,
                      opacity: 0,
                      rotate: object.rotation,
                      scaleX: object.flipX ? -1 : 1,
                    }}
                    animate={{
                      scale: 1,
                      opacity: object.opacity,
                      rotate: object.rotation,
                      scaleX: object.flipX ? -1 : 1,
                    }}
                    transition={{ duration: 0.16 }}
                    onPointerDown={(e) => onObjectPointerDown(e, object)}
                    className={`absolute ${
                      mode === "objects" && !armed ? "cursor-move" : ""
                    } ${selectedId === object.id ? "ring-2 ring-primary ring-offset-1" : ""}`}
                    style={{
                      left: object.x * cellPx,
                      top: object.y * cellPx,
                      width: Math.max(1, object.w * cellPx),
                      height: Math.max(1, object.h * cellPx),
                      zIndex: 10 + object.z,
                      touchAction: "none",
                    }}
                  >
                    <img
                      src={object.url}
                      alt={object.name}
                      referrerPolicy="no-referrer"
                      draggable={false}
                      className="h-full w-full select-none object-contain"
                    />
                  </motion.div>
                ))}
            </div>
          </div>
        </div>

        {/* ── Vista: capas, imán, zoom ── */}
        <div className="mt-2 flex shrink-0 items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setShowTiles((v) => !v)}
            title="Mostrar terreno"
            aria-label="Mostrar terreno"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
              showTiles ? "bg-slate-100 text-slate-700" : "bg-slate-100/60 text-slate-300"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowObjects((v) => !v)}
            title="Mostrar objetos"
            aria-label="Mostrar objetos"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
              showObjects ? "bg-slate-100 text-slate-700" : "bg-slate-100/60 text-slate-300"
            }`}
          >
            {showObjects ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setShowGrid((v) => !v)}
            title="Cuadrícula"
            aria-label="Cuadrícula"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
              showGrid ? "bg-slate-100 text-slate-700" : "bg-slate-100/60 text-slate-300"
            }`}
          >
            <Grid3x3 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setSnap((v) => !v)}
            title="Imán a la cuadrícula"
            aria-label="Imán a la cuadrícula"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
              snap ? "bg-primary/10 text-primary" : "bg-slate-100/60 text-slate-400"
            }`}
          >
            <Magnet className="h-3.5 w-3.5" />
          </button>

          <div className="mx-0.5 h-5 w-px shrink-0 bg-slate-200" />

          <button
            type="button"
            onClick={() => setZoom((z) => clamp(z - 0.2, 0.6, 2))}
            aria-label="Alejar"
            title="Alejar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            title="Ajustar a pantalla"
            className="flex h-8 shrink-0 items-center rounded-lg bg-slate-100 px-2 text-[10px] font-semibold tabular-nums text-slate-600 transition-colors hover:bg-slate-200"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => clamp(z + 0.2, 0.6, 2))}
            aria-label="Acercar"
            title="Acercar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => clearLayer(mode === "paint" ? "tiles" : "objects")}
              title={mode === "paint" ? "Vaciar el terreno" : "Vaciar los objetos"}
              aria-label={mode === "paint" ? "Vaciar el terreno" : "Vaciar los objetos"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Eraser className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={exportLevel}
              title="Exportar nivel (JSON)"
              aria-label="Exportar nivel"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <p className="mt-1.5 shrink-0 px-1 text-[10px] leading-snug text-slate-500">
          {mode === "paint"
            ? "Arrastra el dedo o el mouse para pintar el terreno de la escena."
            : armed
              ? "Toca cualquier casilla para colocar el asset. Mantén “Listo” para volver a editar."
              : "Toca un objeto para seleccionarlo y arrástralo para moverlo. Usa Assets para añadir más."}
        </p>
      </motion.div>

      {/* Navegador de assets */}
      <AnimatePresence>
        {browserOpen && (
          <AssetBrowser
            genre={scene.genre}
            config={config}
            onClose={() => setBrowserOpen(false)}
            onSaveConfig={(next) => {
              setConfig(next);
              saveAssetsConfig(next);
            }}
            onPick={(asset) => {
              setArmed(asset);
              setMode("objects");
              setBrowserOpen(false);
              toast.success(`Coloca “${asset.name}” en la escena`);
            }}
          />
        )}
      </AnimatePresence>

      {/* Confirmación al salir con cambios */}
      <AnimatePresence>
        {confirmExit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setConfirmExit(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              className="w-full max-w-xs overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center px-5 pb-4 pt-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <AlertTriangle className="h-6 w-6" />
                </span>
                <h3 className="mt-3 text-[15px] font-bold text-slate-800">Cambios sin guardar</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
                  Si sales ahora perderás lo último que pintaste o colocaste en esta escena.
                </p>
              </div>
              <div className="flex gap-2 border-t border-slate-100 p-3">
                <button
                  type="button"
                  onClick={() => setConfirmExit(false)}
                  className="h-10 flex-1 rounded-xl bg-slate-100 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
                >
                  Seguir editando
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmExit(false);
                    onBack();
                  }}
                  className="h-10 flex-1 rounded-xl bg-red-600 text-xs font-semibold text-white transition-colors hover:bg-red-700"
                >
                  Salir sin guardar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Navegador de assets (biblioteca del motor + fuentes de Google)
// ════════════════════════════════════════════════════════════════════
function AssetBrowser({
  genre,
  config,
  onSaveConfig,
  onPick,
  onClose,
}: {
  genre: MapGenre;
  config: AssetsConfig;
  onSaveConfig: (config: AssetsConfig) => void;
  onPick: (asset: LibraryAsset) => void;
  onClose: () => void;
}) {
  const [source, setSource] = useState<AssetSource>("engine");
  const [category, setCategory] = useState("todas");
  const [query, setQuery] = useState("");
  const [external, setExternal] = useState<LibraryAsset[]>(() => getCachedAssets());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextStart, setNextStart] = useState<number | null>(null);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [draft, setDraft] = useState<AssetsConfig>(config);
  const [testing, setTesting] = useState(false);

  const engineAssets = useMemo(
    () => filterEngineAssets(genre, category, query),
    [genre, category, query],
  );

  const googleReady = hasGoogleImages(config);
  const driveReady = hasDriveLibrary(config);

  const externalFiltered = useMemo(() => {
    const wanted: AssetSource = source === "drive" ? "drive" : "google";
    const list = external.filter((a) => a.source === wanted);
    const q = query.trim().toLowerCase();
    return q ? list.filter((a) => a.name.toLowerCase().includes(q)) : list;
  }, [external, query, source]);

  const runSearch = async (more = false) => {
    if (!googleReady) {
      setShowConnect(true);
      setError("Conecta tu clave de Google (o de SerpAPI) para buscar imágenes.");
      return;
    }
    if (!query.trim()) {
      setError("Escribe qué asset buscas. Ej: “roca pixel art”, “fuente medieval”.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const start = more && nextStart ? nextStart : 1;
      const page = await searchGoogleImages(query, config, start);
      setExternal((prev) => (more ? mergeAssets(prev, page.assets) : mergeAssets(getCachedAssets(), page.assets)));
      setNextStart(page.nextStart);
      if (page.assets.length === 0) setError("Google no devolvió resultados para esa búsqueda.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo buscar en Google.");
    } finally {
      setLoading(false);
    }
  };

  const loadDrive = async (more = false) => {
    if (!driveReady) {
      setShowConnect(true);
      setError("Añade la clave de API y el id de la carpeta de Drive.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const page = await listDriveImages(config, more && driveToken ? driveToken : undefined);
      setExternal((prev) => mergeAssets(prev, page.assets));
      setDriveToken(page.nextPageToken);
      if (page.assets.length === 0) setError("La carpeta no tiene imágenes públicas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer la carpeta de Drive.");
    } finally {
      setLoading(false);
    }
  };

  const changeSource = (next: AssetSource) => {
    setSource(next);
    setError(null);
    setNextStart(null);
    if (next === "drive" && driveReady && !external.some((a) => a.source === "drive")) {
      void loadDrive();
    }
  };

  const saveAndTest = async () => {
    setTesting(true);
    setError(null);
    try {
      onSaveConfig(draft);
      const message = await testGoogleConnection(draft);
      toast.success(message);
      setShowConnect(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo conectar.";
      setError(message);
      toast.error("Conexión fallida");
    } finally {
      setTesting(false);
    }
  };

  const sources: Array<{ id: AssetSource; label: string; icon: React.ReactNode; ready: boolean }> = [
    { id: "engine", label: "Motor", icon: <Sparkles className="h-3.5 w-3.5" />, ready: true },
    { id: "google", label: "Google", icon: <Globe className="h-3.5 w-3.5" />, ready: googleReady },
    { id: "drive", label: "Drive", icon: <HardDrive className="h-3.5 w-3.5" />, ready: driveReady },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[92] flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 32, opacity: 0 }}
        transition={{ duration: 0.22 }}
        className="flex max-h-[86vh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-4 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Package className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-slate-800">Biblioteca de assets</p>
            <p className="text-[10px] text-slate-400">
              {source === "engine"
                ? `${engineAssets.length} pieza(s) del motor`
                : `${externalFiltered.length} asset(s) ${source === "drive" ? "de Drive" : "de Google"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar biblioteca"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Fuente */}
        <div className="flex shrink-0 gap-1.5 px-4 pt-3">
          {sources.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => changeSource(s.id)}
              className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full border text-[11px] font-semibold transition-colors ${
                source === s.id
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-slate-200 bg-white text-slate-500 hover:border-primary/30"
              }`}
            >
              {s.icon}
              {s.label}
              {!s.ready && s.id !== "engine" && (
                <span className="text-[9px] font-bold uppercase text-slate-400">clave</span>
              )}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="shrink-0 px-4 pt-2.5">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (source === "engine") setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && source !== "engine") void runSearch();
                }}
                placeholder={
                  source === "drive"
                    ? "Filtrar la carpeta de Drive…"
                    : "Buscar: roca, fuente medieval, ui…"
                }
                className="h-9 rounded-xl border-slate-200 bg-white pl-9 text-xs text-slate-800 placeholder:text-slate-400"
              />
            </div>
            {source !== "engine" && (
              <button
                type="button"
                onClick={() => void runSearch()}
                disabled={loading}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {loading ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Search className="h-3 w-3" />
                )}
                Buscar
              </button>
            )}
          </div>

          {/* Categorías (solo biblioteca del motor) */}
          {source === "engine" && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {[{ id: "todas", label: "Todas" }, ...ASSET_CATEGORIES].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`h-7 shrink-0 rounded-full border px-2.5 text-[11px] font-medium transition-colors ${
                    category === c.id
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-slate-200 bg-white text-slate-500 hover:border-primary/30"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Conexión con Google */}
          {source !== "engine" && (
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setShowConnect((v) => !v)}
                className="flex w-full items-center gap-2 bg-slate-50 px-3 py-2 text-left"
              >
                <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 text-[11px] font-semibold text-slate-700">
                  {googleReady || driveReady
                    ? "Conexión con Google configurada"
                    : "Conectar con Google (clave de API)"}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
                    showConnect ? "rotate-180" : ""
                  }`}
                />
              </button>
              {showConnect && (
                <div className="border-t border-slate-100 p-3">
                  <p className="text-[11px] leading-snug text-slate-500">
                    La clave se guarda solo en este dispositivo. Elige una vía:
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    {(
                      [
                        { id: "google" as const, label: "Google Cloud" },
                        { id: "serpapi" as const, label: "SerpAPI" },
                      ]
                    ).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, provider: p.id }))}
                        className={`h-7 flex-1 rounded-full border text-[11px] font-semibold transition-colors ${
                          draft.provider === p.id
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-slate-200 bg-white text-slate-500"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {draft.provider === "serpapi" ? (
                    <label className="mt-2 block">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Clave de SerpAPI
                      </span>
                      <Input
                        value={draft.serpApiKey}
                        onChange={(e) => setDraft((d) => ({ ...d, serpApiKey: e.target.value }))}
                        placeholder="pega aquí tu clave"
                        className="mt-1 h-9 rounded-xl border-slate-200 text-xs"
                      />
                      <span className="mt-1 block text-[10px] text-slate-400">
                        Una sola clave sirve la búsqueda de imágenes de Google.
                      </span>
                    </label>
                  ) : (
                    <>
                      <label className="mt-2 block">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Clave de API (Google Cloud)
                        </span>
                        <Input
                          value={draft.googleApiKey}
                          onChange={(e) => setDraft((d) => ({ ...d, googleApiKey: e.target.value }))}
                          placeholder="AIza…"
                          className="mt-1 h-9 rounded-xl border-slate-200 text-xs"
                        />
                      </label>
                      <label className="mt-2 block">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Id del buscador (cx)
                        </span>
                        <Input
                          value={draft.googleCx}
                          onChange={(e) => setDraft((d) => ({ ...d, googleCx: e.target.value }))}
                          placeholder="0123456789:abcdefgh"
                          className="mt-1 h-9 rounded-xl border-slate-200 text-xs"
                        />
                      </label>
                      <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
                        Habilita “Custom Search API” en tu proyecto de Google Cloud y crea un motor de
                        búsqueda con búsqueda de imágenes activada.
                      </p>
                    </>
                  )}

                  <label className="mt-2 block">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Carpeta de Google Drive (opcional)
                    </span>
                    <Input
                      value={draft.driveFolderId}
                      onChange={(e) => setDraft((d) => ({ ...d, driveFolderId: e.target.value }))}
                      placeholder="id de la carpeta compartida"
                      className="mt-1 h-9 rounded-xl border-slate-200 text-xs"
                    />
                    <span className="mt-1 block text-[10px] text-slate-400">
                      Comparte la carpeta como “cualquier persona con el enlace”.
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => void saveAndTest()}
                    disabled={testing}
                    className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-[11px] font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
                  >
                    {testing ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Guardar y probar conexión
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[11px] leading-snug text-red-600">
              {error}
            </p>
          )}
        </div>

        {/* Cuadrícula de assets */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {source === "engine" ? (
            engineAssets.length === 0 ? (
              <EmptyHint message="Ninguna pieza del motor coincide con esa búsqueda." />
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {engineAssets.map((asset) => (
                  <AssetTile key={asset.id} asset={asset} onPick={onPick} />
                ))}
              </div>
            )
          ) : externalFiltered.length === 0 ? (
            <EmptyHint
              message={
                source === "drive"
                  ? "Configura la carpeta de Drive para ver tus assets."
                  : "Busca en Google para traer assets (ej: “sprite caballero”)."
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {externalFiltered.map((asset) => (
                  <AssetTile key={asset.id} asset={asset} onPick={onPick} />
                ))}
              </div>
              {source === "google" && nextStart !== null && (
                <button
                  type="button"
                  onClick={() => void runSearch(true)}
                  disabled={loading}
                  className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
                >
                  Más resultados
                </button>
              )}
              {source === "drive" && driveToken && (
                <button
                  type="button"
                  onClick={() => void loadDrive(true)}
                  disabled={loading}
                  className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
                >
                  Más archivos
                </button>
              )}
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-4 py-2">
          <p className="text-[10px] leading-snug text-slate-400">
            Toca una pieza para colocarla en la escena visible. Los assets externos se guardan en este
            dispositivo para que sigan disponibles sin conexión.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AssetTile({
  asset,
  onPick,
}: {
  asset: LibraryAsset;
  onPick: (asset: LibraryAsset) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(asset)}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-left transition-all hover:border-primary/50 hover:shadow-sm active:scale-[0.98]"
    >
      <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-slate-50">
        <img
          src={asset.thumb ?? asset.url}
          alt={asset.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          draggable={false}
          className="h-full w-full object-contain p-1"
        />
      </span>
      <span className="mt-1 line-clamp-2 text-[10px] font-medium leading-tight text-slate-600">
        {asset.name}
      </span>
    </button>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 py-8 text-center">
      <Package className="h-6 w-6 text-slate-300" />
      <p className="mt-2 max-w-[220px] text-[11px] leading-snug text-slate-500">{message}</p>
    </div>
  );
}

function mergeAssets(current: LibraryAsset[], incoming: LibraryAsset[]) {
  const seen = new Set(current.map((a) => a.id));
  const merged = [...current];
  for (const asset of incoming) {
    if (seen.has(asset.id)) continue;
    seen.add(asset.id);
    merged.push(asset);
  }
  return merged;
}
