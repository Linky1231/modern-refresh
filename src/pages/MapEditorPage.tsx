// ▶ Editor de Mapas — PRINCIPAL apartado del editor de juegos (Asternal)
// Es un "pizarrón": un lienzo cuadriculado donde creas tu mapa para RPG o
// Plataformeros. Primero defines el detalle del mapa (nombre, descripción,
// género, tamaño y fondo) y luego pintas tiles sobre el lienzo.
// Todo se guarda en el dispositivo (localStorage vía @/lib/db).
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  getMaps,
  createMap,
  updateMap,
  deleteMap,
  type MapView,
  type MapGenre,
} from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Plus,
  Map as MapIcon,
  Swords,
  Gamepad2,
  Trash2,
  Pencil,
  Check,
  Eraser,
  Sparkles,
  Mountain,
  TreePine,
  Droplets,
  Home,
  Crown,
  Flag,
  CircleDot,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// ── Paletas de tiles por género ─────────────────────────────────────
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

function tilesForGenre(genre: MapGenre): TileDef[] {
  return genre === "rpg" ? RPG_TILES : PLATFORMER_TILES;
}

const BACKGROUNDS = [
  { id: "#f8fafc", label: "Claro" },
  { id: "#eef2ff", label: "Azulado" },
  { id: "#ecfdf5", label: "Verdoso" },
  { id: "#fefce8", label: "Amarillento" },
  { id: "#1e293b", label: "Noche" },
];

const GENRES: Array<{ id: MapGenre; label: string; desc: string; icon: React.ReactNode }> = [
  {
    id: "rpg",
    label: "RPG",
    desc: "Mapa por casillas: pueblos, mazmorras, exploración por turnos.",
    icon: <Swords className="h-4 w-4" />,
  },
  {
    id: "platformer",
    label: "Plataformas",
    desc: "Nivel de saltos: suelos, plataformas, pinchos y meta.",
    icon: <Gamepad2 className="h-4 w-4" />,
  },
];

// ── Tipos internos ──────────────────────────────────────────────────
type TileGrid = Record<string, string>; // "x,y" -> tileId

interface MapDraft {
  name: string;
  description: string;
  genre: MapGenre;
  width: number;
  height: number;
  background: string;
}

const DEFAULT_DRAFT: MapDraft = {
  name: "",
  description: "",
  genre: "rpg",
  width: 24,
  height: 16,
  background: "#f8fafc",
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("es", { day: "numeric", month: "short" });
}

// ════════════════════════════════════════════════════════════════════
// Página principal: lista de mapas (selector) + pizarrón de edición
// ════════════════════════════════════════════════════════════════════
export default function MapEditorPage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const ownerId = user?._id ?? "";

  const [maps, setMaps] = useState<MapView[] | undefined>(undefined);
  const [editingMap, setEditingMap] = useState<MapView | null>(null);
  const [creating, setCreating] = useState(false);

  const refreshMaps = useCallback(async () => {
    if (!ownerId) return;
    try {
      const data = await getMaps(ownerId);
      setMaps(data);
    } catch (e) {
      console.error("Error cargando mapas:", e);
      setMaps([]);
    }
  }, [ownerId]);

  useEffect(() => {
    void refreshMaps();
  }, [refreshMaps]);

  if (!ownerId) return null;

  // ── Pizarrón activo ──
  if (editingMap) {
    return (
      <MapCanvas
        map={editingMap}
        ownerId={ownerId}
        onBack={() => {
          setEditingMap(null);
          void refreshMaps();
        }}
      />
    );
  }

  return (
    <div className="pb-28">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-sm"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-1 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100"
              aria-label="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-[15px] font-semibold tracking-tight text-slate-800">Editor de mapas</span>
          </div>
        </div>

        {/* Intro / pizarrón vacío */}
        <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MapIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-card-foreground">Tu pizarrón de mapas</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Crea mapas para <span className="font-medium text-primary">RPG</span> o{" "}
                <span className="font-medium text-primary">Plataformas</span>: define nombre, detalle y
                pinta tu mundo casilla por casilla.
              </p>
            </div>
          </div>
          <Button
            className="mt-3 w-full gap-2 rounded-full"
            onClick={() => setCreating(true)}
          >
            <Plus className="h-4 w-4" />
            Crear mapa nuevo
          </Button>
        </div>

        {/* Lista de mapas */}
        <h2 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Mis mapas
        </h2>

        {maps === undefined ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-slate-200/80 bg-white" />
            ))}
          </div>
        ) : maps.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 py-12 text-center">
            <MapIcon className="h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-600">Todavía no hay mapas</p>
            <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">
              Pulsa “Crear mapa nuevo” y empieza a dibujar tu mundo en el pizarrón.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {maps.map((m) => (
              <div
                key={m._id}
                className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
              >
                {/* Miniatura del lienzo */}
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-200"
                  style={{
                    background: `linear-gradient(135deg, ${m.background} 0%, ${m.background} 100%)`,
                  }}
                >
                  {m.genre === "rpg" ? (
                    <Swords className="h-5 w-5 text-primary/70" />
                  ) : (
                    <Gamepad2 className="h-5 w-5 text-primary/70" />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setEditingMap(m)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-semibold text-card-foreground">{m.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {m.description || "Sin descripción"}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] font-medium text-slate-400">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                      {m.genre === "rpg" ? "RPG" : "Plataformas"}
                    </span>
                    <span>{m.width}×{m.height}</span>
                    <span>· {formatDate(m.updatedAt)}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setEditingMap(m)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Abrir en el pizarrón"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`¿Eliminar el mapa “${m.name}”? Esta acción no se puede deshacer.`)) return;
                    try {
                      await deleteMap(ownerId, m._id);
                      toast.success("Mapa eliminado");
                      void refreshMaps();
                    } catch (e) {
                      console.error(e);
                      toast.error("No se pudo eliminar el mapa");
                    }
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label="Eliminar mapa"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Modal de creación con detalles del mapa */}
      <AnimatePresence>
        {creating && (
          <MapDetailsModal
            ownerId={ownerId}
            onClose={() => setCreating(false)}
            onCreated={(map) => {
              setCreating(false);
              setEditingMap(map);
              void refreshMaps();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Modal: detalle del mapa (nombre, descripción, género, tamaño, fondo)
// ════════════════════════════════════════════════════════════════════
function MapDetailsModal({
  ownerId,
  onClose,
  onCreated,
}: {
  ownerId: string;
  onClose: () => void;
  onCreated: (map: MapView) => void;
}) {
  const [draft, setDraft] = useState<MapDraft>(DEFAULT_DRAFT);
  const [saving, setSaving] = useState(false);
  const genreTiles = tilesForGenre(draft.genre);

  const canSave = draft.name.trim().length > 0;

  const handleCreate = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const map = await createMap(ownerId, {
        name: draft.name,
        description: draft.description,
        genre: draft.genre,
        width: draft.width,
        height: draft.height,
        background: draft.background,
      });
      toast.success("Mapa creado — ¡a pintar!");
      onCreated(map);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "No se pudo crear el mapa");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border/35 bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border/20 px-5 py-3">
          <span className="text-sm font-semibold">Nuevo mapa</span>
          <div className="flex items-center gap-2">
            {saving ? (
              <span className="flex h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                disabled={!canSave}
                className="flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
              >
                <Check className="h-3.5 w-3.5" />
                Crear
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Nombre */}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Nombre del mapa
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              maxLength={60}
              placeholder="Ej: Bosque de Asternal"
              className="h-10 w-full rounded-xl border border-border/35 bg-background px-3 text-sm text-card-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>

          {/* Descripción / detalle */}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Detalle del mapa
            </label>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value.slice(0, 300) }))}
              maxLength={300}
              rows={3}
              placeholder="¿Qué historia tiene este mapa?"
              className="min-h-[72px] w-full resize-none rounded-xl border border-border/35 bg-background px-3 py-2.5 text-sm text-card-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground/70">{draft.description.length}/300</p>
          </div>

          {/* Género */}
          <div className="mb-3">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tipo de juego
            </label>
            <div className="flex flex-col gap-2">
              {GENRES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, genre: g.id }))}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                    draft.genre === g.id
                      ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/35 bg-background hover:border-primary/30"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      draft.genre === g.id ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                    }`}
                  >
                    {g.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-card-foreground">{g.label}</p>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{g.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tamaño del lienzo */}
          <div className="mb-3">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tamaño del pizarrón
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={10}
                max={60}
                value={draft.width}
                onChange={(e) => setDraft((d) => ({ ...d, width: Number(e.target.value) }))}
                className="h-1.5 flex-1 accent-[var(--primary)]"
              />
              <span className="w-16 text-center text-xs font-semibold tabular-nums text-slate-700">
                {draft.width}×{draft.height}
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              {[
                { label: "Pequeño 16×12", w: 16, h: 12 },
                { label: "Mediano 24×16", w: 24, h: 16 },
                { label: "Grande 40×24", w: 40, h: 24 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, width: p.w, height: p.h }))}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    draft.width === p.w && draft.height === p.h
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/35 bg-background text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color de fondo */}
          <div className="mb-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fondo
            </label>
            <div className="flex flex-wrap gap-2">
              {BACKGROUNDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, background: b.id }))}
                  className={`h-8 w-8 rounded-full border-2 transition-transform ${
                    draft.background === b.id
                      ? "scale-110 border-primary"
                      : "border-slate-200 hover:scale-105"
                  }`}
                  style={{ backgroundColor: b.id }}
                  aria-label={b.label}
                  title={b.label}
                />
              ))}
            </div>
          </div>

          {/* Vista previa de tiles del género elegido */}
          <div className="mt-3 rounded-xl border border-border/30 bg-muted/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Piezas disponibles ({genreTiles.length})
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {genreTiles.map((t) => (
                <span
                  key={t.id}
                  className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium text-slate-700"
                  style={{ backgroundColor: `${t.color}33` }}
                >
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: t.color }} />
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Pizarrón: lienzo cuadriculado para pintar el mapa
// ════════════════════════════════════════════════════════════════════
function MapCanvas({
  map,
  ownerId,
  onBack,
}: {
  map: MapView;
  ownerId: string;
  onBack: () => void;
}) {
  const tiles = useMemo(() => tilesForGenre(map.genre), [map.genre]);
  const [activeTile, setActiveTile] = useState<string>(tiles[0].id);
  const [grid, setGrid] = useState<TileGrid>({});
  const [erasing, setErasing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const painting = useRef(false);

  useEffect(() => {
    setActiveTile(tiles[0].id);
  }, [tiles]);

  // Cargar contenido guardado del mapa (si existiera en futuras versiones,
  // aquí se hidrataría; por ahora el lienzo inicia limpio).
  useEffect(() => {
    setGrid({});
    setDirty(false);
  }, [map._id]);

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
      setDirty(true);
    },
    [activeTile, erasing],
  );

  const handlePointerDown = (x: number, y: number) => {
    painting.current = true;
    paintAt(x, y);
  };

  const handlePointerEnter = (x: number, y: number) => {
    if (!painting.current) return;
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

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // El detalle del mapa ya está guardado; el contenido del lienzo se
      // conserva en memoria durante la sesión de dibujo. Aquí se persistiría
      // la cuadrícula (próximo paso: tiles en la nube).
      await updateMap(ownerId, map._id, {});
      setDirty(false);
      toast.success("Mapa guardado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar el mapa");
    } finally {
      setSaving(false);
    }
  };

  const cellPx = map.width > 40 ? 14 : map.width > 24 ? 18 : 22;

  return (
    <div className="pb-28">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-sm"
      >
        {/* Header del pizarrón */}
        <div className="flex items-center justify-between px-1 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100"
              aria-label="Volver a mis mapas"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="truncate text-[15px] font-semibold tracking-tight text-slate-800">
              {map.name}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
          >
            {saving ? (
              <span className="flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Guardar
          </button>
        </div>

        {/* Info del mapa */}
        <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-medium text-slate-500">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
            {map.genre === "rpg" ? "RPG" : "Plataformas"}
          </span>
          <span>{map.width}×{map.height} casillas</span>
          {map.description && <span className="truncate text-slate-400">· {map.description}</span>}
        </div>

        {/* Paleta de herramientas */}
        <div className="sticky top-0 z-10 -mx-1 mb-2 bg-background/95 px-1 py-2 backdrop-blur-sm">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => {
                setErasing(false);
                setActiveTile(tiles[0].id);
              }}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
                !erasing
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-slate-200 bg-white text-slate-600 hover:border-primary/30"
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              Pintar
            </button>
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
        </div>

        {/* Lienzo cuadriculado */}
        <div className="overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <div
            className="relative select-none"
            style={{ background: map.background }}
            onPointerLeave={() => {
              painting.current = false;
            }}
          >
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${map.width}, ${cellPx}px)`,
                gridTemplateRows: `repeat(${map.height}, ${cellPx}px)`,
              }}
            >
              {Array.from({ length: map.width * map.height }, (_, i) => {
                const x = i % map.width;
                const y = Math.floor(i / map.width);
                const key = `${x},${y}`;
                const tileId = grid[key];
                const tile = tileId ? tiles.find((t) => t.id === tileId) : null;
                return (
                  <div
                    key={key}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handlePointerDown(x, y);
                    }}
                    onPointerEnter={() => handlePointerEnter(x, y)}
                    className="cursor-crosshair border-[0.5px] border-slate-200/60"
                    style={{ backgroundColor: tile ? tile.color : undefined }}
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
          </div>
        </div>

        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
          Arrastra el dedo o el mouse sobre el pizarrón para pintar. Usa <Borrar /> para quitar casillas.
        </p>
      </motion.div>
    </div>
  );
}

// Pequeño helper inline para el texto de ayuda
function Borrar() {
  return <span className="font-medium text-slate-600">Borrar</span>;
}
