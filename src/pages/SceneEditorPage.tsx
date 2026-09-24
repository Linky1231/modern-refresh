// ▶ Editor de Escenas — apartado PRINCIPAL del editor de juegos (Asternal)
// Sigue el wireframe del motor: barra superior (volver · estadísticas · ajustes),
// fila "+ Crear Escena" con el icono de copia de seguridad (la abre),
// tablero punteado con las escenas del proyecto y un botón Publicar dentro.
// El SISTEMA DE COPIAS DE SEGURIDAD (crear, restaurar y eliminar) vive en el
// icono de capas; Ajustes solo muestra información del proyecto.
// Interacciones del tablero:
//   · Tocar la escena (cuerpo)  -> abre el PIZARRÓN para editar el proyecto.
//   · Lápiz                     -> configura los detalles del mapa (nombre,
//                                  tipo de juego y tamaño cuadrado).
//   · Papelera                  -> borra la escena (con confirmación en pantalla).
// Todo se guarda en el dispositivo (localStorage vía @/lib/db).
import { useState, useRef, useCallback, useEffect, useMemo, memo, type ChangeEvent } from "react";
import {
  getMaps,
  createMap,
  updateMap,
  deleteMap,
  getBackups,
  createBackup,
  importBackup,
  deleteBackup,
  restoreBackup,
  createPost,
  getProject,
  saveProject,
  MAP_SIDE_DEFAULT,
  MAP_SIDE_MIN,
  PROJECT_TITLE_DEFAULT,
  PROJECT_TITLE_MAX,
  PROJECT_DESCRIPTION_MAX,
  type MapView,
  type MapGenre,
  type BackupView,
  type ProjectView,
} from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Plus,
  Layers,
  Hand,
  BarChart3,
  Settings,
  Upload,
  Trash2,
  RotateCcw,
  Pencil,
  Check,
  Swords,
  Gamepad2,
  DatabaseBackup,
  Download,
  AlertTriangle,
  Locate,
  ImagePlus,
  Palette,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { usePan } from "@/hooks/use-pan";
import LevelEditor from "./editor/LevelEditor";

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
interface SceneDraft {
  name: string;
  genre: MapGenre;
  /** Lado del tablero: los mapas son CUADRADOS (ancho === alto). */
  side: number;
  /**
   * Detalle y color del mapa: ya no se editan en este modal, pero se conservan
   * para no perder lo que tuvieran las escenas anteriores al guardarlas.
   */
  description: string;
  background: string;
}

const DEFAULT_DRAFT: SceneDraft = {
  name: "",
  description: "",
  genre: "rpg",
  side: MAP_SIDE_DEFAULT,
  background: "#f8fafc",
};

function draftFromScene(scene: MapView): SceneDraft {
  return {
    name: scene.name,
    description: scene.description,
    genre: scene.genre,
    // Los mapas antiguos rectangulares se leen por su lado mayor.
    side: Math.max(scene.width, scene.height),
    background: scene.background,
  };
}

/** Tamaños cuadrados listos para usar. */
const SIZE_PRESETS = [
  { label: "Pequeño", side: 16 },
  { label: "Mediano", side: MAP_SIDE_DEFAULT },
  { label: "Grande", side: 40 },
];

/**
 * Tope del control deslizante. El motor admite más, pero un tablero enorme
 * (60×60 = 3600 casillas) hace lento el editor de niveles.
 */
const SIZE_SLIDER_MAX = 48;

// ── Icono del juego (galería de la app + imágenes del dispositivo) ──
/** Galería de iconos listos para usar: se guardan como emoji. */
const PROJECT_ICON_GALLERY = ["🗺️", "⚔️", "🏰", "🐉", "🌋", "🚀", "🌲", "⭐"];

/** Un icono es una imagen si se guardó como data URL. */
function isImageIcon(icon: string | null): icon is string {
  return !!icon && icon.startsWith("data:");
}

/**
 * Convierte la imagen elegida en el dispositivo en un icono pequeño (máximo
 * 192 px). Así el juego se identifica con la imagen que quieras sin llenar el
 * almacenamiento del dispositivo.
 */
async function imageFileToIcon(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("La imagen no se pudo abrir"));
    el.src = dataUrl;
  });
  const max = 192;
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, width, height);
  // WebP pesa mucho menos; si el navegador no lo sabe exportar, se usa PNG.
  const webp = canvas.toDataURL("image/webp", 0.9);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("es", { day: "numeric", month: "short" });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Las copias muestran fecha Y hora: pueden crearse varias el mismo día. */
function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString("es", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  backgroundColor: "var(--card)",
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
  // Ficha del juego: título, descripción e icono (se editan en Ajustes).
  const [project, setProject] = useState<ProjectView>({
    title: "",
    description: "",
    icon: null,
    updatedAt: 0,
  });
  const [editingScene, setEditingScene] = useState<MapView | null>(null);
  const [detailsScene, setDetailsScene] = useState<MapView | null>(null);
  const [creating, setCreating] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBackups, setShowBackups] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  // El tablero de escenas se puede arrastrar a cualquier posición, pero nunca
  // tanto como para perder las escenas de vista: siempre queda un trozo del
  // tablero dentro, así que los mapas no pueden «desaparecer».
  const [boardEl, setBoardEl] = useState<HTMLDivElement | null>(null);
  const planeEl = useRef<HTMLDivElement | null>(null);
  const boardLimits = useCallback(() => {
    const view = boardEl;
    const content = planeEl.current;
    if (!view || !content) return null;
    const keep = 120;
    const vw = view.clientWidth;
    const vh = view.clientHeight;
    const cw = content.offsetWidth;
    const ch = content.offsetHeight;
    return {
      minX: Math.min(0, keep - cw),
      maxX: Math.max(0, vw - keep),
      minY: Math.min(0, keep - ch),
      maxY: Math.max(0, vh - keep),
    };
  }, [boardEl]);
  const board = usePan({ element: boardEl, enabled: true, limits: boardLimits });
  const ownerLabel = user?.name || user?.username || user?.email || "Usuario";

  const refresh = useCallback(async () => {
    if (!ownerId) return;
    try {
      const [sceneData, backupData, projectData] = await Promise.all([
        getMaps(ownerId),
        getBackups(ownerId),
        getProject(ownerId),
      ]);
      setScenes(sceneData);
      setBackups(backupData);
      setProject(projectData);
    } catch (e) {
      // Si la lectura falla no se vacía la lista: las escenas que ya están en
      // pantalla se quedan y el usuario recibe un aviso.
      console.error("Error cargando el proyecto:", e);
      setScenes((prev) => prev ?? []);
      toast.error("No se pudo leer el proyecto guardado en el dispositivo");
    }
  }, [ownerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ── Acciones del tablero ───────────────────────────────────────
  // Son estables a propósito: al mover el tablero solo cambia su posición y
  // las tarjetas no necesitan volver a dibujarse (esto quita el retraso).
  const openScene = useCallback((scene: MapView) => setEditingScene(scene), []);
  const configureScene = useCallback((scene: MapView) => setDetailsScene(scene), []);

  const requestDeleteScene = useCallback(
    (scene: MapView) => {
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
    },
    [ownerId, refresh],
  );

  const closeStats = useCallback(() => setShowStats(false), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);
  const closeBackups = useCallback(() => setShowBackups(false), []);
  const closeCreating = useCallback(() => setCreating(false), []);
  const closeDetails = useCallback(() => setDetailsScene(null), []);
  const closePublishing = useCallback(() => setPublishing(false), []);
  const handleBackupsChange = useCallback(() => void refresh(), [refresh]);

  // Misma referencia mientras no cambien las escenas: los paneles no se
  // vuelven a dibujar por un array nuevo en cada render.
  const list = useMemo(() => scenes ?? [], [scenes]);
  const projectTitle = project.title.trim() || PROJECT_TITLE_DEFAULT;
  const handleProjectSaved = useCallback((saved: ProjectView) => setProject(saved), []);

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
              owner={ownerLabel}
              scenes={scenes ?? []}
              project={project}
              onSaved={handleProjectSaved}
              onClose={closeSettings}
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
          {project.icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-muted text-lg leading-none">
              {isImageIcon(project.icon) ? (
                <img src={project.icon} alt="" className="h-full w-full object-cover" />
              ) : (
                project.icon
              )}
            </span>
          )}
          <div className="min-w-0 flex-1 pl-1">
            <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
              {projectTitle}
            </p>
            <p className="truncate text-[10px] font-medium text-muted-foreground">
              Editor de escenas · {list.length} {list.length === 1 ? "escena" : "escenas"}
            </p>
          </div>
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
            aria-label="Ajustes del proyecto"
            title="Ajustes"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* ── Crear escena ── */}
        <div className="mt-3 flex shrink-0 items-center gap-2 rounded-2xl border border-border/35 bg-card p-1.5 shadow-soft">
          {/* El icono de capas ES la entrada a las copias de seguridad. */}
          <button
            type="button"
            onClick={() => setShowBackups(true)}
            aria-label="Copia de seguridad"
            title="Copia de seguridad"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors hover:bg-primary/20 active:scale-[0.97]"
          >
            <DatabaseBackup className="h-5 w-5" />
            {backups.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold tabular-nums text-primary-foreground">
                {backups.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Crear Escena
          </button>
        </div>

        {/* ── Tablero de escenas — ocupa todo el alto disponible y se arrastra ── */}
        <div
          ref={setBoardEl}
          className="relative mt-3 mb-4 min-h-[240px] flex-1 select-none overflow-hidden rounded-2xl border border-border/50 shadow-soft"
          style={{ ...BOARD_DOTS, ...board.interaction }}
          {...board.viewportProps}
        >
          {/* El tablero vive en su propio plano: se puede mover a cualquier posición. */}
          <div
            ref={planeEl}
            className="absolute left-0 top-0 w-full px-6 pb-20 pt-4"
            style={{
              transform: `translate(${board.offset.x}px, ${board.offset.y}px)`,
              willChange: "transform",
              contain: "layout paint",
            }}
          >
            <SceneBoard
              scenes={scenes}
              onOpen={openScene}
              onConfigure={configureScene}
              onDelete={requestDeleteScene}
            />
          </div>

          {/* ── Pista de arrastre + recentrar el tablero ── */}
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-2">
            <span className="hidden rounded-xl border border-border/40 bg-card px-3 py-2 text-[11px] font-medium text-muted-foreground shadow-soft sm:inline-flex">
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
            onClose={closeCreating}
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
            onClose={closeDetails}
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
          <StatsSheet scenes={list} backups={backups} onClose={closeStats} />
        )}
      </AnimatePresence>

      {/* Panel de ajustes del proyecto */}
      <AnimatePresence>
        {showSettings && (
          <SettingsSheet
            ownerId={ownerId}
            owner={ownerLabel}
            scenes={list}
            project={project}
            onSaved={handleProjectSaved}
            onClose={closeSettings}
          />
        )}
      </AnimatePresence>

      {/* Copias de seguridad (se abren desde el icono de capas) */}
      <AnimatePresence>
        {showBackups && (
          <BackupsSheet
            ownerId={ownerId}
            backups={backups}
            requestConfirm={setConfirmState}
            onChange={handleBackupsChange}
            onClose={closeBackups}
          />
        )}
      </AnimatePresence>

      {/* Modal de publicación */}
      <AnimatePresence>
        {publishing && (
          <PublishModal
            ownerId={ownerId}
            scenes={list}
            onClose={closePublishing}
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
// Tablero de escenas
//
// Está memorizado: al arrastrar el tablero solo cambia su posición, así que
// las tarjetas no se vuelven a dibujar (esto es lo que quita el retraso).
// ════════════════════════════════════════════════════════════════════
const SceneBoard = memo(function SceneBoard({
  scenes,
  onOpen,
  onConfigure,
  onDelete,
}: {
  scenes: MapView[] | undefined;
  onOpen: (scene: MapView) => void;
  onConfigure: (scene: MapView) => void;
  onDelete: (scene: MapView) => void;
}) {
  if (scenes === undefined) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Layers className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-semibold text-foreground">Todavía no hay escenas</p>
        <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-muted-foreground">
          Pulsa “Crear Escena” para añadir tu primera escena al tablero.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 content-start gap-3">
      {scenes.map((scene) => (
        <SceneCard
          key={scene._id}
          scene={scene}
          onOpen={onOpen}
          onConfigure={onConfigure}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
});

// ════════════════════════════════════════════════════════════════════
// Tarjeta de escena (tablero) — muestra nombre, descripción, color y medidas
// ════════════════════════════════════════════════════════════════════
const SceneCard = memo(function SceneCard({
  scene,
  onOpen,
  onConfigure,
  onDelete,
}: {
  scene: MapView;
  onOpen: (scene: MapView) => void;
  onConfigure: (scene: MapView) => void;
  onDelete: (scene: MapView) => void;
}) {
  const painted = Object.keys(scene.tiles ?? {}).length;
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/35 bg-card shadow-soft transition-shadow hover:shadow-lift">
      {/* Cuerpo: abre el pizarrón para editar el proyecto de la escena */}
      <button
        type="button"
        onClick={() => onOpen(scene)}
        title={scene.description ? `${scene.name} — ${scene.description}` : scene.name}
        className="block w-full text-left"
      >
        <div
          className="relative flex h-24 items-center justify-center border-b border-border/40"
          style={{ backgroundColor: scene.background }}
        >
          {scene.genre === "rpg" ? (
            <Swords className="h-6 w-6 text-primary/70" />
          ) : (
            <Gamepad2 className="h-6 w-6 text-primary/70" />
          )}
          <span className="absolute left-2 top-2 rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-primary">
            {scene.genre === "rpg" ? "RPG" : "Plataformas"}
          </span>
        </div>
        <div className="px-2.5 py-2">
          <p className="truncate text-[13px] font-semibold text-foreground">{scene.name}</p>
          {/* Detalle de la escena (solo si la escena ya traía uno guardado). */}
          {scene.description ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
              {scene.description}
            </p>
          ) : null}
          <p className="mt-1 text-[10px] font-medium tabular-nums text-muted-foreground/80">
            {scene.width}×{scene.height} · {painted} piezas
          </p>
        </div>
      </button>

      {/* Acciones */}
      <div className="absolute right-1.5 top-1.5 flex gap-1">
        <button
          type="button"
          onClick={() => onConfigure(scene)}
          aria-label="Configurar detalles del mapa"
          title="Nombre, tipo de juego y tamaño"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-soft transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(scene)}
          aria-label="Borrar escena"
          title="Borrar escena"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-soft transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
});

// ════════════════════════════════════════════════════════════════════
// Modal: detalles del mapa (crear Y editar) — nombre, tipo de juego y tamaño
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
          width: draft.side,
          height: draft.side,
          background: draft.background,
        });
        toast.success("Detalles del mapa actualizados");
        onCreated(updated ?? scene);
      } else {
        const created = await createMap(ownerId, {
          name: draft.name,
          description: draft.description,
          genre: draft.genre,
          width: draft.side,
          height: draft.side,
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

        {/* Tamaño del tablero — siempre cuadrado (ancho = alto) */}
        <div className="mb-3">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tamaño del tablero (cuadrado)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={MAP_SIDE_MIN}
              max={SIZE_SLIDER_MAX}
              value={draft.side}
              onChange={(e) => setDraft((d) => ({ ...d, side: Number(e.target.value) }))}
              className="h-1.5 flex-1 accent-[var(--primary)]"
            />
            <span className="w-20 text-center text-xs font-semibold tabular-nums text-foreground">
              {draft.side}×{draft.side}
            </span>
          </div>
          <div className="mt-2 flex gap-2">
            {SIZE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, side: p.side }))}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                  draft.side === p.side
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border/40 bg-card text-muted-foreground hover:border-primary/30"
                }`}
              >
                {p.label} {p.side}×{p.side}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
            El tablero es cuadrado: {draft.side} casillas de ancho y {draft.side} de alto.
          </p>
          {isEdit && scene && draft.side < Math.max(scene.width, scene.height) && (
            <p className="mt-1.5 rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-2 text-[11px] leading-snug text-foreground">
              Vas a reducir el tablero: las piezas que queden fuera del cuadrado no se verán
              (se conservan por si vuelves a ampliarlo).
            </p>
          )}
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
      className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-md"
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
      icon: <DatabaseBackup className="h-4 w-4" />,
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
// Panel: copia de seguridad (crear · restaurar · eliminar)
// ════════════════════════════════════════════════════════════════════
function BackupsSheet({
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
  const fileRef = useRef<HTMLInputElement | null>(null);

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

  // Copia real en archivo: el snapshot se descarga al dispositivo del usuario.
  const handleDownload = (b: BackupView) => {
    let scenes: unknown = [];
    try {
      scenes = JSON.parse(b.payload);
    } catch {
      toast.error("La copia está dañada");
      return;
    }
    const stamp = new Date(b.createdAt).toISOString().slice(0, 10);
    const slug =
      b.name
        .toLowerCase()
        .replace(/[^\wáéíóúñü-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "copia";
    const json = JSON.stringify(
      {
        app: "asternal",
        kind: "project-backup",
        version: 1,
        name: b.name,
        createdAt: new Date(b.createdAt).toISOString(),
        scenes,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `asternal-${slug}-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Copia descargada al dispositivo");
  };

  // Importa una copia descargada: queda en la lista lista para restaurar.
  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy("import");
    try {
      const created = await importBackup(
        ownerId,
        await file.text(),
        file.name.replace(/\.json$/i, ""),
      );
      toast.success(
        `Copia importada · ${created.sceneCount} ${created.sceneCount === 1 ? "escena" : "escenas"}. Pulsa «Restaurar» para aplicarla.`,
      );
      onChange();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "No se pudo importar la copia");
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
          <DatabaseBackup className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          Copia de seguridad
        </span>
        <CloseButton onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Sección: crear / importar copias */}
        <div className="rounded-2xl border border-border/35 bg-primary/5 p-3">
          <p className="text-[13px] font-semibold text-foreground">Guardar el estado actual</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Crea una copia, descárgala a tu dispositivo y restáurala cuando quieras.
          </p>

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
              disabled={busy !== null}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
            >
              {busy === "create" ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Crear copia
            </button>
          </div>

          {/* Importar una copia descargada (archivo JSON real) */}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={handleImport}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy !== null}
            className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-border/40 bg-card text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {busy === "import" ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Upload className="h-3.5 w-3.5 text-primary" />
            )}
            Importar desde un archivo
          </button>
        </div>

        {/* Lista organizada de copias */}
        <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Copias guardadas ({backups.length})
        </p>

        {backups.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border py-8 text-center">
            <DatabaseBackup className="h-7 w-7 text-muted-foreground/50" />
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
                      {formatDateTime(b.createdAt)} · {b.sceneCount}{" "}
                      {b.sceneCount === 1 ? "escena" : "escenas"} · {formatSize(b.sizeBytes)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => handleDownload(b)}
                      aria-label="Descargar copia"
                      title="Descargar"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestore(b)}
                      disabled={busy !== null}
                      aria-label="Restaurar copia"
                      title="Restaurar"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(b)}
                      disabled={busy !== null}
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
// Panel: ajustes del proyecto (sin copias de seguridad)
// ════════════════════════════════════════════════════════════════════
function SettingsSheet({
  ownerId,
  owner,
  scenes,
  project,
  onSaved,
  onClose,
}: {
  ownerId: string;
  owner: string;
  scenes: MapView[];
  project: ProjectView;
  onSaved: (project: ProjectView) => void;
  onClose: () => void;
}) {
  // El formulario arranca con lo guardado y solo se guarda al pulsar el botón.
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [icon, setIcon] = useState<string | null>(project.icon);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const lastEdit = scenes.reduce((max, s) => Math.max(max, s.updatedAt), 0);
  const bytes = new TextEncoder().encode(JSON.stringify(scenes)).length;
  const dirty =
    title !== project.title || description !== project.description || icon !== project.icon;

  const handlePickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Se limpia el campo para poder volver a elegir la misma imagen.
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Elige un archivo de imagen");
      return;
    }
    try {
      setIcon(await imageFileToIcon(file));
      setGalleryOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "No se pudo usar esa imagen");
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await saveProject(ownerId, { title, description, icon });
      setTitle(saved.title);
      setDescription(saved.description);
      setIcon(saved.icon);
      onSaved(saved);
      toast.success("Ficha del juego actualizada");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "No se pudieron guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    { label: "Propietario", value: owner },
    { label: "Escenas", value: String(scenes.length) },
    { label: "Última edición", value: lastEdit ? formatDate(lastEdit) : "—" },
    { label: "Datos en el dispositivo", value: formatSize(bytes) },
  ];

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
        {/* ── Ficha del juego: título, descripción e icono ── */}
        <div className="rounded-2xl border border-border/35 bg-card p-3 shadow-soft">
          <p className="text-[13px] font-semibold text-foreground">Mi juego</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            El nombre, la descripción y el icono con los que se presenta tu juego.
          </p>

          <label className="mb-1 mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Título del juego
          </label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={PROJECT_TITLE_MAX}
            placeholder={PROJECT_TITLE_DEFAULT}
            className="h-10 rounded-xl border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground"
          />

          <label className="mb-1 mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Descripción del juego
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, PROJECT_DESCRIPTION_MAX))}
            maxLength={PROJECT_DESCRIPTION_MAX}
            rows={3}
            placeholder="¿De qué va tu juego?"
            className="min-h-[72px] rounded-xl border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground"
          />
          <p className="mt-1 text-right text-[11px] text-muted-foreground">
            {description.length}/{PROJECT_DESCRIPTION_MAX}
          </p>

          <p className="mb-1.5 mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Icono del juego
          </p>
          <div className="flex items-center gap-3">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/40 bg-muted text-2xl leading-none">
              {isImageIcon(icon) ? (
                <img src={icon} alt="" className="h-full w-full object-cover" />
              ) : icon ? (
                icon
              ) : (
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setGalleryOpen((v) => !v)}
                className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[11px] font-semibold transition-colors ${
                  galleryOpen
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border/40 bg-muted text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                <Palette className="h-3.5 w-3.5" />
                Galería
              </button>
              <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-border/40 bg-muted px-3 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground">
                <Upload className="h-3.5 w-3.5" />
                Del dispositivo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePickFile}
                  className="sr-only"
                  aria-label="Elegir una imagen del dispositivo"
                />
              </label>
              {icon && (
                <button
                  type="button"
                  onClick={() => setIcon(null)}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-border/40 bg-muted px-3 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Quitar
                </button>
              )}
            </div>
          </div>

          {galleryOpen && (
            <div className="mt-2 rounded-2xl border border-border/35 bg-muted/40 p-2">
              <div className="flex flex-wrap gap-2">
                {PROJECT_ICON_GALLERY.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setIcon(g);
                      setGalleryOpen(false);
                    }}
                    aria-label={`Usar ${g} como icono`}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl border bg-card text-xl leading-none transition-transform hover:scale-105 ${
                      icon === g ? "border-primary ring-2 ring-primary/25" : "border-border/40"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 px-0.5 text-[10px] leading-snug text-muted-foreground">
                Elige uno de la galería o sube una imagen tuya con «Del dispositivo».
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
          >
            {saving ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {dirty ? "Guardar cambios" : "Todo guardado"}
          </button>
        </div>

        {/* ── Información del proyecto ── */}
        <div className="mt-3 rounded-2xl border border-border/35 bg-card p-3 shadow-soft">
          <p className="text-[13px] font-semibold text-foreground">Proyecto</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Los datos del proyecto se guardan en este dispositivo.
          </p>
          <dl className="mt-3 flex flex-col gap-2">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3">
                <dt className="text-[12px] text-muted-foreground">{r.label}</dt>
                <dd className="truncate text-[12px] font-semibold text-foreground">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Mover el tablero
        </p>
        <ul className="flex flex-col gap-2">
          <li className="flex items-center gap-2.5 rounded-2xl border border-border/35 bg-card p-3 shadow-soft">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Hand className="h-4 w-4" />
            </span>
            <p className="text-[12px] leading-snug text-muted-foreground">
              Arrastra una zona libre del tablero para desplazarlo en cualquier dirección.
            </p>
          </li>
          <li className="flex items-center gap-2.5 rounded-2xl border border-border/35 bg-card p-3 shadow-soft">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Locate className="h-4 w-4" />
            </span>
            <p className="text-[12px] leading-snug text-muted-foreground">
              Pulsa «Centrar» para devolver el tablero a su posición inicial.
            </p>
          </li>
        </ul>
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
