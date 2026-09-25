// ═══════════════════════════════════════════════════════════════════
// ESTUDIO DE TEXTURAS — lienzo de dibujo de un recurso
//
// Se abre al crear un recurso nuevo ("+") o al editar la textura de un
// recurso guardado. Es un lienzo de verdad: papel continuo (sin rejilla
// de bloques), superficie que se amplía y mueve con zoom y paneo, y
// trazos suavizados con pinceles de tamaño y forma.
//
// Herramientas: pincel, goma, relleno, cuentagotas y mano (mover).
// El menú de tres puntos ofrece:
//   · «Aplicar al asset original» -> guarda una copia con los cambios y
//     deja el recurso original intacto.
//   · «Guardar nuevo recurso»     -> guarda el lienzo como recurso nuevo.
//   · «Vaciar lienzo»             -> deja el lienzo en blanco.
// ═══════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Paintbrush,
  Eraser,
  PaintBucket,
  Pipette,
  Hand,
  Undo2,
  Redo2,
  Grid3x3,
  MoreVertical,
  Check,
  Copy,
  FilePlus2,
  Save,
  Trash2,
  Circle,
  Square,
  Waves,
  Minus,
  Plus,
  Locate,
} from "lucide-react";
import { toast } from "sonner";
import { createAsset, duplicateAsset, updateAsset, type AssetCategory, type AssetView } from "@/lib/db";
import {
  BRUSH_SIZES,
  DEFAULT_PALETTE,
  TEXTURE_SIZES,
  brushBounds,
  charToIndex,
  emptyPixels,
  floodFill,
  isPixelsEmpty,
  maxBrushFor,
  normalizePixels,
  paintStroke,
  pixelsToDataUrl,
  type BrushShape,
  type PixelRows,
} from "@/lib/textures";
import { CATEGORY_LABEL } from "./levelAssets";

type Tool = "brush" | "eraser" | "bucket" | "picker" | "pan";

/** Textura de partida para un recurso nuevo (p. ej. un recurso del motor). */
export interface SeedTexture {
  name: string;
  pixels: PixelRows;
  palette: string[];
  size: number;
}

interface TextureStudioProps {
  ownerId: string;
  category: AssetCategory;
  /** Recurso guardado que se está editando; null = textura nueva. */
  asset: AssetView | null;
  /** Textura de partida cuando no se edita un recurso guardado. */
  seed?: SeedTexture | null;
  onClose: () => void;
  /** Se llama cuando el recurso se ha guardado (creado, actualizado o copiado). */
  onSaved: (asset: AssetView) => void;
}

const TOOLS: Array<{ id: Tool; label: string; hint: string; icon: React.ReactNode }> = [
  { id: "brush", label: "Pincel", hint: "Pinta trazos con el color activo", icon: <Paintbrush className="h-4 w-4" /> },
  { id: "eraser", label: "Goma", hint: "Borra con el tamaño del pincel", icon: <Eraser className="h-4 w-4" /> },
  { id: "bucket", label: "Relleno", hint: "Rellena la zona contigua del mismo color", icon: <PaintBucket className="h-4 w-4" /> },
  { id: "picker", label: "Cuentagotas", hint: "Toma el color de un píxel del lienzo", icon: <Pipette className="h-4 w-4" /> },
  { id: "pan", label: "Mano", hint: "Arrastra para mover el lienzo", icon: <Hand className="h-4 w-4" /> },
];

/** Pinceles: redondo, cuadrado (en bloque) y suave (borde tramado). */
const SHAPES: Array<{ id: BrushShape; label: string; icon: React.ReactNode }> = [
  { id: "round", label: "Redondo", icon: <Circle className="h-3.5 w-3.5" /> },
  { id: "square", label: "Cuadrado", icon: <Square className="h-3.5 w-3.5" /> },
  { id: "soft", label: "Suave", icon: <Waves className="h-3.5 w-3.5" /> },
];

const ZOOMS = [1, 2, 3, 4, 6, 8];
/** Muestras del puntero promediadas: quita el temblor de la mano. */
const SMOOTHING = 5;

/** El papel del lienzo: punteado suave, no una cuadrícula de cuadros. */
const PAPER: React.CSSProperties = {
  backgroundColor: "var(--card)",
  backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
  backgroundSize: "14px 14px",
};

export default function TextureStudio({
  ownerId,
  category,
  asset,
  seed = null,
  onClose,
  onSaved,
}: TextureStudioProps) {
  const base = asset ?? seed;
  const initialSize = base?.size ?? 16;
  const [name, setName] = useState(asset?.name ?? (seed ? `${seed.name} propio` : ""));
  const [size, setSize] = useState(initialSize);
  const [palette, setPalette] = useState<string[]>(
    base?.palette?.length ? base.palette : DEFAULT_PALETTE.slice(0, 12),
  );
  const [pixels, setPixels] = useState<PixelRows>(() =>
    base?.pixels?.length ? normalizePixels(base.pixels, initialSize) : emptyPixels(initialSize),
  );
  const [tool, setTool] = useState<Tool>("brush");
  const [colorIndex, setColorIndex] = useState(9);
  const [brush, setBrush] = useState(2);
  const [brushShape, setBrushShape] = useState<BrushShape>("round");
  const [showGrid, setShowGrid] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const painting = useRef(false);
  const trail = useRef<Array<{ x: number; y: number }>>([]);
  const smoothPoint = useRef<{ x: number; y: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pixelsRef = useRef(pixels);
  const history = useRef<PixelRows[]>([]);
  const future = useRef<PixelRows[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const activeColor = palette[colorIndex] ?? "#ffffff";
  const preview = useMemo(() => pixelsToDataUrl(pixels, palette), [pixels, palette]);
  const maxBrush = maxBrushFor(size);
  const brushSizes = useMemo(() => BRUSH_SIZES.filter((b) => b <= maxBrush), [maxBrush]);
  const activeBrush = Math.min(brush, maxBrush);
  const strokeOptions = useMemo(
    () => ({ brush: activeBrush, shape: brushShape }),
    [activeBrush, brushShape],
  );

  useEffect(() => {
    pixelsRef.current = pixels;
  }, [pixels]);

  useEffect(() => {
    const stop = () => {
      painting.current = false;
      smoothPoint.current = null;
      panStart.current = null;
      setPanning(false);
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  // ── Vista: zoom con rueda y paneo ───────────────────────────────
  const changeZoom = useCallback(
    (next: number) => {
      const target = Math.min(ZOOMS[ZOOMS.length - 1], Math.max(ZOOMS[0], next));
      if (target === zoom) return;
      if (target === 1) setPan({ x: 0, y: 0 });
      else setPan((p) => ({ x: (p.x * target) / zoom, y: (p.y * target) / zoom }));
      setZoom(target);
    },
    [zoom],
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    // Listener nativo (no pasivo) para poder frenar el scroll del panel.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      changeZoom(zoom + (e.deltaY < 0 ? 1 : -1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [changeZoom, zoom]);

  // ── Historial (deshacer / rehacer) ──────────────────────────────
  const pushHistory = useCallback(() => {
    history.current = [...history.current.slice(-29), pixelsRef.current];
    future.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (prev === undefined) return;
    future.current = [pixelsRef.current, ...future.current].slice(0, 30);
    setPixels(prev);
    setDirty(true);
    setCanUndo(history.current.length > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    const next = future.current.shift();
    if (next === undefined) return;
    history.current = [...history.current.slice(-29), pixelsRef.current];
    setPixels(next);
    setDirty(true);
    setCanUndo(true);
    setCanRedo(future.current.length > 0);
  }, []);

  // ── Dibujo ──────────────────────────────────────────────────────
  /** Posición en píxeles del lienzo bajo el puntero (admite decimales). */
  const pointFromEvent = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const el = surfaceRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const x = ((e.clientX - rect.left) / rect.width) * size;
      const y = ((e.clientY - rect.top) / rect.height) * size;
      return {
        x: Math.min(Math.max(x, 0), size - 1),
        y: Math.min(Math.max(y, 0), size - 1),
      };
    },
    [size],
  );

  const strokeColor = tool === "eraser" ? -1 : colorIndex;

  const handleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const wantPan = tool === "pan" || e.button === 1 || e.altKey;
    if (!wantPan && e.pointerType === "mouse" && e.button !== 0) return;
    const point = pointFromEvent(e);
    if (!point) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // El puntero ya se liberó: se sigue dibujando sin captura.
    }
    setCursor({ x: Math.floor(point.x), y: Math.floor(point.y) });

    // Mano, botón central o Alt: el gesto mueve el lienzo.
    if (wantPan) {
      if (zoom > 1) {
        panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
      }
      painting.current = false;
      setPanning(true);
      return;
    }

    // Cuentagotas: toma el color del píxel y vuelve al pincel.
    if (tool === "picker") {
      const idx = charToIndex(pixelsRef.current[Math.floor(point.y)]?.[Math.floor(point.x)] ?? ".");
      if (idx >= 0) {
        setColorIndex(idx);
        setTool("brush");
      }
      return;
    }

    pushHistory();
    setDirty(true);

    // Relleno: una sola pasada, sin trazo continuo.
    if (tool === "bucket") {
      setPixels((prev) => floodFill(prev, palette, Math.floor(point.x), Math.floor(point.y), colorIndex));
      painting.current = false;
      smoothPoint.current = null;
      return;
    }

    // Pincel y goma: el trazo arranca aquí y continúa al arrastrar.
    painting.current = true;
    trail.current = [point];
    smoothPoint.current = point;
    setPixels((prev) => paintStroke(prev, point, point, strokeColor, strokeOptions));
  };

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = panStart.current;
    if (start) {
      setPan({ x: start.px + (e.clientX - start.x), y: start.py + (e.clientY - start.y) });
      return;
    }
    const point = pointFromEvent(e);
    if (!point) return;
    setCursor({ x: Math.floor(point.x), y: Math.floor(point.y) });
    if (!painting.current || tool === "bucket" || tool === "picker") return;

    // Estabilizador: el trazo sigue la media de los últimos puntos.
    const path = [...trail.current, point].slice(-SMOOTHING);
    trail.current = path;
    let sx = 0;
    let sy = 0;
    for (const p of path) {
      sx += p.x / path.length;
      sy += p.y / path.length;
    }
    const smooth = { x: sx, y: sy };
    const from = smoothPoint.current ?? smooth;
    if (from.x === smooth.x && from.y === smooth.y) return;
    smoothPoint.current = smooth;
    setPixels((prev) => paintStroke(prev, from, smooth, strokeColor, strokeOptions));
  };

  const handleUp = (e: React.PointerEvent<HTMLDivElement>) => {
    painting.current = false;
    smoothPoint.current = null;
    panStart.current = null;
    setPanning(false);
    if (e.pointerType !== "mouse") setCursor(null);
  };

  const handleLeave = () => {
    if (!painting.current) setCursor(null);
  };

  /** Huella del pincel que se dibuja como cursor sobre el lienzo. */
  const cursorBox = useMemo(() => {
    if (!cursor) return null;
    const footprint = tool === "brush" || tool === "eraser" ? activeBrush : 1;
    return brushBounds(cursor.x, cursor.y, footprint);
  }, [cursor, tool, activeBrush]);

  // ── Paleta y tamaño ─────────────────────────────────────────────
  const changeSize = (next: number) => {
    if (next === size) return;
    pushHistory();
    setSize(next);
    setPixels((prev) => normalizePixels(prev, next));
    setBrush((b) => Math.min(b, maxBrushFor(next)));
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDirty(true);
  };

  const addColor = (color: string) => {
    setPalette((prev) => {
      if (prev.includes(color)) return prev;
      // Reemplaza el color activo para mantener la paleta compacta.
      const next = [...prev];
      next[colorIndex] = color;
      return next;
    });
    setDirty(true);
  };

  // ── Guardados ──────────────────────────────────────────────────

  /** Crea un recurso nuevo a partir del lienzo actual. */
  const saveAsNew = async () => {
    if (busy) return;
    if (isPixelsEmpty(pixels)) {
      toast.error("Dibuja algo antes de guardar el recurso");
      return;
    }
    setBusy(true);
    try {
      const created = await createAsset(ownerId, {
        name: name.trim() || `${CATEGORY_LABEL[category]} ${new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`,
        category,
        pixels,
        palette,
        size,
      });
      toast.success("Recurso guardado");
      onSaved(created);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar el recurso");
    } finally {
      setBusy(false);
    }
  };

  /**
   * «Aplicar al asset original»: conserva el recurso original tal como
   * está y crea una copia con los cambios realizados, sin modificarlo.
   */
  const applyToOriginal = async () => {
    if (!asset || busy) return;
    if (isPixelsEmpty(pixels)) {
      toast.error("Dibuja algo antes de guardar la copia");
      return;
    }
    setBusy(true);
    try {
      const copy = await duplicateAsset(ownerId, asset._id, {
        name: `${asset.name} · variante`,
        pixels,
        palette,
        size,
      });
      toast.success("Copia guardada. El recurso original no se modificó.");
      onSaved(copy);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo crear la copia");
    } finally {
      setBusy(false);
    }
  };

  /** Guarda: actualiza el recurso abierto o crea uno nuevo. */
  const handleSave = async () => {
    if (busy) return;
    if (isPixelsEmpty(pixels)) {
      toast.error("Dibuja algo antes de guardar");
      return;
    }
    if (!asset) {
      await saveAsNew();
      return;
    }
    setBusy(true);
    try {
      const updated = await updateAsset(ownerId, asset._id, {
        name: name.trim() || asset.name,
        pixels,
        palette,
        size,
      });
      if (!updated) throw new Error("Recurso no encontrado");
      toast.success("Textura guardada");
      onSaved(updated);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar la textura");
    } finally {
      setBusy(false);
    }
  };

  const cellPct = 100 / size;
  const canvasCursor = tool === "pan" ? (panning ? "cursor-grabbing" : "cursor-grab") : "cursor-crosshair";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[120] flex flex-col bg-background text-foreground"
    >
      {/* ── Cabecera ── */}
      <header className="flex shrink-0 items-center gap-2 border-b border-border/40 bg-card px-3 py-2.5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar el estudio de texturas"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            maxLength={40}
            placeholder={`${CATEGORY_LABEL[category]} sin nombre`}
            className="w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
          />
          <p className="text-[10px] text-muted-foreground">
            {asset
              ? `Editando · ${asset.name}`
              : seed
                ? `Basado en · ${seed.name}`
                : "Recurso nuevo"}{" "}
            · {size}×{size}
          </p>
        </div>

        {/* Tres puntos: aplicar al original / guardar nuevo recurso */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Opciones del recurso"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 top-11 z-20 w-72 overflow-hidden rounded-2xl border border-border/40 bg-popover shadow-lift"
                >
                  <button
                    type="button"
                    disabled={!asset}
                    onClick={() => {
                      setMenuOpen(false);
                      void applyToOriginal();
                    }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted disabled:opacity-40"
                  >
                    <Copy className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <span className="block text-[13px] font-semibold text-foreground">
                        Aplicar al asset original
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                        {asset
                          ? "Guarda una copia con los cambios y deja el recurso original intacto."
                          : "Abre primero un recurso guardado para poder crear su variante."}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      void saveAsNew();
                    }}
                    className="flex w-full items-start gap-3 border-t border-border/30 px-4 py-3 text-left transition-colors hover:bg-muted"
                  >
                    <FilePlus2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <span className="block text-[13px] font-semibold text-foreground">
                        Guardar nuevo recurso
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                        Guarda este lienzo como un recurso independiente.
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      pushHistory();
                      setPixels(emptyPixels(size));
                      setDirty(true);
                    }}
                    className="flex w-full items-center gap-3 border-t border-border/30 px-4 py-3 text-left text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 shrink-0 text-destructive" />
                    <span className="text-[13px] font-semibold">Vaciar lienzo</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={busy}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-[13px] font-bold text-primary-foreground shadow-soft transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {asset ? "Guardar cambios" : "Crear recurso"}
        </button>
      </header>

      {/* ── Herramientas del lienzo ── */}
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border/40 bg-card px-3 py-2">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTool(t.id)}
            title={`${t.label} · ${t.hint}`}
            aria-label={t.label}
            aria-pressed={tool === t.id}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
              tool === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.icon}
          </button>
        ))}

        <span className="mx-1 h-6 w-px shrink-0 bg-border" />

        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          title="Deshacer"
          aria-label="Deshacer"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted disabled:opacity-35"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          title="Rehacer"
          aria-label="Rehacer"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted disabled:opacity-35"
        >
          <Redo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setShowGrid((v) => !v)}
          title="Cuadrícula de referencia"
          aria-label="Cuadrícula de referencia"
          aria-pressed={showGrid}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
            showGrid ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Grid3x3 className="h-4 w-4" />
        </button>

        <span className="mx-1 h-6 w-px shrink-0 bg-border" />

        <span className="shrink-0 text-[10px] font-bold tracking-wide text-muted-foreground/80 uppercase">
          Lienzo
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {TEXTURE_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeSize(s)}
              title={`Lienzo de ${s}×${s} píxeles`}
              aria-pressed={size === s}
              className={`h-8 min-w-8 shrink-0 rounded-lg px-2 text-[11px] font-bold tabular-nums transition-colors ${
                size === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lienzo + ajustes de dibujo ── */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:flex-row sm:items-start">
        <div
          className="mx-auto w-full shrink-0 sm:mx-0"
          style={{ maxWidth: "min(100%, 680px, 72vh)" }}
        >
          {/* Mesa: recorta la superficie cuando se amplía o se mueve. */}
          <div
            ref={viewportRef}
            className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border/40 bg-muted/60"
          >
            {/* Papel: el lienzo en sí, con su propio margen de trabajo. */}
            <div
              ref={surfaceRef}
              onPointerDown={handleDown}
              onPointerMove={handleMove}
              onPointerUp={handleUp}
              onPointerCancel={handleUp}
              onPointerLeave={handleLeave}
              onContextMenu={(e) => e.preventDefault()}
              className={`absolute top-1/2 left-1/2 aspect-square touch-none select-none shadow-soft ${canvasCursor}`}
              style={{
                width: `${zoom * 100}%`,
                transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
                ...PAPER,
              }}
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Lienzo de la textura"
                  draggable={false}
                  className="pointer-events-none absolute inset-0 h-full w-full [image-rendering:pixelated]"
                />
              ) : null}

              {showGrid && (
                <div
                  className="pointer-events-none absolute inset-0 opacity-50"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
                    backgroundSize: `${cellPct}% ${cellPct}%`,
                  }}
                />
              )}

              {cursorBox && (
                <div
                  className={`pointer-events-none absolute border border-primary bg-primary/15 ${
                    brushShape !== "square" && (tool === "brush" || tool === "eraser")
                      ? "rounded-full"
                      : "rounded-[2px]"
                  }`}
                  style={{
                    left: `${cursorBox.x * cellPct}%`,
                    top: `${cursorBox.y * cellPct}%`,
                    width: `${cursorBox.w * cellPct}%`,
                    height: `${cursorBox.h * cellPct}%`,
                  }}
                />
              )}
            </div>

            {/* Zoom */}
            <div className="absolute right-2 bottom-2 z-10 flex items-center gap-1 rounded-xl border border-border/40 bg-card/95 p-1 shadow-soft">
              <button
                type="button"
                onClick={() => changeZoom(zoom - 1)}
                disabled={zoom <= 1}
                title="Alejar"
                aria-label="Alejar el lienzo"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-35"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => changeZoom(1)}
                title="Tamaño real"
                className="min-w-11 rounded-lg px-1 text-[11px] font-bold tabular-nums text-muted-foreground transition-colors hover:bg-muted"
              >
                {zoom}×
              </button>
              <button
                type="button"
                onClick={() => changeZoom(zoom + 1)}
                disabled={zoom >= ZOOMS[ZOOMS.length - 1]}
                title="Acercar"
                aria-label="Acercar el lienzo"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-35"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <span className="mx-0.5 h-5 w-px bg-border" />
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                disabled={zoom === 1}
                title="Centrar el lienzo"
                aria-label="Centrar el lienzo"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-35"
              >
                <Locate className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Arrastra para pintar · rueda o ± para acercar · la mano mueve el lienzo
          </p>
        </div>

        <div className="w-full min-w-0 space-y-3 sm:w-[320px] sm:shrink-0">
          {/* Pincel */}
          <div className="rounded-2xl border border-border/40 bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Pincel
              </span>
              <span className="text-[11px] text-muted-foreground">
                {activeBrush} px · {SHAPES.find((s) => s.id === brushShape)?.label.toLowerCase()}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {brushSizes.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBrush(b)}
                  title={`Pincel de ${b} px`}
                  aria-label={`Pincel de ${b} píxeles`}
                  aria-pressed={activeBrush === b}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                    activeBrush === b
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span
                    className={`bg-current ${brushShape === "square" ? "rounded-[1px]" : "rounded-full"}`}
                    style={{ width: 2 + b * 2, height: 2 + b * 2 }}
                  />
                </button>
              ))}

              <span className="mx-0.5 h-6 w-px bg-border" />

              {SHAPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setBrushShape(s.id)}
                  title={`Pincel ${s.label.toLowerCase()}`}
                  aria-label={`Pincel ${s.label.toLowerCase()}`}
                  aria-pressed={brushShape === s.id}
                  className={`flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-semibold transition-colors ${
                    brushShape === s.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Paleta */}
          <div className="rounded-2xl border border-border/40 bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Color
              </span>
              <span className="text-[11px] text-muted-foreground">{activeColor}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {palette.map((c, i) => (
                <button
                  key={`${c}-${i}`}
                  type="button"
                  onClick={() => setColorIndex(i)}
                  title={c}
                  className={`h-7 w-7 rounded-lg border transition-transform hover:scale-110 ${
                    colorIndex === i ? "border-primary ring-2 ring-primary/30" : "border-border"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-card px-2 text-[11px] text-muted-foreground">
                <input
                  type="color"
                  value={activeColor}
                  onChange={(e) => addColor(e.target.value)}
                  className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
                />
                Nuevo
              </label>
            </div>
          </div>

          {/* Vista previa */}
          <div className="rounded-2xl border border-border/40 bg-muted/40 p-3">
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Vista previa en el nivel
            </span>
            <div className="mt-2 flex items-end gap-4">
              {[32, 48, 72].map((px) => (
                <div key={px} className="flex flex-col items-center gap-1">
                  <img
                    src={preview}
                    alt="Vista previa de la textura"
                    width={px}
                    height={px}
                    className="rounded-md bg-muted [image-rendering:pixelated]"
                    style={{ width: px, height: px }}
                  />
                  <span className="text-[10px] text-muted-foreground">{px / 16}x</span>
                </div>
              ))}
            </div>
          </div>

          {dirty && (
            <p className="flex items-center gap-1.5 text-[11px] text-primary">
              <Check className="h-3.5 w-3.5" /> Cambios sin guardar
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
