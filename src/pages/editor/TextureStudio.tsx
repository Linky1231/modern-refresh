// ═══════════════════════════════════════════════════════════════════
// ESTUDIO DE TEXTURAS — lienzo de dibujo de un recurso
//
// Se abre al crear un recurso nuevo ("+") o al editar la textura de un
// recurso guardado. Incluye lápiz, borrador, bote, paleta, deshacer y
// el menú de tres puntos con:
//   · «Aplicar al asset original» -> guarda una copia con los cambios y
//     deja el recurso original intacto.
//   · «Guardar nuevo recurso»     -> guarda el lienzo como recurso nuevo.
// ═══════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Pencil,
  Eraser,
  PaintBucket,
  Undo2,
  Grid3x3,
  MoreVertical,
  Check,
  Copy,
  FilePlus2,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { createAsset, duplicateAsset, updateAsset, type AssetCategory, type AssetView } from "@/lib/db";
import {
  DEFAULT_PALETTE,
  TEXTURE_SIZES,
  emptyPixels,
  floodFill,
  isPixelsEmpty,
  normalizePixels,
  pixelsToDataUrl,
  setPixel,
  type PixelRows,
} from "@/lib/textures";
import { CATEGORY_LABEL } from "./levelAssets";

type Tool = "pencil" | "eraser" | "bucket";

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
  const [tool, setTool] = useState<Tool>("pencil");
  const [colorIndex, setColorIndex] = useState(9);
  const [showGrid, setShowGrid] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const painting = useRef(false);
  const history = useRef<PixelRows[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const activeColor = palette[colorIndex] ?? "#ffffff";
  const preview = useMemo(() => pixelsToDataUrl(pixels, palette), [pixels, palette]);

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

  const pushHistory = useCallback(() => {
    history.current = [...history.current.slice(-19), pixels];
    setCanUndo(true);
  }, [pixels]);

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (!prev) return;
    setPixels(prev);
    setCanUndo(history.current.length > 0);
    setDirty(true);
  }, []);

  const paintAt = useCallback(
    (x: number, y: number) => {
      setDirty(true);
      setPixels((prev) => {
        if (tool === "bucket") return floodFill(prev, palette, x, y, colorIndex);
        return setPixel(prev, x, y, tool === "eraser" ? -1 : colorIndex);
      });
    },
    [tool, colorIndex, palette],
  );

  const handlePointerDown = (x: number, y: number) => {
    pushHistory();
    painting.current = true;
    paintAt(x, y);
  };

  const handlePointerEnter = (x: number, y: number) => {
    if (!painting.current || tool === "bucket") return;
    paintAt(x, y);
  };

  const changeSize = (next: number) => {
    pushHistory();
    setSize(next);
    setPixels((prev) => normalizePixels(prev, next));
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

  const cellSize = `calc(100% / ${size})`;

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

      {/* ── Herramientas ── */}
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border/40 bg-card px-3 py-2">
        {(
          [
            { id: "pencil" as Tool, label: "Lápiz", icon: <Pencil className="h-4 w-4" /> },
            { id: "eraser" as Tool, label: "Borrador", icon: <Eraser className="h-4 w-4" /> },
            { id: "bucket" as Tool, label: "Relleno", icon: <PaintBucket className="h-4 w-4" /> },
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTool(t.id)}
            title={t.label}
            aria-label={t.label}
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
          onClick={() => setShowGrid((v) => !v)}
          title="Cuadrícula"
          aria-label="Cuadrícula"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
            showGrid ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Grid3x3 className="h-4 w-4" />
        </button>

        <span className="mx-1 h-6 w-px shrink-0 bg-border" />

        <div className="flex shrink-0 items-center gap-1.5">
          {TEXTURE_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeSize(s)}
              className={`h-8 min-w-8 rounded-lg px-2 text-[11px] font-bold tabular-nums transition-colors ${
                size === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lienzo + paleta ── */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:flex-row sm:items-start">
        <div className="mx-auto w-full max-w-[420px] shrink-0 sm:mx-0">
          <div
            className="relative aspect-square w-full touch-none overflow-hidden rounded-2xl border border-border/40 select-none"
            style={CHECKER}
          >
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: `repeat(${size}, ${cellSize})`,
                gridTemplateRows: `repeat(${size}, ${cellSize})`,
              }}
            >
              {Array.from({ length: size * size }, (_, i) => {
                const x = i % size;
                const y = Math.floor(i / size);
                const ch = pixels[y]?.[x] ?? ".";
                const color = ch === "." ? "transparent" : palette[parseInt(ch, 36)] || "transparent";
                return (
                  <div
                    key={`${x},${y}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handlePointerDown(x, y);
                    }}
                    onPointerEnter={() => handlePointerEnter(x, y)}
                    className={showGrid ? "border-[0.5px] border-border/20" : ""}
                    style={{ backgroundColor: color }}
                  />
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Arrastra el dedo o el ratón para dibujar la textura.
          </p>
        </div>

        <div className="w-full min-w-0 space-y-3">
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
