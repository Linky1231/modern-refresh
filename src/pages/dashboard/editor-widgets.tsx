// ═══════════════════════════════════════════════════════════════════
// Widgets del editor: lightbox, diálogos, medios y barra de formato
// (extraído de Dashboard.tsx sin cambios de comportamiento).
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Bold,
  Film,
  ImagePlus,
  Italic,
  Palette,
  Paperclip,
  Play,
  Trash2,
  Underline,
  Vote,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  applyStyleToSelection,
  removeStyleFromSelection,
  selectionHasStyle,
  TEXT_COLORS,
  useVideoObjectUrl,
  useVideoThumbnail,
  type LightboxItem,
} from "./shared";

// ── Lightbox ───────────────────────────────────────────────────────
function LightboxVideo({
  url,
  mime,
}: {
  url: string;
  mime?: string;
}) {
  const objUrl = useVideoObjectUrl(url, mime || "video/mp4");
  if (!objUrl) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-lg bg-black/50">
        <span className="text-sm text-white/60">Cargando vídeo…</span>
      </div>
    );
  }
  return (
    <video
      key={objUrl}
      src={objUrl}
      controls
      autoPlay
      playsInline
      className="max-h-[88vh] max-w-[90vw] rounded-lg object-contain"
    />
  );
}

export function Lightbox({
  items,
  initialIndex,
  onClose,
}: {
  items: LightboxItem[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const current = items[index];

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < items.length - 1)
        setIndex((i) => i + 1);
      if (e.key === "ArrowLeft" && index > 0) setIndex((i) => i - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, items.length, onClose]);

  const hasNav = items.length > 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-[110] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        aria-label="Cerrar"
      >
        <X className="h-5 w-5" />
      </button>
      {hasNav && (
        <div className="absolute top-4 left-1/2 z-[110] -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {index + 1} / {items.length}
        </div>
      )}
      {hasNav && index > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => i - 1);
          }}
          className="absolute left-3 top-1/2 z-[110] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          aria-label="Anterior"
        >
          ‹
        </button>
      )}
      {hasNav && index < items.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => i + 1);
          }}
          className="absolute right-3 top-1/2 z-[110] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          aria-label="Siguiente"
        >
          ›
        </button>
      )}
      <div
        className="flex max-h-[90vh] max-w-[90vw] items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <AnimatePresence mode="wait" initial={false}>
          {current.type === "video" ? (
            <motion.div
              key={`video-${index}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            >
              <LightboxVideo url={current.url} mime={current.mime} />
            </motion.div>
          ) : (
            <img
              key={`img-${index}`}
              src={current.url}
              alt="Tamaño completo"
              className="max-h-[88vh] max-w-[90vw] rounded-lg object-contain"
              style={{ opacity: 1 }}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Delete confirmation ────────────────────────────────────────────
export function DeleteConfirmDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="mx-4 w-full max-w-sm rounded-2xl border border-border/35 bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Eliminar publicación</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  ¿Estás seguro de que quieres eliminar esta publicación? Esta
                  acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onConfirm}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Feed video thumbnail ───────────────────────────────────────────
/** Check if media dimensions are non-optimal for feed display. */
function isNonOptimalAspect(w: number, h: number): boolean {
  if (w === 0 || h === 0) return false;
  const ratio = h / w;
  // Very tall (>2:1) or very wide (>3:1)
  return ratio > 2 || ratio < 0.33;
}

/** Badge shown when media has non-optimal dimensions. */
function DimensionBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm"
    >
      <AlertTriangle className="h-3 w-3" />
      <span>Toca para ver completo</span>
    </motion.div>
  );
}

function FeedVideo({
  item,
  onClick,
}: {
  item: LightboxItem;
  onClick: () => void;
}) {
  const [videoError, setVideoError] = useState(false);
  const [aspectWarning, setAspectWarning] = useState(false);
  const objUrl = useVideoObjectUrl(item.url, item.mime || "video/mp4");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className="group relative block w-full cursor-pointer bg-muted outline-none overflow-hidden"
    >
      {!videoError && objUrl ? (
        <video
          preload="auto"
          muted
          playsInline
          className="mx-auto block max-h-80 w-full object-contain"
          onError={() => setVideoError(true)}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (isNonOptimalAspect(v.videoWidth, v.videoHeight)) {
              setAspectWarning(true);
            }
            // Try to seek to first frame so it paints
            try {
              v.currentTime = 0.1;
            } catch {}
          }}
          src={objUrl}
        />
      ) : !objUrl ? (
        <div className="flex h-28 w-full items-center justify-center bg-muted">
          <div className="flex flex-col items-center gap-2">
            <Film className="h-6 w-6 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground">Cargando vídeo…</span>
          </div>
        </div>
      ) : (
        <div className="flex h-28 w-full items-center justify-center bg-muted">
          <Film className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}
      {/* Play button - show when video data is ready OR always as fallback */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/20">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white shadow-lg transition-transform group-hover:scale-105">
          <Play className="ml-0.5 h-5 w-5" />
        </div>
      </div>
      {aspectWarning && <DimensionBadge />}
    </div>
  );
}

// ── Single media item ──────────────────────────────────────────────
function SingleMedia({
  item,
  index,
  onOpenLightbox,
}: {
  item: LightboxItem;
  index: number;
  onOpenLightbox: (i: number) => void;
}) {
  if (item.type === "video") {
    return <FeedVideo item={item} onClick={() => onOpenLightbox(index)} />;
  }
  return (
    <ImageWithDetection item={item} index={index} onOpenLightbox={onOpenLightbox} />
  );
}

function ImageWithDetection({
  item,
  index,
  onOpenLightbox,
}: {
  item: LightboxItem;
  index: number;
  onOpenLightbox: (i: number) => void;
}) {
  const [aspectWarning, setAspectWarning] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenLightbox(index)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpenLightbox(index);
      }}
      className="relative block w-full cursor-pointer bg-muted outline-none"
    >
      <img
        src={item.url}
        alt={`Imagen ${index + 1}`}
        loading="lazy"
        className="mx-auto block max-h-80 w-full object-contain transition-opacity duration-300"
        onLoad={(e) => {
          const img = e.currentTarget;
          if (isNonOptimalAspect(img.naturalWidth, img.naturalHeight)) {
            setAspectWarning(true);
          }
        }}
      />
      {aspectWarning && <DimensionBadge />}
    </div>
  );
}

// ── Media grid ─────────────────────────────────────────────────────
export function MediaGrid({
  media,
  onOpenLightbox,
}: {
  media: LightboxItem[];
  onOpenLightbox: (index: number) => void;
}) {
  if (!media || media.length === 0) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border/24">
      {media.length === 1 ? (
        <SingleMedia item={media[0]} index={0} onOpenLightbox={onOpenLightbox} />
      ) : (
        <div className="grid grid-cols-2 gap-px bg-border/30">
          {media.map((m, i) => (
            <SingleMedia key={i} item={m} index={i} onOpenLightbox={onOpenLightbox} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Format Toolbar (docked to the foot of the editor box) ──────────
interface FormatToolbarProps {
  onAddMedia?: () => void;
  onAddDoc?: () => void;
  onTogglePoll?: () => void;
  pollActive?: boolean;
  mediaDisabled?: boolean;
  docDisabled?: boolean;
}

export function FormatToolbar({
  onAddMedia,
  onAddDoc,
  onTogglePoll,
  pollActive = false,
  mediaDisabled,
  docDisabled,
}: FormatToolbarProps) {
  const [showColors, setShowColors] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRange = useRef<Range | null>(null);

  const hasSelection = () => {
    const sel = window.getSelection();
    return sel && sel.rangeCount > 0 && !sel.isCollapsed;
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (savedRange.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRange.current);
      }
    }
  };

  const showHint = (msg: string) => {
    // Mensaje informativo bajo la barra: recuerda que primero hay que
    // seleccionar el texto para poder aplicar el formato.
    setHint(msg);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 2500);
  };

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, []);

  /** Aviso común a las herramientas que necesitan una selección previa. */
  const SELECTION_HINT = "Selecciona primero el texto que quieres editar.";

  const toolBtnBase =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white hover:text-primary disabled:pointer-events-none disabled:opacity-35 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-primary";
  const toolBtnActive =
    "bg-white text-primary shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-600";
  const groupDivider =
    "mx-1.5 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700";

  return (
    <div className="w-full">
      {/* Toolbar del pie del editor, agrupada: adjuntos │ encuesta │ formato */}
      <div className="mt-3 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-1.5 py-1 dark:border-slate-700 dark:bg-slate-800/60">
        {/* Grupo 1 · Adjuntos */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Añadir imagen"
            aria-label="Añadir imagen"
            onClick={onAddMedia}
            disabled={mediaDisabled}
            className={toolBtnBase}
          >
            <ImagePlus className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            title="Añadir documento"
            aria-label="Añadir documento"
            onClick={onAddDoc}
            disabled={docDisabled}
            className={toolBtnBase}
          >
            <Paperclip className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
        </div>

        <span className={groupDivider} />

        {/* Grupo 2 · Encuesta (icono de voto, no de estadísticas) */}
        <button
          type="button"
          title="Crear una encuesta"
          aria-label="Crear una encuesta"
          aria-pressed={pollActive}
          onClick={onTogglePoll}
          className={`${toolBtnBase} ${pollActive ? toolBtnActive : ""}`}
        >
          <Vote className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>

        {/* Grupo 3 · Formato del texto seleccionado */}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            title="Color del texto"
            aria-label="Color del texto"
            className={`${toolBtnBase} ${showColors ? toolBtnActive : ""}`}
            onClick={() => {
              if (showColors) {
                setShowColors(false);
                return;
              }
              if (!hasSelection()) {
                showHint(SELECTION_HINT);
                return;
              }
              saveSelection();
              setShowColors(true);
            }}
          >
            <Palette className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            title="Negrita"
            aria-label="Negrita"
            className={`${toolBtnBase} ${selectionHasStyle("fontWeight", "bold") ? toolBtnActive : ""}`}
            onClick={() => {
              if (!hasSelection()) {
                showHint(SELECTION_HINT);
                return;
              }
              document.execCommand("bold");
            }}
          >
            <Bold className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            title="Cursiva"
            aria-label="Cursiva"
            className={`${toolBtnBase} ${selectionHasStyle("fontStyle", "italic") ? toolBtnActive : ""}`}
            onClick={() => {
              if (!hasSelection()) {
                showHint(SELECTION_HINT);
                return;
              }
              document.execCommand("italic");
            }}
          >
            <Italic className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            title="Subrayado"
            aria-label="Subrayado"
            className={`${toolBtnBase} ${selectionHasStyle("textDecoration", "underline") ? toolBtnActive : ""}`}
            onClick={() => {
              if (!hasSelection()) {
                showHint(SELECTION_HINT);
                return;
              }
              document.execCommand("underline");
            }}
          >
            <Underline className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Hint below toolbar: la altura está reservada para que el mensaje
          nunca empuje el contenido (sin saltos de layout). */}
      <div className="mt-1 h-5">
        <AnimatePresence>
          {hint && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="max-w-full truncate text-[11px] italic text-slate-500 dark:text-slate-400"
            >
              {hint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Color panel */}
      <AnimatePresence>
        {showColors && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/60">
              <span className="text-[10px] font-medium tracking-wider text-slate-500 uppercase">
                Color
              </span>
              <div className="flex flex-wrap gap-1.5">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.value || "default"}
                    type="button"
                    title={c.label}
                    className="h-6 w-6 rounded-full border border-slate-300 transition-transform hover:scale-110"
                    style={{ backgroundColor: c.value || "var(--card-foreground)" }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      restoreSelection();
                      if (selectionHasStyle("color", c.value)) {
                        removeStyleFromSelection("color");
                      } else if (c.value) {
                        applyStyleToSelection("color", c.value);
                      } else {
                        removeStyleFromSelection("color");
                      }
                      setShowColors(false);
                    }}
                  />
                ))}
              </div>
              <input
                type="color"
                className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                onChange={(e) => {
                  restoreSelection();
                  applyStyleToSelection("color", e.target.value);
                  setShowColors(false);
                }}
              />
              <button
                type="button"
                className="ml-auto flex h-5 w-5 items-center justify-center rounded text-xs text-slate-500 hover:text-slate-800"
                onClick={() => setShowColors(false)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Reusable remove button (attachment close icon) ─────────────
export function RemoveButton({
  onClick,
  label,
  className = "",
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={
        "absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 shadow-sm transition-colors hover:bg-slate-200 hover:text-slate-700 " +
        className
      }
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

// ── Video thumbnail component for previews ──────────────────────
export function VideoThumb({ src, alt }: { src: string; alt?: string }) {
  const thumb = useVideoThumbnail(src);
  return (
    <div className="relative h-28 w-full bg-muted overflow-hidden rounded-xl">
      {thumb ? (
        <>
          <img src={thumb} alt={alt ?? ""} className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors hover:bg-black/20">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/90 shadow-md">
              <Play className="ml-0.5 h-3.5 w-3.5" />
            </div>
          </div>
        </>
      ) : (
        <video
          src={src}
          preload="metadata"
          muted
          playsInline
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
