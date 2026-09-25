// ═══════════════════════════════════════════════════════════════════
// EDITOR DE NIVELES — Asternal
//
// Lienzo cuadriculado del nivel + ventana inferior de recursos compacta que
// se puede abrir, cerrar y ampliar. Cada apartado (Bloque · Deco · Actor ·
// Útil · Ítem · Arma) muestra los recursos del usuario (editables) y los del
// motor. Desde aquí se crea la textura de un recurso con el estudio de
// dibujo y esa textura se coloca y se ajusta en el nivel.
//
// Capas: "mapa" (mundo) e "interfaz". Guardado local vía @/lib/db.
// ═══════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowLeftRight,
  Box,
  Check,
  ChevronUp,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  Hand,
  Hash,
  Layers,
  Loader2,
  Locate,
  Menu,
  MessageSquare,
  Paintbrush,
  Pencil,
  Play,
  Plus,
  RotateCw,
  Save,
  Search,
  Settings,
  Square,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteAsset,
  getAssets,
  getAssetStats,
  updateAsset,
  updateMap,
  type AssetView,
  type MapView,
} from "@/lib/db";
import { usePan } from "@/hooks/use-pan";
import { countPaintedPixels, pixelsToDataUrl } from "@/lib/textures";
import {
  ASSET_CATEGORIES,
  BUILTIN_ASSETS,
  CATEGORY_LABEL,
  UI_PREFIX,
  LEGACY_TILE_MAP,
  builtinAsset,
  cellKey,
  cellTransform,
  parseCell,
  serializeCell,
  type AssetCategory,
  type CellValue,
} from "./levelAssets";
import TextureStudio, { type SeedTexture } from "./TextureStudio";

type Layer = "map" | "ui";
type Tool = "paint" | "erase" | "adjust" | "move";

interface LevelEditorProps {
  scene: MapView;
  ownerId: string;
  onBack: () => void;
  /** Abre el panel de ajustes + copias de seguridad del proyecto. */
  onOpenSettings: () => void;
  /** Abre las estadísticas del proyecto. */
  onOpenProjectStats: () => void;
}

const GENRE_LABEL: Record<string, string> = { rpg: "RPG", platformer: "Plataformas" };

// Superficie del lienzo: la misma textura punteada suave del tablero de escenas.
const CANVAS_BG: React.CSSProperties = {
  backgroundColor: "var(--primary-soft)",
  backgroundImage:
    "radial-gradient(circle, color-mix(in srgb, var(--primary) 20%, transparent) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};

export default function LevelEditor({
  scene,
  ownerId,
  onBack,
  onOpenSettings,
  onOpenProjectStats,
}: LevelEditorProps) {
  // ── Nivel ──────────────────────────────────────────────────────
  const [grid, setGrid] = useState<Record<string, string>>(scene.tiles ?? {});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState(scene.description);

  // ── Herramientas / capas ───────────────────────────────────────
  const [layer, setLayer] = useState<Layer>("map");
  const [tool, setTool] = useState<Tool>("paint");
  const [preview, setPreview] = useState(false);

  // ── Recursos ───────────────────────────────────────────────────
  const [assets, setAssets] = useState<AssetView[]>([]);
  const [category, setCategory] = useState<AssetCategory>("bloque");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(true);
  // La ventana de recursos arranca compacta (más lienzo) y se puede ampliar.
  const [sheetTall, setSheetTall] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  // ── Diálogos ───────────────────────────────────────────────────
  const [studio, setStudio] = useState<{ asset: AssetView | null; seed: SeedTexture | null } | null>(null);
  const [actionsAsset, setActionsAsset] = useState<AssetView | null>(null);
  const [builtinActions, setBuiltinActions] = useState<{ id: string; name: string; category: AssetCategory } | null>(null);
  const [adjustCell, setAdjustCell] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<AssetView | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showData, setShowData] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [assetStats, setAssetStats] = useState({ total: 0, byCategory: {} as Record<string, number> });
  const [fps, setFps] = useState(60);

  const painting = useRef(false);

  // El lienzo (el mapa) se arrastra libremente a cualquier posición: con la
  // herramienta Mover, con el fondo, con el botón central o con Alt.
  const [canvasEl, setCanvasEl] = useState<HTMLDivElement | null>(null);
  const pan = usePan({ element: canvasEl, enabled: tool === "move" });

  const loadAssets = useCallback(async () => {
    try {
      const [list, stats] = await Promise.all([getAssets(ownerId), getAssetStats(ownerId)]);
      setAssets(list);
      setAssetStats(stats);
    } catch (e) {
      console.error("Error cargando recursos:", e);
    }
  }, [ownerId]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

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

  // Contador real de FPS del lienzo.
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const tick = (now: number) => {
      frames += 1;
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Texturas listas para pintar ────────────────────────────────
  const textureMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of BUILTIN_ASSETS) map.set(a.id, pixelsToDataUrl(a.pixels, a.palette));
    for (const a of assets) map.set(a._id, pixelsToDataUrl(a.pixels, a.palette));
    // Niveles creados con el pizarrón anterior (ids cortos).
    for (const [legacy, id] of Object.entries(LEGACY_TILE_MAP)) {
      const url = map.get(id);
      if (url) map.set(legacy, url);
    }
    return map;
  }, [assets]);

  const builtinsForCategory = useMemo(
    () => BUILTIN_ASSETS.filter((a) => a.category === category),
    [category],
  );
  const userAssetsForCategory = useMemo(
    () =>
      assets
        .filter((a) => a.category === category)
        .filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase())),
    [assets, category, query],
  );

  // Siempre hay un recurso listo para pintar: si no hay selección manual,
  // se usa el primero del apartado activo (estado derivado, sin efectos).
  const activeId =
    selectedId ?? userAssetsForCategory[0]?._id ?? builtinsForCategory[0]?.id ?? null;
  const selected =
    (activeId && (assets.find((a) => a._id === activeId) ?? null)) ||
    (activeId ? builtinAsset(activeId) ?? null : null);

  // ── Pintado ────────────────────────────────────────────────────
  const paintAt = useCallback(
    (x: number, y: number) => {
      if (preview || tool === "move") return;
      const key = cellKey(x, y, layer);
      setGrid((prev) => {
        if (tool === "erase") {
          if (!(key in prev)) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        }
        if (!activeId) return prev;
        const value = serializeCell({ id: activeId, rot: 0, flipH: false, flipV: false });
        if (prev[key] === value) return prev;
        return { ...prev, [key]: value };
      });
      setDirty(true);
    },
    [layer, activeId, tool, preview],
  );

  const handleDown = (x: number, y: number) => {
    if (tool === "adjust") {
      const key = cellKey(x, y, layer);
      if (grid[key]) setAdjustCell(key);
      return;
    }
    painting.current = true;
    paintAt(x, y);
  };

  const handleEnter = (x: number, y: number) => {
    if (!painting.current || tool === "adjust" || tool === "move") return;
    paintAt(x, y);
  };

  const updateCell = (key: string, next: CellValue | null) => {
    setGrid((prev) => {
      const copy = { ...prev };
      if (!next) delete copy[key];
      else copy[key] = serializeCell(next);
      return copy;
    });
    setDirty(true);
  };

  // ── Guardado ───────────────────────────────────────────────────
  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateMap(ownerId, scene._id, { tiles: grid });
      setDirty(false);
      toast.success("Nivel guardado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar el nivel");
    } finally {
      setSaving(false);
    }
  };

  const saveDescription = async () => {
    try {
      await updateMap(ownerId, scene._id, { description });
      toast.success("Notas guardadas");
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron guardar las notas");
    }
  };

  // ── Recursos ───────────────────────────────────────────────────
  const openNewResource = () => {
    setStudio({ asset: null, seed: null });
  };

  const openSeedFromBuiltin = (id: string) => {
    const builtin = builtinAsset(id);
    if (!builtin) return;
    setStudio({
      asset: null,
      seed: {
        name: builtin.name,
        pixels: builtin.pixels,
        palette: builtin.palette,
        size: builtin.pixels.length,
      },
    });
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    try {
      await updateAsset(ownerId, renameTarget._id, { name: renameValue });
      toast.success("Recurso renombrado");
      setRenameTarget(null);
      await loadAssets();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo renombrar");
    }
  };

  const handleDeleteAsset = async (asset: AssetView) => {
    try {
      await deleteAsset(ownerId, asset._id);
      toast.success("Recurso eliminado");
      setActionsAsset(null);
      if (selectedId === asset._id) setSelectedId(null);
      await loadAssets();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo eliminar el recurso");
    }
  };

  // ── Medidas del lienzo ─────────────────────────────────────────
  const { width, height } = scene;
  const cellPx = width > 40 ? 14 : width > 24 ? 18 : 22;
  const MAX_CELLS = 3600;
  const tooManyCells = width * height > MAX_CELLS;
  const rows = tooManyCells ? Math.floor(MAX_CELLS / width) : height;
  const cols = width;

  const placedMap = Object.keys(grid).filter((k) => !k.startsWith(UI_PREFIX)).length;
  const placedUi = Object.keys(grid).length - placedMap;
  const usedResources = new Set(
    Object.values(grid).map((v) => parseCell(v)?.id).filter((v): v is string => !!v),
  ).size;
  const paintedPixels = Object.values(grid).reduce((acc, v) => {
    const cell = parseCell(v);
    if (!cell) return acc;
    const asset = assets.find((a) => a._id === cell.id);
    if (asset) return acc + countPaintedPixels(asset.pixels);
    return acc;
  }, 0);

  const adjustCellValue = adjustCell ? parseCell(grid[adjustCell]) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      style={CANVAS_BG}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/35 shadow-soft"
    >
      {/* ══ Zona del lienzo (todo el chrome flota aquí, encima de la ventana) ══ */}
      <div className="relative min-h-0 flex-1">
      <div
        ref={setCanvasEl}
        className="absolute inset-0 select-none overflow-hidden"
        style={pan.interaction}
        {...pan.viewportProps}
      >
        {/* El mapa vive en su propio plano: se puede colocar en cualquier posición. */}
        <div
          className="absolute left-1/2 top-1/2 flex w-fit flex-col items-center"
          style={{
            transform: `translate(calc(-50% + ${pan.offset.x}px), calc(-50% + ${pan.offset.y}px))`,
            willChange: "transform",
          }}
        >
          <div className="w-fit">
            <div className="flex">
              {/* Regla de filas */}
              <div className="flex w-6 shrink-0 flex-col">
                {Array.from({ length: rows }, (_, y) => (
                  <span
                    key={y}
                    className="flex items-center justify-end pr-1 text-[10px] font-semibold text-muted-foreground/80 tabular-nums"
                    style={{ height: cellPx }}
                  >
                    {y}
                  </span>
                ))}
              </div>
              {/* Rejilla */}
              <div
                className="grid overflow-hidden rounded-lg bg-card shadow-soft ring-1 ring-border/50"
                style={{
                  gridTemplateColumns: `repeat(${cols}, ${cellPx}px)`,
                  gridTemplateRows: `repeat(${rows}, ${cellPx}px)`,
                }}
              >
                {Array.from({ length: cols * rows }, (_, i) => {
                  const x = i % cols;
                  const y = Math.floor(i / cols);
                  const key = cellKey(x, y, layer);
                  const cell = parseCell(grid[key]);
                  const url = cell ? textureMap.get(cell.id) : undefined;
                  const unknown = !!cell && !url;
                  return (
                    <div
                      key={key}
                      onPointerDown={(e) => {
                        // Con la mano activa (o Alt, o el botón central) el gesto es del lienzo.
                        if (e.button !== 0 || tool === "move" || e.altKey) return;
                        e.preventDefault();
                        handleDown(x, y);
                      }}
                      onPointerEnter={() => handleEnter(x, y)}
                      className={`relative border-[0.5px] border-border/40 ${
                        adjustCell === key ? "z-10 ring-2 ring-primary ring-inset" : ""
                      }`}
                      style={{ touchAction: "none" }}
                    >
                      {url && (
                        <img
                          src={url}
                          alt=""
                          draggable={false}
                          className="pointer-events-none absolute inset-0 h-full w-full object-cover [image-rendering:pixelated]"
                          style={{ transform: cellTransform(cell!) }}
                        />
                      )}
                      {unknown && (
                        <span className="pointer-events-none absolute inset-0 bg-destructive/40" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Regla de columnas */}
            <div className="ml-6 flex">
              {Array.from({ length: cols }, (_, x) => (
                <span
                  key={x}
                  className="text-center text-[10px] font-semibold text-muted-foreground/80 tabular-nums"
                  style={{ width: cellPx }}
                >
                  {x}
                </span>
              ))}
            </div>
          </div>

          {tooManyCells && (
            <p className="mt-4 max-w-xs rounded-xl border border-border/40 bg-card/95 px-3 py-2 text-center text-[11px] leading-relaxed text-foreground">
              Nivel muy grande ({width}×{height}): se muestran las primeras {rows} filas.
            </p>
          )}
        </div>
      </div>

      {/* ══ Barra superior: volver, capa activa (Mapa | Interfaz) y menú ══ */}
      {!preview && (
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 p-2">
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver a las escenas"
            title="Volver a las escenas"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/40 bg-card text-foreground shadow-soft transition-transform active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Ajustes del proyecto"
            title="Ajustes del proyecto"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/40 bg-card shadow-soft transition-transform active:scale-95"
          >
            <img src="/logo.png" alt="Asternal" className="h-5 w-5 rounded-full object-contain" />
          </button>
        </div>

        {/* Modo actual: la capa que se está editando (el panel de ajustes vive
            en las acciones de la derecha). */}
        <div className="pointer-events-auto flex items-center gap-2">
          <span className="hidden text-[10px] font-bold tracking-wide text-muted-foreground/80 uppercase sm:inline">
            Capa
          </span>
          <div className="flex items-center overflow-hidden rounded-xl border border-border/40 bg-card shadow-soft">
            <button
              type="button"
              onClick={() => setLayer("map")}
              aria-label="Editar la capa del mapa"
              aria-pressed={layer === "map"}
              className={`px-3 py-1.5 text-[12px] font-bold transition-colors ${
                layer === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mapa
            </button>
            <button
              type="button"
              onClick={() => setLayer("ui")}
              aria-label="Editar la capa de interfaces"
              aria-pressed={layer === "ui"}
              className={`flex items-center gap-1 px-3 py-1.5 text-[12px] font-bold transition-colors ${
                layer === "ui" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Interfaz
              <ArrowLeftRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSearchOpen(true);
              setSheetOpen(true);
            }}
            aria-label="Buscar recursos"
            title="Buscar recursos"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/40 bg-card text-foreground shadow-soft transition-transform active:scale-95"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowMenu(true)}
            aria-label="Menú del editor"
            title="Menú del editor"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/40 bg-card text-foreground shadow-soft transition-transform active:scale-95"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>
      )}

      {/* ══ Acciones del lienzo: guardar/probar (primario) y ajustes/datos (secundario) ══ */}
      {!preview && (
        <div className="absolute top-14 right-2 z-20 flex w-40 flex-col gap-1 rounded-2xl border border-border/40 bg-card/95 p-1.5 shadow-soft">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            title={dirty ? "Guardar los cambios del nivel" : "El nivel está guardado"}
            aria-label="Guardar nivel"
            className={`flex h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] font-bold transition-colors ${
              dirty
                ? "bg-primary text-primary-foreground shadow-soft"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                Guardando…
              </>
            ) : dirty ? (
              <>
                <Save className="h-3.5 w-3.5 shrink-0" />
                Cambios sin guardar
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 shrink-0" />
                Guardado
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setPreview(true)}
            title="Probar el nivel (vista previa sin controles)"
            aria-label="Probar el nivel"
            className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border/40 bg-card text-[11px] font-bold text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5 shrink-0 text-primary" />
            Probar
          </button>
          {/* Funciones secundarias, agrupadas y separadas del guardado */}
          <div className="mt-0.5 grid grid-cols-2 gap-1 border-t border-border/40 pt-1.5">
            <EditorIconButton label="Ajustes del proyecto" onClick={onOpenSettings} className="h-8 w-full">
              <Settings className="h-4 w-4" />
            </EditorIconButton>
            <EditorIconButton label="Datos del nivel" onClick={() => setShowData(true)} className="h-8 w-full">
              <Hash className="h-4 w-4" />
            </EditorIconButton>
          </div>
        </div>
      )}

      {/* ══ Barra inferior: herramientas · recurso activo · FPS · recursos ══ */}
      {!preview && (
        <div className="absolute inset-x-2 bottom-2 z-30 flex items-center gap-2">
          {/* Herramientas de construcción (lo primero después del lienzo). */}
          <div className="flex shrink-0 items-center gap-0.5 rounded-2xl border border-border/40 bg-card/95 p-1 shadow-soft">
            {(
              [
                { id: "paint" as Tool, label: "Pintar", icon: <Paintbrush className="h-4 w-4" /> },
                { id: "erase" as Tool, label: "Borrar", icon: <Eraser className="h-4 w-4" /> },
                { id: "adjust" as Tool, label: "Ajustar", icon: <Wrench className="h-4 w-4" /> },
                { id: "move" as Tool, label: "Mover", icon: <Hand className="h-4 w-4" /> },
              ]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTool(t.id)}
                title={t.id === "move" ? "Mover el mapa" : `Herramienta ${t.label}`}
                aria-label={t.id === "move" ? "Mover el mapa" : `Herramienta ${t.label}`}
                aria-pressed={tool === t.id}
                className={`flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-bold transition-colors ${
                  tool === t.id
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
            {!pan.isCentered && (
              <>
                <span className="mx-1 h-6 w-px bg-border/60" />
                <EditorIconButton label="Centrar el mapa" onClick={pan.reset}>
                  <Locate className="h-4 w-4" />
                </EditorIconButton>
              </>
            )}
          </div>

          {/* Recurso que se va a pintar: distinto de la herramienta y de la capa. */}
          {selected && activeId && (
            <div className="pointer-events-none hidden min-w-0 items-center gap-2 rounded-2xl border border-primary/30 bg-card/95 px-2.5 py-1.5 shadow-soft sm:flex">
              <span className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                Recurso
              </span>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/40 bg-muted">
                {textureMap.get(activeId) && (
                  <img
                    src={textureMap.get(activeId)}
                    alt=""
                    className="h-full w-full object-contain [image-rendering:pixelated]"
                  />
                )}
              </span>
              <span className="max-w-[9rem] truncate text-[11px] font-bold text-foreground">
                {selected.name}
              </span>
            </div>
          )}

          <div className="min-w-0 flex-1" />

          <span className="pointer-events-none hidden text-[10px] font-semibold text-muted-foreground/70 tabular-nums lg:inline">
            FPS {fps}
          </span>

          <button
            type="button"
            onClick={() => setSheetOpen((v) => !v)}
            aria-label="Abrir o cerrar la ventana de recursos"
            title="Recursos"
            aria-pressed={sheetOpen}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-2xl border px-3 shadow-soft transition-colors active:scale-95 ${
              sheetOpen
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/40 bg-card text-foreground"
            }`}
          >
            <Box className="h-4 w-4" />
            <span className="hidden text-[11px] font-bold sm:inline">Recursos</span>
          </button>
        </div>
      )}

      {/* ══ Vista previa (Probar) ══ */}
      {preview && (
        <div className="absolute inset-x-0 top-0 z-40 flex items-center justify-between gap-2 p-2">
          <span className="rounded-lg border border-border/40 bg-card/95 px-3 py-1.5 text-[11px] font-bold text-foreground shadow-soft">
            Vista previa
          </span>
          <div className="flex items-center gap-2">
            <span className="pointer-events-none text-[10px] font-semibold text-muted-foreground/80 tabular-nums">
              FPS {fps}
            </span>
            <button
              type="button"
              onClick={() => setPreview(false)}
              className="flex items-center gap-1.5 rounded-full bg-destructive px-3 py-2 text-[11px] font-bold text-destructive-foreground shadow-soft transition-transform active:scale-95"
            >
              <Square className="h-3.5 w-3.5" />
              Detener
            </button>
          </div>
        </div>
      )}
      </div>

      {/* ══ Ventana inferior de recursos: compacta por defecto y ampliable ══ */}
      <motion.div
        initial={false}
        animate={{ height: preview ? 0 : sheetOpen ? (sheetTall ? "66%" : "34%") : 44 }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="relative z-40 shrink-0 overflow-hidden rounded-t-3xl border-t border-border/40 bg-card shadow-lift"
      >
        <div className="flex h-10 items-center gap-2 px-3">
          <button
            type="button"
            onClick={() => setSheetOpen((v) => !v)}
            aria-label="Abrir o cerrar la ventana de recursos"
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span className="text-[11px] font-bold tracking-wide text-foreground uppercase">
              Recursos
            </span>
            <span className="truncate text-[11px] font-medium text-muted-foreground">
              {sheetOpen
                ? `· ${CATEGORY_LABEL[category]}`
                : `· ${assets.length} guardados · pulsa para abrir`}
            </span>
          </button>
          {sheetOpen && (
            <button
              type="button"
              onClick={() => setSheetTall((v) => !v)}
              aria-label={sheetTall ? "Reducir la ventana de recursos" : "Ampliar la ventana de recursos"}
              title={sheetTall ? "Reducir la ventana" : "Ampliar la ventana"}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronUp className={`h-4 w-4 transition-transform ${sheetTall ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        {sheetOpen ? (
          <div className="flex h-[calc(100%-2.5rem)] flex-col">
            {/* Apartados de recursos: jerarquía clara entre el activo y el resto. */}
            <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/40 px-3 pb-2">
              {ASSET_CATEGORIES.map((c) => {
                const owned = assets.filter((a) => a.category === c.id).length;
                const isActive = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    aria-pressed={isActive}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                      isActive
                        ? "border-primary/40 bg-primary/10 font-bold text-primary"
                        : "border-transparent font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {c.label}
                    {owned > 0 && (
                      <span
                        className={`rounded-full px-1 text-[9px] font-bold tabular-nums ${
                          isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {owned}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {searchOpen && (
              <div className="mx-3 mt-2 flex shrink-0 items-center gap-2 rounded-xl border border-border/40 bg-muted/60 px-3 py-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar recurso…"
                  className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery("");
                  }}
                  aria-label="Cerrar la búsqueda"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
              {/* Tarjetas idénticas: misma caja cuadrada y misma tira de nombre. */}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {/* Crear recurso -> abre el lienzo de dibujo */}
                <button
                  type="button"
                  onClick={openNewResource}
                  aria-label={`Crear un recurso de ${CATEGORY_LABEL[category]}`}
                  title={`Crear un recurso de ${CATEGORY_LABEL[category]}`}
                  className="flex aspect-square flex-col overflow-hidden rounded-xl border border-dashed border-primary/40 bg-primary-soft text-primary transition-colors hover:bg-primary/10 active:scale-95"
                >
                  <span className="flex min-h-0 flex-1 items-center justify-center">
                    <Plus className="h-6 w-6" strokeWidth={2.6} />
                  </span>
                  <span className="flex h-6 shrink-0 items-center justify-center border-t border-primary/20 text-[9px] font-bold tracking-wide uppercase">
                    Crear
                  </span>
                </button>

                {/* Recursos del usuario */}
                {userAssetsForCategory.map((a) => (
                  <AssetTile
                    key={a._id}
                    name={a.name}
                    url={textureMap.get(a._id) ?? ""}
                    selected={activeId === a._id}
                    onSelect={() => setSelectedId(a._id)}
                    onMenu={() => setActionsAsset(a)}
                  />
                ))}

                {/* Recursos del motor */}
                {!query &&
                  builtinsForCategory.map((b) => (
                    <AssetTile
                      key={b.id}
                      name={`${b.name} · motor`}
                      url={textureMap.get(b.id) ?? ""}
                      selected={activeId === b.id}
                      onSelect={() => setSelectedId(b.id)}
                      onMenu={() => setBuiltinActions({ id: b.id, name: b.name, category: b.category })}
                    />
                  ))}
              </div>

              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                {userAssetsForCategory.length === 0 && !query
                  ? `Aún no tienes recursos de ${CATEGORY_LABEL[category]}. Pulsa “+” para dibujar su textura.`
                  : userAssetsForCategory.length === 1
                    ? "1 recurso tuyo · toca el engranaje para editarlo"
                    : `${userAssetsForCategory.length} recursos tuyos · toca el engranaje para editarlos`}
              </p>
            </div>
          </div>
        ) : null}
      </motion.div>

      {/* ══ Diálogos ══ */}
      <AnimatePresence>
        {studio && (
          <TextureStudio
            ownerId={ownerId}
            category={studio.asset?.category ?? category}
            asset={studio.asset}
            seed={studio.seed}
            onClose={() => setStudio(null)}
            onSaved={async (saved) => {
              await loadAssets();
              setSelectedId(saved._id);
              setCategory(saved.category);
              setSheetOpen(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Acciones de un recurso guardado */}
      <AnimatePresence>
        {actionsAsset && (
          <EditorDialog
            title={actionsAsset.name}
            subtitle={`${CATEGORY_LABEL[actionsAsset.category]} · ${actionsAsset.size}×${actionsAsset.size}`}
            onClose={() => setActionsAsset(null)}
          >
            <DialogAction
              icon={<Pencil className="h-4 w-4" />}
              label="Editar textura"
              onClick={() => {
                setStudio({ asset: actionsAsset, seed: null });
                setActionsAsset(null);
              }}
            />
            <DialogAction
              icon={<Check className="h-4 w-4" />}
              label="Seleccionar para pintar"
              onClick={() => {
                setSelectedId(actionsAsset._id);
                setActionsAsset(null);
              }}
            />
            <DialogAction
              icon={<Settings className="h-4 w-4" />}
              label="Renombrar"
              onClick={() => {
                setRenameTarget(actionsAsset);
                setRenameValue(actionsAsset.name);
                setActionsAsset(null);
              }}
            />
            <DialogAction
              icon={<Trash2 className="h-4 w-4" />}
              label="Eliminar recurso"
              destructive
              onClick={() => void handleDeleteAsset(actionsAsset)}
            />
          </EditorDialog>
        )}
      </AnimatePresence>

      {/* Acciones de un recurso del motor */}
      <AnimatePresence>
        {builtinActions && (
          <EditorDialog
            title={builtinActions.name}
            subtitle={`${CATEGORY_LABEL[builtinActions.category]} · recurso del motor`}
            onClose={() => setBuiltinActions(null)}
          >
            <p className="mb-3 rounded-xl bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
              Los recursos del motor no se modifican: al editarlos se abre el lienzo con su
              textura y se guarda como un recurso tuyo.
            </p>
            <DialogAction
              icon={<Paintbrush className="h-4 w-4" />}
              label="Crear mi recurso a partir de este"
              onClick={() => {
                openSeedFromBuiltin(builtinActions.id);
                setBuiltinActions(null);
              }}
            />
            <DialogAction
              icon={<Check className="h-4 w-4" />}
              label="Seleccionar para pintar"
              onClick={() => {
                setSelectedId(builtinActions.id);
                setBuiltinActions(null);
              }}
            />
          </EditorDialog>
        )}
      </AnimatePresence>

      {/* Ajustar el recurso colocado */}
      <AnimatePresence>
        {adjustCell && adjustCellValue && (
          <EditorDialog title="Ajustar recurso" subtitle="Giro y volteo de la casilla" onClose={() => setAdjustCell(null)}>
            <div className="mb-3 flex items-center justify-center rounded-xl bg-muted p-4">
              <img
                src={textureMap.get(adjustCellValue.id) ?? ""}
                alt=""
                className="h-16 w-16 [image-rendering:pixelated]"
                style={{ transform: cellTransform(adjustCellValue) }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <DialogButton
                icon={<RotateCw className="h-4 w-4" />}
                label="Girar 90°"
                onClick={() =>
                  updateCell(adjustCell, {
                    ...adjustCellValue,
                    rot: (adjustCellValue.rot + 90) % 360,
                  })
                }
              />
              <DialogButton
                icon={<FlipHorizontal2 className="h-4 w-4" />}
                label="Voltear H"
                onClick={() => updateCell(adjustCell, { ...adjustCellValue, flipH: !adjustCellValue.flipH })}
              />
              <DialogButton
                icon={<FlipVertical2 className="h-4 w-4" />}
                label="Voltear V"
                onClick={() => updateCell(adjustCell, { ...adjustCellValue, flipV: !adjustCellValue.flipV })}
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <DialogButton
                icon={<ArrowLeftRight className="h-4 w-4" />}
                label="Reiniciar"
                onClick={() => updateCell(adjustCell, { ...adjustCellValue, rot: 0, flipH: false, flipV: false })}
              />
              <DialogButton
                icon={<Trash2 className="h-4 w-4" />}
                label="Quitar"
                destructive
                onClick={() => {
                  updateCell(adjustCell, null);
                  setAdjustCell(null);
                }}
              />
            </div>
          </EditorDialog>
        )}
      </AnimatePresence>

      {/* Renombrar recurso */}
      <AnimatePresence>
        {renameTarget && (
          <EditorDialog title="Renombrar recurso" subtitle={renameTarget.name} onClose={() => setRenameTarget(null)}>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              maxLength={40}
              className="h-10 w-full rounded-xl border border-border/40 bg-background px-3 text-sm outline-none focus:border-primary/50"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="h-9 rounded-lg border border-border/50 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleRename()}
                className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:brightness-110"
              >
                Guardar
              </button>
            </div>
          </EditorDialog>
        )}
      </AnimatePresence>

      {/* Datos del nivel */}
      <AnimatePresence>
        {showData && (
          <EditorDialog title="Datos del nivel" subtitle={scene.name} onClose={() => setShowData(false)}>
            <div className="overflow-hidden rounded-xl border border-border/40">
              {[
                { label: "Tipo de juego", value: GENRE_LABEL[scene.genre] ?? scene.genre },
                { label: "Tamaño", value: `${width} × ${height}` },
                { label: "Casillas del mapa", value: String(placedMap) },
                { label: "Casillas de interfaz", value: String(placedUi) },
                { label: "Recursos colocados", value: String(usedResources) },
                { label: "Recursos guardados", value: String(assetStats.total) },
                { label: "Píxeles pintados", value: paintedPixels.toLocaleString("es") },
              ].map((row, i) => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between px-3 py-2.5 ${i > 0 ? "border-t border-border/30" : ""}`}
                >
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className="text-xs font-bold tabular-nums">{row.value}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowData(false);
                onOpenProjectStats();
              }}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/50 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
            >
              <Hash className="h-3.5 w-3.5" /> Ver estadísticas del proyecto
            </button>
          </EditorDialog>
        )}
      </AnimatePresence>

      {/* Info / detalles */}
      <AnimatePresence>
        {showInfo && (
          <EditorDialog title="Detalles de la escena" subtitle={scene.name} onClose={() => setShowInfo(false)}>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5">
                <span>Tipo</span>
                <span className="font-bold text-foreground">{GENRE_LABEL[scene.genre] ?? scene.genre}</span>
              </p>
              <p className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5">
                <span>Lienzo</span>
                <span className="font-bold text-foreground">
                  {width} × {height}
                </span>
              </p>
              <p className="leading-relaxed">
                Usa la ventana inferior para elegir un recurso, pintarlo en la casilla que quieras y
                ajustarlo con la herramienta Ajustar. Todo se guarda en tu dispositivo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowInfo(false);
                setShowNotes(true);
              }}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/50 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Editar notas
            </button>
          </EditorDialog>
        )}
      </AnimatePresence>

      {/* Notas del nivel */}
      <AnimatePresence>
        {showNotes && (
          <EditorDialog
            title="Notas del nivel"
            subtitle="Se guardan con la escena"
            onClose={() => setShowNotes(false)}
          >
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 300))}
              rows={5}
              placeholder="Objetivo del nivel, enemigos, ideas…"
              className="min-h-[110px] w-full resize-none rounded-xl border border-border/40 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{description.length}/300</span>
              <button
                type="button"
                onClick={async () => {
                  await saveDescription();
                  setShowNotes(false);
                }}
                className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:brightness-110"
              >
                Guardar notas
              </button>
            </div>
          </EditorDialog>
        )}
      </AnimatePresence>

      {/* Menú del editor */}
      <AnimatePresence>
        {showMenu && (
          <EditorDialog title="Menú del editor" subtitle={scene.name} onClose={() => setShowMenu(false)}>
            <div className="space-y-2">
              <MenuRow
                icon={<Save className="h-4 w-4" />}
                label="Guardar nivel"
                hint={dirty ? "Hay cambios sin guardar" : "Todo guardado"}
                onClick={() => {
                  setShowMenu(false);
                  void handleSave();
                }}
              />
              <MenuRow
                icon={<Play className="h-4 w-4" />}
                label="Probar nivel"
                hint="Vista previa sin controles"
                onClick={() => {
                  setShowMenu(false);
                  setPreview(true);
                }}
              />
              <MenuRow
                icon={<Search className="h-4 w-4" />}
                label="Buscar recurso"
                hint={`${assets.length} recursos guardados`}
                onClick={() => {
                  setShowMenu(false);
                  setSheetOpen(true);
                  setSearchOpen(true);
                }}
              />
              <MenuRow
                icon={<MessageSquare className="h-4 w-4" />}
                label="Notas del nivel"
                hint={description ? "Editar las notas guardadas" : "Añadir notas al nivel"}
                onClick={() => {
                  setShowMenu(false);
                  setShowNotes(true);
                }}
              />
              <MenuRow
                icon={<Layers className="h-4 w-4" />}
                label="Ver capas"
                hint={`Mapa (${placedMap}) · Interfaz (${placedUi})`}
                onClick={() => {
                  setShowMenu(false);
                  setShowData(true);
                }}
              />
              <MenuRow
                icon={<Pencil className="h-4 w-4" />}
                label="Detalles de la escena"
                onClick={() => {
                  setShowMenu(false);
                  setShowInfo(true);
                }}
              />
              <MenuRow
                icon={<Settings className="h-4 w-4" />}
                label="Ajustes del proyecto"
                onClick={() => {
                  setShowMenu(false);
                  onOpenSettings();
                }}
              />
              <MenuRow
                icon={<Trash2 className="h-4 w-4" />}
                label="Limpiar nivel"
                destructive
                onClick={() => {
                  setGrid({});
                  setDirty(true);
                  setShowMenu(false);
                  toast.success("Nivel limpiado (recuerda guardar)");
                }}
              />
            </div>
          </EditorDialog>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Piezas de UI del editor
// ════════════════════════════════════════════════════════════════════

// Botón compacto de icono: mantiene la función y evita rótulos flotantes extra.
function EditorIconButton({
  label,
  children,
  onClick,
  className = "h-8 w-8",
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 ${className}`}
    >
      {children}
    </button>
  );
}

// Tarjeta de recurso: caja cuadrada + tira de nombre idéntica en todas, así
// los recursos siempre se ven del mismo tamaño y se identifican de un vistazo.
// El botón de engranaje del usuario queda dentro de la tira (no tapa la imagen).
function AssetTile({
  name,
  url,
  selected,
  onSelect,
  onMenu,
}: {
  name: string;
  url: string;
  selected: boolean;
  onSelect: () => void;
  onMenu: () => void;
}) {
  return (
    <div
      className={`relative flex aspect-square flex-col overflow-hidden rounded-xl border bg-muted/60 transition-colors ${
        selected ? "border-primary ring-2 ring-primary/30" : "border-border/40 hover:border-primary/40"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        title={name}
        aria-label={name}
        className="flex min-h-0 flex-1 items-center justify-center p-1.5"
      >
        {url ? (
          <img
            src={url}
            alt=""
            className="h-full w-full object-contain [image-rendering:pixelated]"
          />
        ) : (
          <Square className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      <div className="flex h-6 shrink-0 items-center gap-0.5 border-t border-border/40 bg-card/85 pl-1.5 pr-0.5">
        <span className="min-w-0 flex-1 truncate text-[9px] font-semibold text-muted-foreground">
          {name}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMenu();
          }}
          title={`Opciones de ${name}`}
          aria-label={`Opciones de ${name}`}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${
            selected
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-primary"
          }`}
        >
          <Settings className="h-3 w-3" />
        </button>
      </div>
      {selected && (
        <span className="pointer-events-none absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
          <Check className="h-3 w-3" />
        </span>
      )}
    </div>
  );
}

function EditorDialog({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
        className="max-h-[86vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-border/40 bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-card-foreground">{title}</h3>
            {subtitle && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function DialogAction({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition-colors ${
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-card-foreground hover:bg-muted"
      }`}
    >
      <span className={destructive ? "text-destructive" : "text-primary"}>{icon}</span>
      {label}
    </button>
  );
}

function DialogButton({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-xl border border-border/40 py-3 text-[11px] font-medium transition-colors ${
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-card-foreground hover:bg-muted"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MenuRow({
  icon,
  label,
  hint,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
        destructive ? "text-destructive hover:bg-destructive/10" : "hover:bg-muted"
      }`}
    >
      <span className={destructive ? "text-destructive" : "text-primary"}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
    </button>
  );
}
