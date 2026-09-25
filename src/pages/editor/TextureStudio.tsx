// ═══════════════════════════════════════════════════════════════════
// ESTUDIO DE TEXTURAS — espacio de dibujo de un recurso
//
// Se abre al crear un recurso nuevo ("+") o al editar la textura de un
// recurso guardado. El lienzo es un espacio de dibujo libre: el pincel
// tiene tamaño y forma (redondo/cuadrado), pinta trazos continuos y se
// combina con la goma, el bote de relleno y el cuentagotas.
//
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

type Tool = "brush" | "eraser" | "bucket" | "picker";

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

const CHECKER: React.CSSProperties = {
  backgroundColor: "var(--card)",
  backgroundImage:
    "linear-gradient(45deg, var(--muted) 25%, transparent 25%), linear-gradient(-45deg, var(--muted) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--muted) 75%), linear-gradient(-45deg, transparent 75%, var(--muted) 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
};

const TOOLS: Array<{ id: Tool; label: string; hint: string; icon: React.ReactNode }> = [
  { id: "brush", label: "Pincel", hint: "Pinta trazos con el color activo", icon: <Paintbrush className="h-4 w-4" /> },
  { id: "eraser", label: "Goma", hint: "Borra píxeles con el tamaño del pincel", icon: <Eraser className="h-4 w-4" /> },
  { id: "bucket", label: "Relleno", hint: "Rellena la zona contigua del mismo color", icon: <PaintBucket className="h-4 w-4" /> },
  { id: "picker", label: "Cuentagotas", hint: "Toma el color de un píxel del lienzo", icon: <Pipette className="h-4 w-4" /> },
];

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const painting = useRef(false);
  const lastCell = useRef<{ x: number; y: number } | null>(null);
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

  useEffect(() => {
    pixelsRef.current = pixels;
  }, [pixels]);

  useEffect(() => {
    const stop = () => {
      painting.current = false;
      lastCell.current = null;
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

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
  /** Píxel del lienzo bajo el puntero, ajustado a los límites. */
  const cellFromEvent = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = canvasRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * size);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * size);
      return {
        x: Math.min(Math.max(x, 0), size - 1),
        y: Math.min(Math.max(y, 0), size - 1),
      };
    },
    [size],
  );

  const strokeColor = tool === "eraser" ? -1 : colorIndex;
  const strokeOptions = useMemo(
    () => ({ brush: activeBrush, shape: brushShape }),
    [activeBrush, brushShape],
  );

  const handleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const cell = cellFromEvent(e);
    if (!cell) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // El puntero ya se liberó: se sigue dibujando sin captura.
    }
    setCursor(cell);

    // Cuentagotas: toma el color del píxel y vuelve al pincel.
    if (tool === "picker") {
      const idx = charToIndex(pixelsRef.current[cell.y]?.[cell.x] ?? ".");
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
      setPixels((prev) => floodFill(prev, palette, cell.x, cell.y, colorIndex));
      painting.current = false;
      lastCell.current = null;
      return;
    }

    // Pincel y goma: el trazo arranca aquí y continúa al arrastrar.
    painting.current = true;
    lastCell.current = cell;
    setPixels((prev) => paintStroke(prev, cell, cell, strokeColor, strokeOptions));
  };

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const cell = cellFromEvent(e);
    if (!cell) return;
    setCursor(cell);
    if (!painting.current) return;
    if (tool === "bucket" || tool === "picker") return;
    const from = lastCell.current ?? cell;
    if (from.x === cell.x && from.y === cell.y) return;
    lastCell.current = cell;
    setPixels((prev) => paintStroke(prev, from, cell, strokeColor, strokeOptions));
  };

  const handleUp = (e: React.PointerEvent<HTMLDivElement>) => {
    painting.current = false;
    lastCell.current = null;
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
        <div className="mx-auto w-full max-w-[460px] shrink-0 sm:mx-0">
          <div
            ref={canvasRef}
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
            onPointerLeave={handleLeave}
            onContextMenu={(e) => e.preventDefault()}
            className="relative aspect-square w-full cursor-crosshair touch-none overflow-hidden rounded-2xl border border-border/40 select-none"
            style={CHECKER}
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
                  brushShape === "round" && (tool === "brush" || tool === "eraser")
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
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Arrastra para pintar · cambia el tamaño y la forma del pincel en el panel.
          </p>
        </div>

        <div className="w-full min-w-0 space-y-3">
          {/* Pincel */}
          <div className="rounded-2xl border border-border/40 bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Pincel
              </span>
              <span className="text-[11px] text-muted-foreground">
                {activeBrush} px · {brushShape === "round" ? "redondo" : "cuadrado"}
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
                    className={`bg-current ${brushShape === "round" ? "rounded-full" : "rounded-[1px]"}`}
                    style={{ width: 2 + b * 2, height: 2 + b * 2 }}
                  />
                </button>
              ))}

              <span className="mx-0.5 h-6 w-px bg-border" />

              <button
                type="button"
                onClick={() => setBrushShape("round")}
                title="Pincel redondo"
                aria-label="Pincel redondo"
                aria-pressed={brushShape === "round"}
                className={`flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-semibold transition-colors ${
                  brushShape === "round"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <Circle className="h-3.5 w-3.5" /> Redondo
              </button>
              <button
                type="button"
                onClick={() => setBrushShape("square")}
                title="Pincel cuadrado"
                aria-label="Pincel cuadrado"
                aria-pressed={brushShape === "square"}
                className={`flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-semibold transition-colors ${
                  brushShape === "square"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <Square className="h-3.5 w-3.5" /> Cuadrado
              </button>
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
