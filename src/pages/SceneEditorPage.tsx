// ▶ Editor de Escenas — apartado PRINCIPAL del editor de juegos (Asternal)
// Sigue el wireframe del motor: barra superior (volver · estadísticas · ajustes),
// botón "+ Crear Escena", tablero punteado con las escenas del proyecto y un
// botón Publicar abajo a la derecha. Incluye un SISTEMA DE COPIAS DE SEGURIDAD
// (crear, restaurar y eliminar) organizado dentro de Ajustes.
// Todo se guarda en el dispositivo (localStorage vía @/lib/db).
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  getMaps,
  createMap,
  updateMap,
  deleteMap,
  getBackups,
  createBackup,
  deleteBackup,
  restoreBackup,
  createPost,
  type MapView,
  type MapGenre,
  type BackupView,
} from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Plus,
  Layers,
  BarChart3,
  Settings,
  Upload,
  Trash2,
  RotateCcw,
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
  Swords,
  Gamepad2,
  HardDriveDownload,
  ShieldCheck,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// ── Paletas de piezas por género ───────────────────────────────────
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
    desc: "Escena por casillas: pueblos, mazmorras, exploración por turnos.",
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

interface SceneDraft {
  name: string;
  description: string;
  genre: MapGenre;
  width: number;
  height: number;
  background: string;
}

const DEFAULT_DRAFT: SceneDraft = {
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

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Fondo de tablero punteado, con la paleta del motor
const BOARD_DOTS: React.CSSProperties = {
  backgroundColor: "#ffffff",
  backgroundImage:
    "radial-gradient(circle, color-mix(in srgb, var(--primary) 22%, transparent) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};

// ════════════════════════════════════════════════════════════════════
// Página principal: tablero de escenas + copias de seguridad
// ════════════════════════════════════════════════════════════════════
export default function SceneEditorPage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const ownerId = user?._id ?? "";

  const [scenes, setScenes] = useState<MapView[] | undefined>(undefined);
  const [backups, setBackups] = useState<BackupView[]>([]);
  const [editingScene, setEditingScene] = useState<MapView | null>(null);
  const [creating, setCreating] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const refresh = useCallback(async () => {
    if (!ownerId) return;
    try {
      const [sceneData, backupData] = await Promise.all([getMaps(ownerId), getBackups(ownerId)]);
      setScenes(sceneData);
      setBackups(backupData);
    } catch (e) {
      console.error("Error cargando el proyecto:", e);
      setScenes([]);
      setBackups([]);
    }
  }, [ownerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!ownerId) return null;

  // ── Pizarrón activo ──
  if (editingScene) {
    return (
      <SceneCanvas
        scene={editingScene}
        ownerId={ownerId}
        onBack={() => {
          setEditingScene(null);
          void refresh();
        }}
      />
    );
  }

  const list = scenes ?? [];
  const handlers = {
    onOpen: (s: MapView) => setEditingScene(s),
    onDelete: async (s: MapView) => {
      if (!confirm(`¿Eliminar la escena “${s.name}”? Esta acción no se puede deshacer.`)) return;
      try {
        await deleteMap(ownerId, s._id);
        toast.success("Escena eliminada");
        void refresh();
      } catch (e) {
        console.error(e);
        toast.error("No se pudo eliminar la escena");
      }
    },
  };

  return (
    <div className="pb-28">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-sm"
      >
        {/* ── Barra superior del motor ── */}
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <span className="min-w-0 flex-1 truncate pl-1 text-[13px] font-semibold tracking-tight text-slate-800">
            Editor de escenas
          </span>
          <button
            type="button"
            onClick={() => setShowStats(true)}
            aria-label="Estadísticas del proyecto"
            title="Estadísticas"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <BarChart3 className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            aria-label="Ajustes y copias de seguridad"
            title="Ajustes"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* ── Crear escena ── */}
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Layers className="h-5 w-5" />
          </span>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Crear Escena
          </button>
        </div>

        {/* ── Tablero de escenas ── */}
        <div
          className="mt-3 min-h-[360px] rounded-2xl border border-slate-200 p-4 shadow-sm"
          style={BOARD_DOTS}
        >
          {scenes === undefined ? (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="flex min-h-[328px] flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Layers className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">Todavía no hay escenas</p>
              <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-slate-500">
                Pulsa “Crear Escena” para añadir tu primera escena al tablero.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {list.map((s) => (
                <SceneCard key={s._id} scene={s} {...handlers} />
              ))}
            </div>
          )}
        </div>

        {/* ── Publicar ── */}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => setPublishing(true)}
            disabled={list.length === 0}
            className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
          >
            <Upload className="h-4 w-4" />
            Publicar
          </button>
        </div>
      </motion.div>

      {/* Modal de creación de escena */}
      <AnimatePresence>
        {creating && (
          <SceneDetailsModal
            ownerId={ownerId}
            onClose={() => setCreating(false)}
            onCreated={(scene) => {
              setCreating(false);
              setEditingScene(scene);
              void refresh();
            }}
          />
        )}
      </AnimatePresence>

      {/* Panel de estadísticas */}
      <AnimatePresence>
        {showStats && (
          <StatsSheet
            scenes={list}
            backups={backups}
            onClose={() => setShowStats(false)}
          />
        )}
      </AnimatePresence>

      {/* Panel de ajustes con el sistema de copias de seguridad */}
      <AnimatePresence>
        {showSettings && (
          <SettingsSheet
            ownerId={ownerId}
            backups={backups}
            onChange={() => void refresh()}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>

      {/* Modal de publicación */}
      <AnimatePresence>
        {publishing && (
          <PublishModal
            ownerId={ownerId}
            scenes={list}
            onClose={() => setPublishing(false)}
            onPublished={() => {
              setPublishing(false);
              onBack();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Tarjeta de escena (tablero)
// ════════════════════════════════════════════════════════════════════
function SceneCard({
  scene,
  onOpen,
  onDelete,
}: {
  scene: MapView;
  onOpen: (s: MapView) => void;
  onDelete: (s: MapView) => void;
}) {
  const painted = Object.keys(scene.tiles ?? {}).length;
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => onOpen(scene)}
        className="block w-full text-left"
      >
        {/* Miniatura */}
        <div
          className="relative flex h-24 items-center justify-center border-b border-slate-100"
          style={{ backgroundColor: scene.background }}
        >
          {scene.genre === "rpg" ? (
            <Swords className="h-6 w-6 text-primary/70" />
          ) : (
            <Gamepad2 className="h-6 w-6 text-primary/70" />
          )}
          <span className="absolute left-2 top-2 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold text-primary backdrop-blur-sm">
            {scene.genre === "rpg" ? "RPG" : "Plataformas"}
          </span>
        </div>
        <div className="px-2.5 py-2">
          <p className="truncate text-[13px] font-semibold text-slate-800">{scene.name}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {scene.width}×{scene.height} · {painted} piezas
          </p>
        </div>
      </button>

      {/* Acciones */}
      <div className="absolute right-1.5 top-1.5 flex gap-1">
        <button
          type="button"
          onClick={() => onOpen(scene)}
          aria-label="Abrir escena"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-slate-600 shadow-sm backdrop-blur-sm transition-colors hover:text-primary"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(scene)}
          aria-label="Eliminar escena"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-slate-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Modal: detalle de la escena (nombre, descripción, género, tamaño, fondo)
// ════════════════════════════════════════════════════════════════════
function SceneDetailsModal({
  ownerId,
  onClose,
  onCreated,
}: {
  ownerId: string;
  onClose: () => void;
  onCreated: (scene: MapView) => void;
}) {
  const [draft, setDraft] = useState<SceneDraft>(DEFAULT_DRAFT);
  const [saving, setSaving] = useState(false);
  const genreTiles = tilesForGenre(draft.genre);

  const canSave = draft.name.trim().length > 0;

  const handleCreate = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const scene = await createMap(ownerId, {
        name: draft.name,
        description: draft.description,
        genre: draft.genre,
        width: draft.width,
        height: draft.height,
        background: draft.background,
      });
      toast.success("Escena creada — ¡a diseñarla!");
      onCreated(scene);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "No se pudo crear la escena");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
        <span className="text-sm font-semibold text-slate-800">Nueva escena</span>
        <div className="flex items-center gap-2">
          {saving ? (
            <span className="flex h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
            className="flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            Cancelar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {/* Nombre */}
        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Nombre de la escena
          </label>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            maxLength={60}
            placeholder="Ej: Bosque de Asternal"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
        </div>

        {/* Detalle */}
        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Detalle de la escena
          </label>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value.slice(0, 300) }))}
            maxLength={300}
            rows={3}
            placeholder="¿Qué ocurre en esta escena?"
            className="min-h-[72px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
          <p className="mt-1 text-right text-[11px] text-slate-400">{draft.description.length}/300</p>
        </div>

        {/* Género */}
        <div className="mb-3">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
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
                    : "border-slate-200 bg-white hover:border-primary/30"
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
                  <p className="text-sm font-semibold text-slate-800">{g.label}</p>
                  <p className="mt-0.5 text-xs leading-snug text-slate-500">{g.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Tamaño del tablero */}
        <div className="mb-3">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tamaño del tablero
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
                    : "border-slate-200 bg-white text-slate-500 hover:border-primary/30"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fondo */}
        <div className="mb-2">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Fondo
          </label>
          <div className="flex flex-wrap gap-2">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, background: b.id }))}
                className={`h-8 w-8 rounded-full border-2 transition-transform ${
                  draft.background === b.id ? "scale-110 border-primary" : "border-slate-200 hover:scale-105"
                }`}
                style={{ backgroundColor: b.id }}
                aria-label={b.label}
                title={b.label}
              />
            ))}
          </div>
        </div>

        {/* Piezas del género elegido */}
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
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
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════
// Panel: estadísticas del proyecto
// ════════════════════════════════════════════════════════════════════
function StatsSheet({
  scenes,
  backups,
  onClose,
}: {
  scenes: MapView[];
  backups: BackupView[];
  onClose: () => void;
}) {
  const totalCells = scenes.reduce((acc, s) => acc + s.width * s.height, 0);
  const totalPieces = scenes.reduce((acc, s) => acc + Object.keys(s.tiles ?? {}).length, 0);
  const rpg = scenes.filter((s) => s.genre === "rpg").length;
  const platformer = scenes.length - rpg;

  const rows = [
    { label: "Escenas", value: String(scenes.length), icon: <Layers className="h-4 w-4" /> },
    { label: "Casillas totales", value: totalCells.toLocaleString("es"), icon: <BarChart3 className="h-4 w-4" /> },
    { label: "Piezas pintadas", value: totalPieces.toLocaleString("es"), icon: <Pencil className="h-4 w-4" /> },
    { label: "Escenas RPG", value: String(rpg), icon: <Swords className="h-4 w-4" /> },
    { label: "Escenas de Plataformas", value: String(platformer), icon: <Gamepad2 className="h-4 w-4" /> },
    { label: "Copias de seguridad", value: String(backups.length), icon: <ShieldCheck className="h-4 w-4" /> },
  ];

  return (
    <ModalShell onClose={onClose}>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
        <span className="text-sm font-semibold text-slate-800">Estadísticas del proyecto</span>
        <CloseButton onClick={onClose} />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={`flex items-center justify-between px-4 py-3 ${
                i > 0 ? "border-t border-slate-100" : ""
              }`}
            >
              <span className="flex items-center gap-2.5 text-[13px] font-medium text-slate-600">
                <span className="text-primary">{r.icon}</span>
                {r.label}
              </span>
              <span className="text-sm font-bold tabular-nums text-slate-800">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════
// Panel: ajustes + SISTEMA DE COPIAS DE SEGURIDAD
// ════════════════════════════════════════════════════════════════════
function SettingsSheet({
  ownerId,
  backups,
  onChange,
  onClose,
}: {
  ownerId: string;
  backups: BackupView[];
  onChange: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState("");

  const handleCreate = async () => {
    setBusy("create");
    try {
      await createBackup(ownerId, name);
      setName("");
      toast.success("Copia de seguridad creada");
      onChange();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo crear la copia");
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async (b: BackupView) => {
    if (
      !confirm(
        `¿Restaurar “${b.name}”? Las escenas actuales del proyecto se reemplazarán por las de esta copia.`,
      )
    )
      return;
    setBusy(b._id);
    try {
      const n = await restoreBackup(ownerId, b._id);
      toast.success(`Proyecto restaurado · ${n} ${n === 1 ? "escena" : "escenas"}`);
      onChange();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "No se pudo restaurar la copia");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (b: BackupView) => {
    if (!confirm(`¿Eliminar la copia “${b.name}”?`)) return;
    setBusy(b._id);
    try {
      await deleteBackup(ownerId, b._id);
      toast.success("Copia eliminada");
      onChange();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo eliminar la copia");
    } finally {
      setBusy(null);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
        <span className="text-sm font-semibold text-slate-800">Ajustes del proyecto</span>
        <CloseButton onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Encabezado de la sección */}
        <div className="flex items-center gap-2.5 rounded-2xl bg-primary/5 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-800">Copias de seguridad</p>
            <p className="text-[11px] leading-snug text-slate-500">
              Guarda el estado del proyecto y restáuralo cuando lo necesites.
            </p>
          </div>
        </div>

        {/* Crear copia */}
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Nombre (opcional)"
            className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy === "create"}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
          >
            {busy === "create" ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <HardDriveDownload className="h-3.5 w-3.5" />
            )}
            Crear copia
          </button>
        </div>

        {/* Lista organizada de copias */}
        <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Copias guardadas ({backups.length})
        </p>

        {backups.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 py-8 text-center">
            <ShieldCheck className="h-7 w-7 text-slate-300" />
            <p className="mt-2 text-[13px] font-medium text-slate-600">Sin copias todavía</p>
            <p className="mt-1 max-w-[220px] text-[11px] text-slate-500">
              Crea la primera copia de seguridad para proteger tu proyecto.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {backups.map((b) => (
              <li
                key={b._id}
                className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-slate-800">{b.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {formatDate(b.createdAt)} · {b.sceneCount}{" "}
                      {b.sceneCount === 1 ? "escena" : "escenas"} · {formatSize(b.sizeBytes)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => handleRestore(b)}
                      disabled={busy === b._id}
                      aria-label="Restaurar copia"
                      title="Restaurar"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(b)}
                      disabled={busy === b._id}
                      aria-label="Eliminar copia"
                      title="Eliminar"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════
// Modal: publicar el proyecto en el feed
// ════════════════════════════════════════════════════════════════════
function PublishModal({
  ownerId,
  scenes,
  onClose,
  onPublished,
}: {
  ownerId: string;
  scenes: MapView[];
  onClose: () => void;
  onPublished: () => void;
}) {
  const [title, setTitle] = useState("Mi proyecto de Asternal");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handlePublish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const sceneList = scenes.map((s) => `• ${s.name} (${s.genre === "rpg" ? "RPG" : "Plataformas"})`).join("\n");
      const content = [description.trim(), sceneList].filter(Boolean).join("\n\n");
      await createPost(ownerId, content, { title: title.trim() || "Mi proyecto de Asternal" });
      toast.success("Proyecto publicado en tu feed");
      onPublished();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "No se pudo publicar el proyecto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
        <span className="text-sm font-semibold text-slate-800">Publicar proyecto</span>
        <CloseButton onClick={onClose} />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Título
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          className="mb-3 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Descripción
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="Cuéntale a la comunidad de qué va tu juego…"
          className="min-h-[80px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />
        <p className="mt-1 text-right text-[11px] text-slate-400">{description.length}/500</p>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Se incluirán {scenes.length} {scenes.length === 1 ? "escena" : "escenas"}
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {scenes.slice(0, 5).map((s) => (
              <li key={s._id} className="truncate text-[12px] text-slate-600">
                • {s.name}
              </li>
            ))}
            {scenes.length > 5 && (
              <li className="text-[12px] text-slate-400">y {scenes.length - 5} más…</li>
            )}
          </ul>
        </div>
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-xl bg-slate-100 px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handlePublish}
          disabled={saving}
          className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
        >
          {saving ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Publicar
        </button>
      </div>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════
// Pizarrón: lienzo cuadriculado para pintar la escena
// ════════════════════════════════════════════════════════════════════
function SceneCanvas({
  scene,
  ownerId,
  onBack,
}: {
  scene: MapView;
  ownerId: string;
  onBack: () => void;
}) {
  const tiles = useMemo(() => tilesForGenre(scene.genre), [scene.genre]);
  const [activeTile, setActiveTile] = useState<string>(tiles[0].id);
  const [grid, setGrid] = useState<TileGrid>(scene.tiles ?? {});
  const [erasing, setErasing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const painting = useRef(false);

  useEffect(() => {
    setActiveTile(tiles[0].id);
  }, [tiles]);

  useEffect(() => {
    setGrid(scene.tiles ?? {});
    setDirty(false);
  }, [scene._id]);

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
      await updateMap(ownerId, scene._id, { tiles: grid });
      setDirty(false);
      toast.success("Escena guardada");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar la escena");
    } finally {
      setSaving(false);
    }
  };

  const cellPx = scene.width > 40 ? 14 : scene.width > 24 ? 18 : 22;

  return (
    <div className="pb-28">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-sm"
      >
        {/* Header del pizarrón */}
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver a las escenas"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <div className="h-6 w-px shrink-0 bg-slate-200" />
          <span className="min-w-0 flex-1 truncate pl-1 text-[13px] font-semibold tracking-tight text-slate-800">
            {scene.name}
          </span>
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

        {/* Info de la escena */}
        <div className="mb-2 mt-2 flex items-center gap-2 px-1 text-[11px] font-medium text-slate-500">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
            {scene.genre === "rpg" ? "RPG" : "Plataformas"}
          </span>
          <span>
            {scene.width}×{scene.height} casillas
          </span>
          {scene.description && <span className="truncate text-slate-400">· {scene.description}</span>}
        </div>

        {/* Paleta de herramientas */}
        <div className="sticky top-0 z-10 -mx-1 mb-2 bg-slate-100/95 px-1 py-2 backdrop-blur-sm">
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
            style={{ background: scene.background }}
            onPointerLeave={() => {
              painting.current = false;
            }}
          >
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

        <p className="mt-2 px-1 text-[11px] text-slate-500">
          Arrastra el dedo o el mouse sobre el pizarrón para pintar. Usa{" "}
          <span className="font-medium text-slate-600">Borrar</span> para quitar casillas.
        </p>
      </motion.div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Helpers de UI
// ════════════════════════════════════════════════════════════════════
function ModalShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
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
        className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Cerrar"
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
