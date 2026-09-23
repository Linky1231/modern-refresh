// ▶ Editor de Escenas — apartado PRINCIPAL del editor de juegos (Asternal)
// Sigue el wireframe del motor: barra superior (volver · estadísticas · ajustes),
// botón "+ Crear Escena", tablero punteado con las escenas del proyecto y un
// botón Publicar dentro del tablero. Incluye un SISTEMA DE COPIAS DE SEGURIDAD
// (crear, restaurar y eliminar) dentro de Ajustes.
// Interacciones del tablero:
//   · Tocar la escena (cuerpo)  -> abre el PIZARRÓN para editar el proyecto.
//   · Lápiz                     -> configura los detalles del mapa (nombre,
//                                  detalle, tipo de juego, tamaño, fondo).
//   · Papelera                  -> borra la escena (con confirmación en pantalla).
// Todo se guarda en el dispositivo (localStorage vía @/lib/db).
import { useState, useRef, useCallback, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  ArchiveRestore,
  AlertTriangle,
  Locate,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { usePan } from "@/hooks/use-pan";
import LevelEditor from "./editor/LevelEditor";

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

function draftFromScene(scene: MapView): SceneDraft {
  return {
    name: scene.name,
    description: scene.description,
    genre: scene.genre,
    width: scene.width,
    height: scene.height,
    background: scene.background,
  };
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("es", { day: "numeric", month: "short" });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  action: () => Promise<void> | void;
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
  const [detailsScene, setDetailsScene] = useState<MapView | null>(null);
  const [creating, setCreating] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  // El tablero de escenas se puede arrastrar libremente a cualquier posición.
  const [boardEl, setBoardEl] = useState<HTMLDivElement | null>(null);
  const board = usePan({ element: boardEl, enabled: true });

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

  // ── Editor de niveles activo (editar el proyecto de la escena) ──
  if (editingScene) {
    return (
      <>
        <LevelEditor
          scene={editingScene}
          ownerId={ownerId}
          onBack={() => {
            setEditingScene(null);
            void refresh();
          }}
          onOpenSettings={() => setShowSettings(true)}
          onOpenProjectStats={() => setShowStats(true)}
        />

        <AnimatePresence>
          {showSettings && (
            <SettingsSheet
              ownerId={ownerId}
              backups={backups}
              requestConfirm={setConfirmState}
              onChange={() => void refresh()}
              onClose={() => setShowSettings(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showStats && (
            <StatsSheet
              scenes={scenes ?? []}
              backups={backups}
              onClose={() => setShowStats(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {confirmState && (
            <ConfirmDialog
              title={confirmState.title}
              message={confirmState.message}
              confirmLabel={confirmState.confirmLabel}
              destructive={confirmState.destructive}
              onCancel={() => setConfirmState(null)}
              onConfirm={async () => {
                const action = confirmState.action;
                setConfirmState(null);
                await action();
              }}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  const list = scenes ?? [];

  const requestDeleteScene = (scene: MapView) => {
    setConfirmState({
      title: "¿Borrar escena?",
      message: `Se eliminará “${scene.name}” del proyecto con todo lo que hayas pintado. Esta acción no se puede deshacer.`,
      confirmLabel: "Borrar escena",
      destructive: true,
      action: async () => {
        try {
          await deleteMap(ownerId, scene._id);
          toast.success("Escena eliminada");
          void refresh();
        } catch (e) {
          console.error(e);
          toast.error("No se pudo eliminar la escena");
        }
      },
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto flex min-h-0 w-full max-w-sm flex-1 flex-col sm:max-w-2xl lg:max-w-3xl"
      >
        {/* ── Barra superior del motor ── */}
        <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-border/35 bg-card p-1.5 shadow-soft">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <div className="h-6 w-px bg-border" />
          <span className="min-w-0 flex-1 truncate pl-1 text-[13px] font-semibold tracking-tight text-foreground">
            Editor de escenas
          </span>
          <button
            type="button"
            onClick={() => setShowStats(true)}
            aria-label="Estadísticas del proyecto"
            title="Estadísticas"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <BarChart3 className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            aria-label="Ajustes y copias de seguridad"
            title="Ajustes"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* ── Crear escena ── */}
        <div className="mt-3 flex shrink-0 items-center gap-2 rounded-2xl border border-border/35 bg-card p-1.5 shadow-soft">
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

        {/* ── Tablero de escenas — cabe completo en una sola vista ── */}
        <div
          ref={setBoardEl}
          className="relative mt-3 mb-4 min-h-[240px] max-h-[60vh] flex-1 select-none overflow-hidden rounded-2xl border border-border/35 shadow-soft"
          style={{ ...BOARD_DOTS, ...board.interaction }}
          {...board.viewportProps}
        >
          {/* El tablero vive en su propio plano: se puede mover a cualquier posición. */}
          <div
            className="absolute left-0 top-0 w-full p-4 pb-20"
            style={{
              transform: `translate(${board.offset.x}px, ${board.offset.y}px)`,
              willChange: "transform",
            }}
          >
            {scenes === undefined ? (
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Layers className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-foreground">Todavía no hay escenas</p>
                <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-muted-foreground">
                  Pulsa “Crear Escena” para añadir tu primera escena al tablero.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 content-start gap-3">
                {list.map((s) => (
                  <SceneCard
                    key={s._id}
                    scene={s}
                    onOpen={() => setEditingScene(s)}
                    onConfigure={() => setDetailsScene(s)}
                    onDelete={() => requestDeleteScene(s)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Pista de arrastre + recentrar el tablero ── */}
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-2">
            <span className="hidden rounded-xl border border-border/40 bg-card/90 px-3 py-2 text-[11px] font-medium text-muted-foreground shadow-soft backdrop-blur-sm sm:inline-flex">
              Arrastra para mover el tablero
            </span>
            {!board.isCentered && (
              <button
                type="button"
                onClick={board.reset}
                title="Centrar el tablero"
                className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-xl border border-border/40 bg-card px-3 text-[11px] font-bold text-foreground shadow-soft transition-transform active:scale-95"
              >
                <Locate className="h-3.5 w-3.5 text-primary" />
                Centrar
              </button>
            )}
          </div>

          {/* ── Publicar (dentro del tablero, abajo a la derecha) ── */}
          <div className="pointer-events-none absolute bottom-3 right-3">
            <button
              type="button"
              onClick={() => setPublishing(true)}
              disabled={list.length === 0}
              className="pointer-events-auto flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
            >
              <Upload className="h-4 w-4" />
              Publicar
            </button>
          </div>
        </div>
      </motion.div>

      {/* Modal de creación de escena */}
      <AnimatePresence>
        {creating && (
          <SceneDetailsModal
            ownerId={ownerId}
            mode="create"
            onClose={() => setCreating(false)}
            onCreated={(scene) => {
              setCreating(false);
              setEditingScene(scene);
              void refresh();
            }}
          />
        )}
      </AnimatePresence>

      {/* Modal de detalles del mapa (lápiz) */}
      <AnimatePresence>
        {detailsScene && (
          <SceneDetailsModal
            key={detailsScene._id}
            ownerId={ownerId}
            mode="edit"
            scene={detailsScene}
            onClose={() => setDetailsScene(null)}
            onCreated={() => {
              setDetailsScene(null);
              void refresh();
            }}
          />
        )}
      </AnimatePresence>

      {/* Panel de estadísticas */}
      <AnimatePresence>
        {showStats && (
          <StatsSheet scenes={list} backups={backups} onClose={() => setShowStats(false)} />
        )}
      </AnimatePresence>

      {/* Panel de ajustes con el sistema de copias de seguridad */}
      <AnimatePresence>
        {showSettings && (
          <SettingsSheet
            ownerId={ownerId}
            backups={backups}
            requestConfirm={setConfirmState}
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

      {/* Confirmación en pantalla (borrar escena / copias) */}
      <AnimatePresence>
        {confirmState && (
          <ConfirmDialog
            title={confirmState.title}
            message={confirmState.message}
            confirmLabel={confirmState.confirmLabel}
            destructive={confirmState.destructive}
            onCancel={() => setConfirmState(null)}
            onConfirm={async () => {
              const action = confirmState.action;
              setConfirmState(null);
              await action();
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
  onConfigure,
  onDelete,
}: {
  scene: MapView;
  onOpen: () => void;
  onConfigure: () => void;
  onDelete: () => void;
}) {
  const painted = Object.keys(scene.tiles ?? {}).length;
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/35 bg-card shadow-soft transition-shadow hover:shadow-lift">
      {/* Cuerpo: abre el pizarrón para editar el proyecto de la escena */}
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div
          className="relative flex h-24 items-center justify-center border-b border-border/40"
          style={{ backgroundColor: scene.background }}
        >
          {scene.genre === "rpg" ? (
            <Swords className="h-6 w-6 text-primary/70" />
          ) : (
            <Gamepad2 className="h-6 w-6 text-primary/70" />
          )}
          <span className="absolute left-2 top-2 rounded-full bg-card/85 px-2 py-0.5 text-[10px] font-semibold text-primary backdrop-blur-sm">
            {scene.genre === "rpg" ? "RPG" : "Plataformas"}
          </span>
        </div>
        <div className="px-2.5 py-2">
          <p className="truncate text-[13px] font-semibold text-foreground">{scene.name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {scene.width}×{scene.height} · {painted} piezas
          </p>
        </div>
      </button>

      {/* Acciones */}
      <div className="absolute right-1.5 top-1.5 flex gap-1">
        <button
          type="button"
          onClick={onConfigure}
          aria-label="Configurar detalles del mapa"
          title="Configurar detalles del mapa"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-card/90 text-muted-foreground shadow-soft backdrop-blur-sm transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Borrar escena"
          title="Borrar escena"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-card/90 text-muted-foreground shadow-soft backdrop-blur-sm transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Modal: detalles del mapa (crear Y editar) — nombre, detalle, tipo, tamaño, fondo
// ════════════════════════════════════════════════════════════════════
function SceneDetailsModal({
  ownerId,
  mode,
  scene,
  onClose,
  onCreated,
}: {
  ownerId: string;
  mode: "create" | "edit";
  scene?: MapView;
  onClose: () => void;
  onCreated: (scene: MapView) => void;
}) {
  const isEdit = mode === "edit" && !!scene;
  const [draft, setDraft] = useState<SceneDraft>(scene ? draftFromScene(scene) : DEFAULT_DRAFT);
  const [saving, setSaving] = useState(false);
  const genreTiles = tilesForGenre(draft.genre);

  const canSave = draft.name.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      if (isEdit && scene) {
        const updated = await updateMap(ownerId, scene._id, {
          name: draft.name,
          description: draft.description,
          genre: draft.genre,
          width: draft.width,
          height: draft.height,
          background: draft.background,
        });
        toast.success("Detalles del mapa actualizados");
        onCreated(updated ?? scene);
      } else {
        const created = await createMap(ownerId, {
          name: draft.name,
          description: draft.description,
          genre: draft.genre,
          width: draft.width,
          height: draft.height,
          background: draft.background,
        });
        toast.success("Escena creada — ¡a diseñarla!");
        onCreated(created);
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "No se pudieron guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-5 py-3">
        <span className="text-sm font-semibold text-foreground">
          {isEdit ? "Detalles del mapa" : "Nueva escena"}
        </span>
        <div className="flex items-center gap-2">
          {saving ? (
            <span className="flex h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSave}
              className="flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
            >
              <Check className="h-3.5 w-3.5" />
              {isEdit ? "Guardar" : "Crear"}
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
            Nombre de la escena
          </label>
          <Input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            maxLength={60}
            placeholder="Ej: Bosque de Asternal"
            className="h-10 rounded-xl border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Detalle */}
        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Detalle de la escena
          </label>
          <Textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value.slice(0, 300) }))}
            maxLength={300}
            rows={3}
            placeholder="¿Qué ocurre en esta escena?"
            className="min-h-[72px] rounded-xl border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground"
          />
          <p className="mt-1 text-right text-[11px] text-muted-foreground">{draft.description.length}/300</p>
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
                    : "border-border/40 bg-card hover:border-primary/30"
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
                  <p className="text-sm font-semibold text-foreground">{g.label}</p>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{g.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Tamaño del tablero */}
        <div className="mb-3">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
            <span className="w-16 text-center text-xs font-semibold tabular-nums text-foreground">
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
                    : "border-border/40 bg-card text-muted-foreground hover:border-primary/30"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fondo */}
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
                  draft.background === b.id ? "scale-110 border-primary" : "border-border hover:scale-105"
                }`}
                style={{ backgroundColor: b.id }}
                aria-label={b.label}
                title={b.label}
              />
            ))}
          </div>
        </div>

        {/* Piezas del género elegido */}
        <div className="mt-3 rounded-xl border border-border/40 bg-muted/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Piezas disponibles ({genreTiles.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {genreTiles.map((t) => (
              <span
                key={t.id}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium text-foreground"
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
// Diálogo de confirmación en pantalla (reemplaza window.confirm)
// ════════════════════════════════════════════════════════════════════
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/45 p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-xs overflow-hidden rounded-2xl border border-border/35 bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center px-5 pb-4 pt-6 text-center">
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
            }`}
          >
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h3 className="mt-3 text-[15px] font-bold text-foreground">{title}</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{message}</p>
        </div>
        <div className="flex gap-2 border-t border-border/40 p-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 flex-1 rounded-xl bg-muted text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-10 flex-1 rounded-xl text-xs font-semibold shadow-soft transition-colors ${
              destructive
                ? "bg-destructive text-destructive-foreground hover:brightness-110"
                : "bg-primary text-primary-foreground hover:brightness-110"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
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
    {
      label: "Copias de seguridad",
      value: String(backups.length),
      icon: <ArchiveRestore className="h-4 w-4" />,
    },
  ];

  return (
    <ModalShell onClose={onClose}>
      <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-5 py-3">
        <span className="text-sm font-semibold text-foreground">Estadísticas del proyecto</span>
        <CloseButton onClick={onClose} />
      </div>
      <div className="flex-1 overflow-y-auto p-4">          <div className="overflow-hidden rounded-2xl border border-border/35">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-border/30" : ""}`}
            >
              <span className="flex items-center gap-2.5 text-[13px] font-medium text-muted-foreground">
                <span className="text-primary">{r.icon}</span>
                {r.label}
              </span>
              <span className="text-sm font-bold tabular-nums text-foreground">{r.value}</span>
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
  requestConfirm,
  onChange,
  onClose,
}: {
  ownerId: string;
  backups: BackupView[];
  requestConfirm: (state: ConfirmState) => void;
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

  const handleRestore = (b: BackupView) => {
    requestConfirm({
      title: "¿Restaurar esta copia?",
      message: `Las escenas actuales del proyecto se reemplazarán por las de “${b.name}”.`,
      confirmLabel: "Restaurar",
      action: async () => {
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
      },
    });
  };

  const handleDelete = (b: BackupView) => {
    requestConfirm({
      title: "¿Eliminar esta copia?",
      message: `Se borrará la copia de seguridad “${b.name}”. Tu proyecto actual no se verá afectado.`,
      confirmLabel: "Eliminar",
      destructive: true,
      action: async () => {
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
      },
    });
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border/40 px-5 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Settings className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          Ajustes del proyecto
        </span>
        <CloseButton onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Sección: copias de seguridad (el campo y su botón viven dentro) */}
        <div className="rounded-2xl border border-border/35 bg-primary/5 p-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ArchiveRestore className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Copias de seguridad</p>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Guarda el estado del proyecto y restáuralo cuando lo necesites.
              </p>
            </div>
          </div>

          {/* Crear copia */}
          <div className="mt-3 flex gap-2">
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Nombre (opcional)"
              className="h-10 min-w-0 flex-1 rounded-xl border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground"
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
                <ArchiveRestore className="h-3.5 w-3.5" />
              )}
              Crear copia
            </button>
          </div>
        </div>

        {/* Lista organizada de copias */}
        <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Copias guardadas ({backups.length})
        </p>

        {backups.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border py-8 text-center">
            <ArchiveRestore className="h-7 w-7 text-muted-foreground/50" />
            <p className="mt-2 text-[13px] font-medium text-foreground">Sin copias todavía</p>
            <p className="mt-1 max-w-[220px] text-[11px] text-muted-foreground">
              Crea la primera copia de seguridad para proteger tu proyecto.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {backups.map((b) => (
              <li key={b._id} className="rounded-2xl border border-border/35 bg-card p-3 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">{b.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
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
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(b)}
                      disabled={busy === b._id}
                      aria-label="Eliminar copia"
                      title="Eliminar"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
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
      const sceneList = scenes
        .map((s) => `• ${s.name} (${s.genre === "rpg" ? "RPG" : "Plataformas"})`)
        .join("\n");
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
      <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-5 py-3">
        <span className="text-sm font-semibold text-foreground">Publicar proyecto</span>
        <CloseButton onClick={onClose} />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Título
        </label>
        <Input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          className="mb-3 h-10 rounded-xl border-border/40 bg-background text-sm text-foreground"
        />
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Descripción
        </label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="Cuéntale a la comunidad de qué va tu juego…"
          className="min-h-[80px] rounded-xl border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground"
        />
        <p className="mt-1 text-right text-[11px] text-muted-foreground">{description.length}/500</p>

        <div className="mt-3 rounded-xl border border-border/40 bg-muted/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Se incluirán {scenes.length} {scenes.length === 1 ? "escena" : "escenas"}
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {scenes.slice(0, 5).map((s) => (
              <li key={s._id} className="truncate text-[12px] text-muted-foreground">
                • {s.name}
              </li>
            ))}
            {scenes.length > 5 && (
              <li className="text-[12px] text-muted-foreground/70">y {scenes.length - 5} más…</li>
            )}
          </ul>
        </div>
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-border/40 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-xl bg-muted px-4 text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
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
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4"
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
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
