import { useState, useRef, useCallback, useEffect } from "react";
import ProfilePage from "./ProfilePage";
import { useAuth } from "@/hooks/use-auth";
import {
  getPosts,
  createPost as createPostFn,
  deletePost,
  deletePostAsAdmin,
  togglePostLike,
  togglePostFavorite,
  searchUsers,
  getComments,
  createComment,
  toggleCommentLike,
  deleteComment,
  toggleFollow,
  isFollowing,
  getFollowStats,
  getFollowers,
  getFollowing,
  getUserProfile,
  uploadFile,
  generateFilePath,
} from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Heart,
  Trash2,
  Send,
  LogOut,
  ImagePlus,
  X,
  Film,
  Play,
  AlertTriangle,
  Palette,
  MessageCircle,
  Reply,
  Search,
  Star,
  Share2,
  MoreHorizontal,
  UserX,
  FileText,
  Paperclip,
  Home,
  User,
  ArrowLeft,
  Newspaper,
  Heading,
} from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Constants ──────────────────────────────────────────────────────
const ACCEPTED_IMAGE =
  "image/jpeg,image/png,image/gif,image/webp,image/bmp,image/svg+xml";
const ACCEPTED_VIDEO =
  "video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,video/x-flv,video/3gpp,video/mpeg,video/ogg,video/*";
const ACCEPTED_DOC =
  "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/zip,application/x-rar-compressed,application/json";
const ACCEPTED_ALL = `${ACCEPTED_IMAGE},${ACCEPTED_VIDEO},${ACCEPTED_DOC}`;
const ACCEPTED_DOCS_ONLY = ACCEPTED_DOC;
const MAX_DOCS = 5;
const MAX_DOC_MB = 25;
const MAX_FILES = 10;
const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 50;

const TEXT_COLORS = [
  { label: "Predeterminado", value: "" },
  { label: "Negro", value: "#1a1a1a" },
  { label: "Gris oscuro", value: "#555555" },
  { label: "Gris", value: "#888888" },
  { label: "Rojo", value: "#dc2626" },
  { label: "Naranja", value: "#ea580c" },
  { label: "Amarillo", value: "#ca8a04" },
  { label: "Verde", value: "#16a34a" },
  { label: "Azul", value: "#2563eb" },
  { label: "Morado", value: "#9333ea" },
  { label: "Rosa", value: "#db2777" },
  { label: "Celeste", value: "#0891b2" },
];



// ── Interfaces ─────────────────────────────────────────────────────
interface PendingMedia {
  id: string;
  file: File;
  type: "image" | "video";
  preview: string;
}

interface UploadedMedia {
  storageId: string;
  type: "image" | "video";
  mime?: string;
}

interface LightboxItem {
  url: string;
  type: "image" | "video";
  mime?: string;
}

interface MentionUser {
  _id: string;
  name: string;
  image?: string;
}

interface PostMention {
  userId: string;
  name: string;
}

interface PendingDoc {
  id: string;
  file: File;
  name: string;
  size: number;
  extension: string;
}

interface UploadedDoc {
  storageId: string;
  name: string;
  size: number;
  mime?: string;
}

interface DocumentUrl {
  url: string;
  name: string;
  size: number;
  mime?: string;
}

/** Format large numbers in Spanish: 1200 -> 1,2 mil, 10000 -> 10 mil, etc. */
function formatCount(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10000) {
    const k = n / 1000;
    return k.toFixed(1).replace(".", ",") + " mil";
  }
  if (n < 1000000) {
    return Math.round(n / 1000) + " mil";
  }
  const m = n / 1000000;
  if (m < 10) return m.toFixed(1).replace(".", ",") + " M";
  return Math.round(m) + " M";
}

// ── Utilities ──────────────────────────────────────────────────────
function formatTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "ahora mismo";
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Strip non-allowed HTML, keeping only <span style="color;font-size"> and <br>. */
function sanitizePostHtml(html: string): string {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node instanceof HTMLElement) {
      if (node.tagName === "BR") return;
      if (node.tagName === "SPAN") {
        const color = node.style.color;
        const fontSize = node.style.fontSize;
        const isMention = node.classList.contains("mention") ||
          node.getAttribute("data-mention-user-id");
        node.removeAttribute("class");
        node.removeAttribute("id");
        node.removeAttribute("style");
        if (color) node.style.color = color;
        if (fontSize) node.style.fontSize = fontSize;
        if (isMention) {
          node.classList.add("mention");
          node.style.color = "var(--primary)";
          node.style.fontWeight = "600";
        }
        Array.from(node.childNodes).forEach(walk);
        return;
      }
      // Convert text nodes with hashtags to styled spans
      if (node.nodeType === Node.TEXT_NODE) return;
      const text = node.textContent || "";
      const t = document.createTextNode(text);
      node.parentNode?.replaceChild(t, node);
      return;
    }
  };
  Array.from(tmp.childNodes).forEach(walk);

  // Post-process: wrap #hashtags in styled spans
  const result = tmp.innerHTML;
  return result.replace(
    /(#[\w\u00C0-\u00FF\u0100-\u024F]+)/g,
    '<span class="hashtag">$1</span>'
  );
}

// ── Aspect ratio detection hook ───────────────────────────────────
/**
 * Detects if media has a problematic aspect ratio for feed display.
 * Returns { isProblematic, ratio } once dimensions are known.
 * Vertical photos (ratio < 0.55) or panoramic (ratio > 2.5) are flagged.
 */
function useAspectCheck(
  type: "image" | "video",
): { isProblematic: boolean; ratio: number | null; onDimensions: (w: number, h: number) => void } {
  const [ratio, setRatio] = useState<number | null>(null);
  const onDimensions = useCallback((w: number, h: number) => {
    if (w > 0 && h > 0) setRatio(w / h);
  }, []);
  const isProblematic = ratio !== null && (ratio < 0.55 || ratio > 2.5);
  return { isProblematic, ratio, onDimensions };
}

// ── Video blob URL hook ────────────────────────────────────────────
const videoBlobCache = new Map<string, string>();

function useVideoObjectUrl(url: string, mime: string) {
  const [objectUrl, setObjectUrl] = useState<string | null>(
    () => videoBlobCache.get(url) ?? null,
  );

  useEffect(() => {
    if (!url) return;
    if (videoBlobCache.has(url)) {
      setObjectUrl(videoBlobCache.get(url)!);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const typedBlob = new Blob([blob], { type: mime || "video/mp4" });
        const objUrl = URL.createObjectURL(typedBlob);
        videoBlobCache.set(url, objUrl);
        setObjectUrl(objUrl);
      })
      .catch((err) => {
        if (err.name !== "AbortError")
          console.error("Error cargando vídeo:", err);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url, mime]);

  return objectUrl;
}

// ── Video thumbnail hook ────────────────────────────────────────
function useVideoThumbnail(url: string): string | null {
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    let cancelled = false;
    const cleanup = () => {
      try { URL.revokeObjectURL(video.src); } catch {}
    };
    video.onloadeddata = () => {
      if (cancelled) return;
      try { video.currentTime = 0.5; } catch { cleanup(); }
    };
    video.onseeked = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          setThumb(canvas.toDataURL("image/jpeg", 0.7));
        }
      } catch {}
      cleanup();
    };
    video.onerror = () => { if (!cancelled) cleanup(); };
    video.src = url;
    return () => { cancelled = true; cleanup(); };
  }, [url]);
  return thumb;
}

// ── Selection formatting helper ────────────────────────────────────
/**
 * Remove a specific style from all spans in a document fragment,
 * unwrapping spans that become empty.
 */
function removeStyleFromFragment(fragment: DocumentFragment, prop: string) {
  const walk = (node: Node) => {
    if (node instanceof HTMLElement && node.tagName === "SPAN") {
      (node.style as any).removeProperty(prop);
      if (!node.getAttribute("style") || node.getAttribute("style") === "") {
        const parent = node.parentNode;
        while (node.firstChild) parent?.insertBefore(node.firstChild, node);
        parent?.removeChild(node);
      } else {
        Array.from(node.childNodes).forEach(walk);
      }
    }
  };
  Array.from(fragment.childNodes).forEach(walk);
}

/**
 * Remove a specific style from the selection in the live DOM,
 * unwrapping empty spans. Works by walking the DOM tree
 * within the selection range.
 */
function removeStyleFromSelection(prop: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0).cloneRange();
  const startC = range.startContainer;
  const startO = range.startOffset;
  const endC = range.endContainer;
  const endO = range.endOffset;
  const fragment = range.extractContents();
  removeStyleFromFragment(fragment, prop);
  range.insertNode(fragment);
  try {
    const nr = document.createRange();
    nr.setStart(startC, startO);
    nr.setEnd(endC, endO);
    sel.removeAllRanges();
    sel.addRange(nr);
  } catch {}
}

/**
 * Apply a style to the selection. Removes any existing value of that
 * property first (so only one value is active per property),
 * then wraps the selection in a new styled span.
 */
function applyStyleToSelection(prop: string, value: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0).cloneRange();
  const startC = range.startContainer;
  const startO = range.startOffset;
  const endC = range.endContainer;
  const endO = range.endOffset;
  const fragment = range.extractContents();
  removeStyleFromFragment(fragment, prop);
  const span = document.createElement("span");
  (span.style as any)[prop] = value;
  span.appendChild(fragment);
  range.insertNode(span);
  try {
    const nr = document.createRange();
    nr.setStart(startC, startO);
    nr.setEnd(endC, endO);
    sel.removeAllRanges();
    sel.addRange(nr);
  } catch {}
}

/**
 * Check if the current selection has a given style applied.
 * Uses native queryCommandState for bold/underline,
 * and computed style for custom properties (color, fontSize).
 */
function selectionHasStyle(prop: string, value: string): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  // Bold / underline: use native detection
  if (prop === "fontWeight") return document.queryCommandState("bold");
  if (prop === "textDecoration") return document.queryCommandState("underline");
  // For color / fontSize: check computed style at the anchor node
  const node = sel.getRangeAt(0).startContainer;
  const el = node instanceof HTMLElement ? node : node.parentElement;
  if (!el) return false;
  const computed = window.getComputedStyle(el);
  const actual = (computed as any)[prop];
  if (!actual) return false;
  // Normalize px values for fontSize comparison
  if (prop === "fontSize") {
    const target = parseFloat(value);
    const current = parseFloat(actual);
    return Math.abs(target - current) < 1;
  }
  return actual === value;
}

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

function Lightbox({
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
function DeleteConfirmDialog({
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
            className="mx-4 w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-xl"
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

// ── Unfollow confirmation dialog ────────────────────────────────────
function UnfollowConfirmDialog({
  open,
  userName,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  userName: string;
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
            className="mx-4 w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <UserX className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Dejar de seguir</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  ¿Dejar de seguir a <span className="font-medium text-foreground">{userName}</span>?
                  Sus publicaciones dejarán de aparecer en tu pestaña "Seguidos".
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
                Dejar de seguir
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
  const [videoReady, setVideoReady] = useState(false);
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
          onLoadedData={() => setVideoReady(true)}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (isNonOptimalAspect(v.videoWidth, v.videoHeight)) {
              setAspectWarning(true);
            }
            // Try to seek to first frame so it paints
            try { v.currentTime = 0.1; } catch {}
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
      {/* Play button — show when video data is ready OR always as fallback */}
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
    return (
      <FeedVideo item={item} onClick={() => onOpenLightbox(index)} />
    );
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
function MediaGrid({
  media,
  onOpenLightbox,
}: {
  media: LightboxItem[];
  onOpenLightbox: (index: number) => void;
}) {
  if (!media || media.length === 0) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border/40">
      {media.length === 1 ? (
        <SingleMedia
          item={media[0]}
          index={0}
          onOpenLightbox={onOpenLightbox}
        />
      ) : (
        <div className="grid grid-cols-2 gap-px bg-border/30">
          {media.map((m, i) => (
            <SingleMedia
              key={i}
              item={m}
              index={i}
              onOpenLightbox={onOpenLightbox}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Format Toolbar ─────────────────────────────────────────────────
function FormatToolbar() {
  const [showColors, setShowColors] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
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
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHint(msg);
    hintTimer.current = setTimeout(() => setHint(null), 2500);
  };



  return (
    <div className="w-full pt-3">
      {/* Toolbar buttons row */}
      <div className="inline-flex items-center gap-0.5 rounded-xl border border-border/50 bg-muted/40 p-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`gap-1.5 px-3 ${showColors ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-primary"}`}
          onClick={() => {
            if (showColors) { setShowColors(false); return; }
            if (!hasSelection()) { showHint("Selecciona texto primero"); return; }
            saveSelection();
            setShowColors(true);
          }}
          title="Color del texto"
        >
          <Palette className="h-4 w-4 shrink-0" />
          <span className="text-xs font-medium whitespace-nowrap">Color</span>
        </Button>



        {/* Bold */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`gap-1.5 px-3 ${selectionHasStyle("fontWeight", "bold") ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-primary"}`}
          onClick={() => {
            if (!hasSelection()) { showHint("Selecciona texto primero"); return; }
            document.execCommand("bold");
          }}
          title="Negrita"
        >
          <span className="text-sm font-extrabold leading-none">B</span>
        </Button>

        {/* Underline */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`gap-1.5 px-3 ${selectionHasStyle("textDecoration", "underline") ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-primary"}`}
          onClick={() => {
            if (!hasSelection()) { showHint("Selecciona texto primero"); return; }
            document.execCommand("underline");
          }}
          title="Subrayado"
        >
          <span className="text-sm font-medium underline leading-none">S</span>
        </Button>

        {/* Text size (H1 / H2 / H3 / Normal) */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`gap-1.5 px-3 ${showSizes ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-primary"}`}
          onClick={() => {
            if (showSizes) { setShowSizes(false); return; }
            if (hasSelection()) saveSelection();
            setShowSizes(true);
          }}
          title="Tamaño del texto"
        >
          <Heading className="h-4 w-4 shrink-0" />
          <span className="text-xs font-medium whitespace-nowrap">Tamaño</span>
        </Button>

      </div>

      {/* Hint below toolbar */}
      <AnimatePresence>
        {hint && (
          <motion.p
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.15 }}
            className="mt-2 max-w-full text-[11px] text-muted-foreground/60 italic break-words"
          >
            {hint}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Inline panels */}
      <AnimatePresence>
        {showColors && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-border/40 bg-muted/50 p-2.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Color</span>
              <div className="flex flex-wrap gap-1.5">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.value || "default"}
                    type="button"
                    title={c.label}
                    className="h-6 w-6 rounded-full border border-border/60 transition-transform hover:scale-110"
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
                onChange={(e) => { restoreSelection(); applyStyleToSelection("color", e.target.value); setShowColors(false); }}
              />
              <button type="button" className="ml-auto flex h-5 w-5 items-center justify-center rounded text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowColors(false)}><X className="h-3 w-3" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Text size panel */}
      <AnimatePresence>
        {showSizes && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-border/40 bg-muted/50 p-2.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tamaño</span>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { tag: "h1", label: "H1", cls: "text-base font-extrabold" },
                  { tag: "h2", label: "H2", cls: "text-[15px] font-bold" },
                  { tag: "h3", label: "H3", cls: "text-sm font-semibold" },
                  { tag: "p", label: "Normal", cls: "text-xs font-medium" },
                ] as const).map((s) => (
                  <button
                    key={s.tag}
                    type="button"
                    className="rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-card-foreground transition-colors hover:border-primary/40 hover:bg-accent"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      restoreSelection();
                      // Sin selección previa: enfocar el editor y aplicar al bloque actual
                      const sel = window.getSelection();
                      const editor = document.querySelector<HTMLElement>("[contenteditable]");
                      if ((!sel || sel.rangeCount === 0) && editor) {
                        editor.focus();
                      }
                      document.execCommand("formatBlock", false, s.tag === "p" ? "p" : s.tag);
                      setShowSizes(false);
                    }}
                  >
                    <span className={s.cls}>{s.label}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="ml-auto flex h-5 w-5 items-center justify-center rounded text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowSizes(false)}><X className="h-3 w-3" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// ── Video thumbnail component for previews ──────────────────────
function VideoThumb({ src, alt }: { src: string; alt?: string }) {
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

// ── Post Card ──────────────────────────────────────────────────────
function CommentItem({
  comment,
  currentUserId,
  onReply,
  postId,
  depth = 0,
}: {
  comment: {
    _id: string;
    authorId: string;
    content: string;
    createdAt: number;
    likes: number;
    likedByMe: boolean;
    authorName: string;
    parentCommentId?: string;
  };
  currentUserId?: string;
  onReply: (commentId: string, authorName: string) => void;
  postId: string;
  depth?: number;
}) {
  const pid = postId as any;
  const toggleCommentLikeHandler = async (commentId: string) => {
    // Will be passed as prop or use direct Supabase call
  };
  const removeCommentHandler = async (commentId: string) => {
    // Will be passed as prop or use direct Supabase call
  };
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [comments, setComments] = useState<any[]>([]);
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const data = await getComments(postId);
        setComments(data);
      } catch (error) {
        console.error("Error fetching comments:", error);
      }
    };
    fetchComments();
  }, [postId]);
  const replies = comments.filter((c) => c.parentCommentId === comment._id);
  const [showReplies, setShowReplies] = useState(replies.length <= 3);

  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-border/40 pl-4" : ""}>
      <div className="flex items-start gap-2.5 py-2.5">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-muted text-[10px] font-semibold">
            {getInitials(comment.authorName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">{comment.authorName}</span>
            <span className="text-[10px] text-muted-foreground">{formatTime(comment.createdAt)}</span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-card-foreground">{comment.content}</p>
          <div className="mt-1.5 flex items-center gap-3">
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              onClick={async () => { if (currentUserId) await toggleCommentLike(currentUserId, comment._id); }}
              className={`flex items-center gap-1 text-[10px] transition-colors ${
                comment.likedByMe ? "text-primary" : "text-muted-foreground hover:text-primary"
              }`}
            >
              <motion.span
                key={`${comment.likedByMe}-${comment._id}`}
                animate={comment.likedByMe ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <Heart className={`h-3 w-3 transition-colors duration-150 ${comment.likedByMe ? "fill-primary text-primary" : "fill-transparent"}`} />
              </motion.span>
              {comment.likes > 0 && <span className="tabular-nums">{comment.likes}</span>}
            </motion.button>
            <button
              type="button"
              onClick={() => onReply(comment._id, comment.authorName)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
            >
              <Reply className="h-3 w-3" /> Responder
            </button>
            {currentUserId === comment.authorId && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Replies */}
      {replies.length > 0 && (
        <motion.div
          initial={false}
          animate={{ height: "auto", opacity: 1 }}
          className="ml-4 mt-1 overflow-hidden rounded-xl border border-border/30 bg-muted/20 pl-3 pr-1 py-1 sm:ml-6"
        >
          {!showReplies && replies.length > 3 && (
            <button
              type="button"
              onClick={() => setShowReplies(true)}
              className="mb-1 pl-6 text-[10px] font-medium text-primary hover:underline"
            >
              Ver más ({replies.length} respuestas)
            </button>
          )}
          <AnimatePresence initial={false}>
            {(showReplies || replies.length <= 3) &&
              replies.map((reply) => (
                <motion.div
                  key={reply._id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                >
                  <CommentItem
                    comment={reply}
                    currentUserId={currentUserId}
                    onReply={onReply}
                    postId={postId}
                    depth={depth + 1}
                  />
                </motion.div>
              ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Delete confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 6 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="mx-4 w-full max-w-xs rounded-2xl border border-border/60 bg-card p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Eliminar comentario</h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    ¿Estás seguro de que quieres eliminar este comentario?
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    deleteComment(comment._id, currentUserId || "");
                    setConfirmDelete(false);
                  }}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3 w-3" /> Eliminar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PostCard({
  post,
  currentUserId,
  onToggleLike,
  onToggleFavorite,
  onFollow,
  onRequestUnfollow,
  onRequestDelete,
  onOpenLightbox,
  onOpenComments,
  onOpenProfile,
  isAdmin,
  postNumber,
}: {
  post: {
    _id: string;
    authorId: string;
    title?: string;
    content: string;
    createdAt: number;
    likes: number;
    likedByMe: boolean;
    favorites: number;
    favoritedByMe: boolean;
    authorName: string;
    mediaUrls: LightboxItem[];
    documentUrls: DocumentUrl[];
    hashtags: string[];
  };
  currentUserId?: string;
  onToggleLike: (postId: string) => void;
  onToggleFavorite: (postId: string) => void;
  onFollow: (userId: string) => void;
  onRequestUnfollow: (userId: string, name: string) => void;
  onRequestDelete: (postId: string) => void;
  isAdmin?: boolean;
  onOpenLightbox: (media: LightboxItem[], index: number) => void;
  onOpenComments: (post: { _id: string; authorId: string; title?: string; content: string; createdAt: number; authorName: string; mediaUrls: LightboxItem[]; postNumber: number }) => void;
  onOpenProfile: (userId: string) => void;
  postNumber?: number;
}) {
  const [comments, setComments] = useState<any[]>([]);
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const data = await getComments(post._id);
        setComments(data);
      } catch (error) {
        console.error("Error fetching comments:", error);
      }
    };
    fetchComments();
  }, [post._id]);
  const commentCount = comments.length;
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  useEffect(() => {
    const checkFollow = async () => {
      if (!currentUserId || !post.authorId || post.authorId === currentUserId) return;
      try {
        const data = await isFollowing(currentUserId, post.authorId);
        setIsFollowingUser(data);
      } catch (error) {
        console.error("Error checking follow status:", error);
      }
    };
    checkFollow();
  }, [currentUserId, post.authorId]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden rounded-2xl border border-border/60 bg-card transition-all duration-300 ease-out hover:border-border/80 hover:shadow-sm"
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-3.5">
          <button type="button" onClick={() => onOpenProfile(post.authorId)} className="shrink-0 cursor-pointer">
            <Avatar className="h-10 w-10 border border-border/50">
              {(post as any).authorImageUrl && (
                <AvatarImage src={(post as any).authorImageUrl} alt={post.authorName} className="object-cover" />
              )}
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {getInitials(post.authorName)}
              </AvatarFallback>
            </Avatar>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onOpenProfile(post.authorId)} className="text-sm font-semibold hover:underline cursor-pointer">{post.authorName}</button>
              <span className="text-xs text-muted-foreground">
                {formatTime(post.createdAt)}
              </span>
              {currentUserId && post.authorId !== currentUserId && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  onClick={() => isFollowingUser ? onRequestUnfollow(post.authorId, post.authorName) : onFollow(post.authorId)}
                  className={`ml-auto text-[11px] font-medium px-2.5 py-0.5 rounded-md border transition-colors ${
                    isFollowingUser
                      ? "border-border/60 text-muted-foreground hover:border-destructive/40 hover:text-destructive hover:bg-destructive/5"
                      : "border-primary/30 text-primary hover:bg-primary/5"
                  }`}
                >
                  {isFollowingUser ? "Siguiendo" : "Seguir"}
                </motion.button>
              )}
            </div>
            {post.title && (
              <h2 className="mt-2 text-base font-bold leading-snug text-card-foreground">
                {post.title}
              </h2>
            )}
            {post.content && (
              <div
                className="post-content mt-1 text-sm leading-relaxed text-card-foreground"
                dangerouslySetInnerHTML={{
                  __html: sanitizePostHtml(post.content),
                }}
              />
            )}
          </div>
        </div>
      </div>
      {post.mediaUrls.length > 0 && (
        <MediaGrid
          media={post.mediaUrls}
          onOpenLightbox={(i) => onOpenLightbox(post.mediaUrls, i)}
        />
      )}
      {/* Documents */}
      {post.documentUrls && post.documentUrls.length > 0 && (
        <div className="px-4 pb-3 pt-3 sm:px-5 sm:pt-4 border-t border-border/30">
          <div className="flex flex-col gap-2">
            {post.documentUrls.map((doc, i) => {
              const ext = doc.name.split(".").pop()?.toUpperCase() ?? "FILE";
              const sizeStr = doc.size < 1024
                ? `${doc.size} B`
                : doc.size < 1024 * 1024
                  ? `${(doc.size / 1024).toFixed(1)} KB`
                  : `${(doc.size / (1024 * 1024)).toFixed(1)} MB`;
              return (
                <a
                  key={i}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="doc-attachment"
                >
                  <div className="doc-icon">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="doc-info">
                    <div className="doc-name">{doc.name}</div>
                    <div className="doc-meta">{sizeStr}</div>
                  </div>
                  <span className="doc-ext">{ext}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}
      <div className="px-4 pb-3 pt-3 sm:px-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            onClick={() => onToggleLike(post._id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
              post.likedByMe
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <motion.span
              key={`${post.likedByMe}-${post._id}`}
              animate={post.likedByMe ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex items-center"
            >
              <Heart
                className={`h-4 w-4 transition-all duration-150 ease-out ${
                  post.likedByMe
                    ? "fill-primary text-primary"
                    : "fill-transparent text-current"
                }`}
              />
            </motion.span>
            <span className="tabular-nums">{post.likes > 0 ? post.likes : "Me gusta"}</span>
          </motion.button>
          {/* Favorites */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            onClick={() => onToggleFavorite(post._id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              post.favoritedByMe
                ? "bg-yellow-500/10 text-yellow-600"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <motion.span
              key={`${post.favoritedByMe}-${post._id}-fav`}
              animate={post.favoritedByMe ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Star className={`h-4 w-4 transition-colors duration-150 ${post.favoritedByMe ? "fill-yellow-500" : "fill-transparent"}`} />
            </motion.span>
            {post.favorites > 0 && <span className="tabular-nums">{post.favorites}</span>}
          </motion.button>
          {/* Share */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Compartir</span>
          </motion.button>
          {(currentUserId === post.authorId || isAdmin) && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.1, color: "var(--destructive)" }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              onClick={() => onRequestDelete(post._id)}
              className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Comments button */}
      <div className="border-t border-border/40 px-4 py-2 sm:px-5">
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          whileHover={{ backgroundColor: "var(--muted)" }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          onClick={() => onOpenComments({ ...post, postNumber: postNumber ?? 0 })}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          {commentCount > 0 ? `Ver ${commentCount} comentario${commentCount > 1 ? "s" : ""}` : "Escribe un comentario…"}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Mention Picker Modal ──────────────────────────────────────
function MentionPicker({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (user: MentionUser) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  useEffect(() => {
    const searchUsersHandler = async () => {
      try {
        const data = await searchUsers(searchQuery);
        setAllUsers(data);
      } catch (error) {
        console.error("Error searching users:", error);
      }
    };
    searchUsersHandler();
  }, [searchQuery]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    searchInputRef.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[95] flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/50 bg-background px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold">Mencionar persona</h3>
      </div>

      {/* Search */}
      <div className="border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/50 px-3 py-2 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre..."
            className="flex-1 bg-transparent text-sm text-card-foreground outline-none placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")}
              className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto">
        {allUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-3 text-xs text-muted-foreground">
              {searchQuery
                ? `No se encontró nadie con el nombre "${searchQuery}"`
                : "No hay personas disponibles para mencionar"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            <AnimatePresence initial={false}>
            {allUsers.map((u, i) => (
              <motion.button
                key={u._id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15, delay: Math.min(i * 0.03, 0.3) }}
                type="button"
                onClick={() => onSelect(u)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <Avatar className="h-9 w-9 shrink-0 border border-border/50">
                  {u.image ? (
                    <img src={u.image} alt={u.name} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {getInitials(u.name)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <span className="text-sm font-medium text-card-foreground">{u.name}</span>
              </motion.button>
            ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Comments Modal ─────────────────────────────────────────────
function CommentsModal({
  post,
  currentUserId,
  onClose,
}: {
  post: {
    _id: string;
    authorId: string;
    title?: string;
    content: string;
    createdAt: number;
    authorName: string;
    mediaUrls: LightboxItem[];
    postNumber: number;
  };
  currentUserId?: string;
  onClose: () => void;
}) {
  const pid = post._id as any;
  const [comments, setComments] = useState<any[]>([]);
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const data = await getComments(post._id);
        setComments(data);
      } catch (error) {
        console.error("Error fetching comments:", error);
      }
    };
    fetchComments();
  }, [post._id]);
  const createCommentHandler = async (targetPostId: string, commentContent: string, parentCommentId?: string) => {
    if (!currentUserId) return;
    try {
      await createComment(targetPostId, currentUserId, commentContent, parentCommentId);
    } catch (error) {
      console.error("Error creating comment:", error);
    }
  };
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);

  const topLevelComments = comments.filter((c) => !c.parentCommentId);
  const commentCount = comments.length;

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleComment = async () => {
    if (!commentText.trim() || sending) return;
    setSending(true);
    try {
      await createComment(pid, currentUserId || "", commentText.trim(), replyTo?.id || undefined);
      setCommentText("");
      setReplyTo(null);
      requestAnimationFrame(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    } catch (err) {
      console.error("Error al comentar:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[95] flex flex-col bg-background"
    >
      {/* Header */}
      <div className="border-b border-border/50 bg-background px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <Avatar className="h-9 w-9 shrink-0 border border-border/50">
            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
              {getInitials(post.authorName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            {post.title ? (
              <h3 className="truncate text-sm font-bold text-card-foreground">{post.title}</h3>
            ) : (
              <h3 className="truncate text-sm font-semibold text-card-foreground">{post.authorName}</h3>
            )}
            <p className="text-[10px] text-muted-foreground">
              Publicación n.º {post.postNumber} · {post.authorName} · {formatTime(post.createdAt)} · {commentCount} comentario{commentCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5">
        {topLevelComments.length > 0 && (
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Comentarios</p>
        )}
        {topLevelComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageCircle className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-3 text-xs text-muted-foreground">
              No hay comentarios todavía. ¡Sé el primero!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {topLevelComments.map((comment) => (
                <motion.div
                  key={comment._id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                  className="rounded-xl border border-border/40 bg-card/50 px-3 py-2"
                >
                  <CommentItem
                    comment={comment}
                    currentUserId={currentUserId}
                    onReply={(id, name) => setReplyTo({ id, name })}
                    postId={post._id}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={commentsEndRef} />
          </div>
        )}
      </div>

      {/* Comment input (fixed at bottom) */}
      <div className="border-t border-border/50 bg-background px-4 py-3 sm:px-5">
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 8 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden text-[10px] text-muted-foreground"
            >
              <div className="flex items-center gap-1.5">
                <Reply className="h-3 w-3" />
                Respondiendo a <span className="font-medium text-foreground">{replyTo.name}</span>
                <button type="button" onClick={() => setReplyTo(null)} className="ml-auto flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-end gap-2">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-muted text-[10px] font-semibold">
              {currentUserId ? "Tú" : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
              placeholder={replyTo ? "Escribe una respuesta…" : "Escribe un comentario…"}
              className="min-h-[36px] w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-xs text-card-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              maxLength={1000}
            />
          </div>
          <Button
            type="button"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleComment}
            disabled={!commentText.trim() || sending}
          >
            {sending ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Follow list modal ──────────────────────────────────────────
function FollowListModal({
  userId,
  type,
  onClose,
}: {
  userId: string;
  type: "followers" | "following";
  onClose: () => void;
}) {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    const fetchList = async () => {
      try {
        const data = type === "followers" ? await getFollowers(userId) : await getFollowing(userId);
        setList(data);
      } catch (error) {
        console.error("Error fetching follow list:", error);
      }
    };
    fetchList();
  }, [type, userId]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[95] flex flex-col bg-background"
    >
      <div className="border-b border-border/50 bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <h3 className="text-sm font-semibold">
            {type === "followers" ? "Seguidores" : "Siguiendo"}
          </h3>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {list === undefined ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ minHeight: 120 }}>
            <span />
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <User className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-3 text-xs text-muted-foreground">
              {type === "followers"
                ? "Todavía no tiene seguidores."
                : "Todavía no sigue a nadie."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {list.map((u) => (
              <div key={u._id} className="flex items-center gap-3 px-5 py-3">
                <Avatar className="h-10 w-10 shrink-0 border border-border/50">
                  {u.imageUrl && <AvatarImage src={u.imageUrl} alt={u.name} className="object-cover" />}
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {getInitials(u.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-card-foreground">{u.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

const TABS: { id: "forYou" | "following" | "popular"; label: string }[] = [
  { id: "forYou", label: "Para ti" },
  { id: "following", label: "Seguidos" },
  { id: "popular", label: "Tendencias" },
];

// ═══════════════════════════════════════════════════════════════════
// User Profile View (viewing another user's profile)
// ═══════════════════════════════════════════════════════════════════
function UserProfileView({ userId, onBack }: { userId: string; onBack: () => void }) {
  const { user } = useAuth();
  const [userPosts, setUserPosts] = useState<any[] | undefined>(undefined);
  useEffect(() => {
    const fetchUserPosts = async () => {
      try {
        const data = await getUserProfile(userId, user?._id);
        setUserPosts(data?.posts || []);
      } catch (error) {
        console.error("Error fetching user posts:", error);
      }
    };
    fetchUserPosts();
  }, [userId, user?._id]);
  const userData = userPosts && userPosts.length > 0 ? userPosts[0] : null;
  const [followStats, setFollowStats] = useState<{ followers: number; following: number } | undefined>(undefined);
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getFollowStats(userId);
        setFollowStats(data);
      } catch (error) {
        console.error("Error fetching follow stats:", error);
      }
    };
    fetchStats();
  }, [userId]);
  const [showFollowList, setShowFollowList] = useState<"followers" | "following" | null>(null);

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-border/50 bg-background">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold">{userData?.authorName ?? "Perfil"}</span>
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => { /* Compartir perfil — funcionalidad pendiente */ }}
                  className="gap-2 text-sm"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Compartir perfil
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
        {userData ? (
          <div>
            {/* ── Card 1: Avatar + Name + Title + Follow Stats ── */}
            <div className="rounded-2xl border border-border/60 bg-card px-6 py-8 sm:px-8 sm:py-10">
              <div className="flex flex-col items-center gap-5">
                <Avatar className="h-24 w-24 border-2 border-border/50">
                  {userData.authorImageUrl && <AvatarImage src={userData.authorImageUrl} alt={userData.authorName} />}
                  <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
                    {getInitials(userData.authorName)}
                  </AvatarFallback>
                </Avatar>
                {/* Name */}
                <p className="text-xl font-extrabold tracking-tight text-card-foreground">{userData.authorName}</p>
                {/* Title */}
                {(userData as any).authorTitle && (
                  <p className="text-sm font-medium italic text-primary/80">{(userData as any).authorTitle}</p>
                )}
                {/* Separator */}
                <div className="h-px w-16 bg-border/60" />
                {/* Follow Stats — always rendered to prevent layout shift */}
                <div className="flex items-center gap-8 text-sm" style={{ minHeight: 44 }}>
                  {followStats ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowFollowList("followers")}
                        className="flex flex-col items-center gap-0.5 transition-colors hover:text-foreground"
                      >
                        <motion.span
                          key={followStats.followers}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25 }}
                          className="text-lg font-bold tabular-nums text-card-foreground"
                        >{formatCount(followStats.followers)}</motion.span>
                        <span className="text-[11px] text-muted-foreground">seguidores</span>
                      </button>
                      <div className="h-8 w-px bg-border/60" />
                      <button
                        type="button"
                        onClick={() => setShowFollowList("following")}
                        className="flex flex-col items-center gap-0.5 transition-colors hover:text-foreground"
                      >
                        <motion.span
                          key={followStats.following}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25 }}
                          className="text-lg font-bold tabular-nums text-card-foreground"
                        >{formatCount(followStats.following)}</motion.span>
                        <span className="text-[11px] text-muted-foreground">siguiendo</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="h-5 w-8 animate-pulse rounded bg-muted" />
                        <div className="h-2.5 w-14 animate-pulse rounded bg-muted" />
                      </div>
                      <div className="h-8 w-px bg-border/60" />
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="h-5 w-8 animate-pulse rounded bg-muted" />
                        <div className="h-2.5 w-12 animate-pulse rounded bg-muted" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── Card 2: Bio ───────────────────────────────── */}
            {(userData as any).authorBio && (
              <div className="mt-4 rounded-2xl border border-border/60 bg-card px-6 py-5 sm:px-8 sm:py-6">
                <div className="mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descripción</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{(userData as any).authorBio}</p>
              </div>
            )}

            {/* ── Section: Publicaciones ─────────────────────── */}
            <div className="mt-8 mb-4 border-t border-border/40 pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Publicaciones</p>
            </div>
            <div className="flex flex-col gap-4 pb-24">
              {(userPosts ?? []).length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Este usuario no tiene publicaciones.</p>
              ) : (
                (userPosts ?? []).map((post, idx) => (
                  <PostCard
                    key={post._id}
                    post={post as any}
                    currentUserId={undefined}
                    onToggleLike={() => {}}
                    onToggleFavorite={() => {}}
                    onFollow={() => {}}
                    onRequestUnfollow={() => {}}
                    onRequestDelete={() => {}}
                    onOpenLightbox={() => {}}
                    onOpenComments={() => {}}
                    onOpenProfile={() => {}}
                    postNumber={(userPosts ?? []).length - idx}
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Cargando perfil…</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showFollowList && (
          <FollowListModal
            userId={userId}
            type={showFollowList}
            onClose={() => setShowFollowList(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"forYou" | "following" | "popular">("forYou");
  const isAdmin = (user as any)?.role === "admin";
  const [currentView, setCurrentView] = useState<"feed" | "profile" | "userProfile">("feed");
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  
  // Fetch posts when activeTab changes
  useEffect(() => {
    const fetchPosts = async () => {
      if (!user?._id) return;
      setLoadingPosts(true);
      try {
        const data = await getPosts(activeTab, user._id);
        setPosts(data);
      } catch (error) {
        console.error("Error fetching posts:", error);
      } finally {
        setLoadingPosts(false);
      }
    };
    fetchPosts();
  }, [activeTab, user?._id]);

  const [content, setContent] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<{
    items: LightboxItem[];
    index: number;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [unfollowTarget, setUnfollowTarget] = useState<{ userId: string; name: string } | null>(null);
  const [commentsModalPost, setCommentsModalPost] = useState<{
    _id: string;
    authorId: string;
    title?: string;
    content: string;
    createdAt: number;
    authorName: string;
    mediaUrls: LightboxItem[];
    postNumber: number;
  } | null>(null);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [pendingMentions, setPendingMentions] = useState<PostMention[]>([]);
  const pendingMentionRangeRef = useRef<{
    node: Node;
    offset: number;
  } | null>(null);

  // ── File handling ──────────────────────────────────────────────
  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const remaining = MAX_FILES - pendingMedia.length;
      const newItems: PendingMedia[] = arr
        .slice(0, remaining)
        .filter((file) => {
          const isVideo = file.type.startsWith("video/");
          const maxMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
          if (file.size > maxMb * 1024 * 1024) {
            console.warn(`El archivo ${file.name} supera ${maxMb}MB`);
            return false;
          }
          return true;
        })
        .map((file) => {
          const isVideo = file.type.startsWith("video/");
          return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            file,
            type: (isVideo ? "video" : "image") as "image" | "video",
            preview: URL.createObjectURL(file),
          };
        });
      setPendingMedia((prev) => [...prev, ...newItems]);
    },
    [pendingMedia.length],
  );

  const removePending = useCallback((id: string) => {
    setPendingMedia((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  // ── Editor handlers ────────────────────────────────────────────
  const handleEditorInput = useCallback(() => {
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
    }
    // Detect @ character for mention picker
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) return;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? "";
        const offset = range.startOffset;
        // Check if the character before cursor is @
        if (offset > 0 && text[offset - 1] === "@") {
          // Make sure there's no space between @ and cursor (fresh @)
          const afterAt = text.slice(offset);
          if (!afterAt.includes(" ") || afterAt.length === 0) {
            pendingMentionRangeRef.current = { node, offset: offset - 1 };
            setShowMentionPicker(true);
          }
        }
      }
    }
  }, []);

  const handleSelectMention = useCallback((user: MentionUser) => {
    setShowMentionPicker(false);
    if (!editorRef.current) return;

    // Restore the selection to where @ was typed
    const saved = pendingMentionRangeRef.current;
    if (!saved) return;
    pendingMentionRangeRef.current = null;

    // Select from @ to current cursor
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.setStart(saved.node, saved.offset);
    range.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
    range.deleteContents();

    // Insert mention span
    const span = document.createElement("span");
    span.className = "mention";
    span.setAttribute("data-mention-user-id", user._id);
    span.setAttribute("data-mention-name", user.name);
    span.textContent = `@${user.name}`;
    span.contentEditable = "false";
    range.insertNode(span);

    // Move cursor after the mention span
    const space = document.createTextNode(" ");
    span.parentNode?.insertBefore(space, span.nextSibling);
    const newRange = document.createRange();
    newRange.setStartAfter(space);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    // Track the mention
    setPendingMentions((prev) => {
      if (prev.some((m) => m.userId === user._id)) return prev;
      return [...prev, { userId: user._id, name: user.name }];
    });

    // Sync content
    requestAnimationFrame(() => {
      if (editorRef.current) {
        setContent(editorRef.current.innerHTML);
      }
    });
  }, []);

  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Shift+Enter = newline, Enter = newline in contentEditable (default)
      // Sync after key
      requestAnimationFrame(() => handleEditorInput());
    },
    [handleEditorInput],
  );

  const handleEditorPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
      requestAnimationFrame(() => handleEditorInput());
    },
    [handleEditorInput],
  );

  // ── Post ───────────────────────────────────────────────────────
  const handlePost = async () => {
    // Get the latest HTML from the editor
    const html = editorRef.current?.innerHTML ?? content;
    const textOnly = editorRef.current?.textContent?.trim() ?? "";
    if ((!textOnly && !postTitle.trim() && pendingMedia.length === 0) || posting) return;

    setPosting(true);
    setUploading(true);
    try {
      const totalFiles = pendingMedia.length + pendingDocs.length;
      setUploadProgress({ current: 0, total: totalFiles });
      const uploaded: UploadedMedia[] = [];
      const maxRetries = 2;
      let filesUploaded = 0;
      for (const pm of pendingMedia) {
        let lastError = "";
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const path = generateFilePath(user?._id || "", "upload", "media");
            const result = await fetch(path, {
              method: "POST",
              headers: {
                "Content-Type": pm.file.type || "application/octet-stream",
              },
              body: pm.file,
            });
            if (!result.ok) {
              lastError = `HTTP ${result.status}`;
              console.error(
                `Error al subir ${pm.file.name} (intento ${attempt + 1}): ${lastError}`,
              );
              if (attempt < maxRetries) continue;
              break;
            }
            const json = await result.json();
            if (json.storageId) {
              uploaded.push({
                storageId: json.storageId,
                type: pm.type,
                mime: pm.file.type || undefined,
              });
              filesUploaded++;
              setUploadProgress({ current: filesUploaded, total: totalFiles });
              break;
            } else {
              lastError = "Respuesta sin storageId";
              if (attempt < maxRetries) continue;
            }
          } catch (fetchErr) {
            lastError =
              fetchErr instanceof Error ? fetchErr.message : "Error de red";
            console.error(
              `Error de red al subir ${pm.file.name} (intento ${attempt + 1}):`,
              lastError,
            );
            if (attempt < maxRetries) continue;
          }
        }
      }

      // Upload documents
      const uploadedDocs: UploadedDoc[] = [];
      for (const doc of pendingDocs) {
        let docError = "";
        for (let attempt = 0; attempt <= 2; attempt++) {
          try {
            const path = generateFilePath(user?._id || "", "upload", "media");
            const result = await fetch(path, {
              method: "POST",
              headers: { "Content-Type": doc.file.type || "application/octet-stream" },
              body: doc.file,
            });
            if (!result.ok) { docError = `HTTP ${result.status}`; if (attempt < 2) continue; break; }
            const json = await result.json();
            if (json.storageId) {
              uploadedDocs.push({ storageId: json.storageId, name: doc.name, size: doc.size, mime: doc.file.type || undefined });
              filesUploaded++;
              setUploadProgress({ current: filesUploaded, total: totalFiles });
              break;
            }
          } catch (e) {
            docError = e instanceof Error ? e.message : "Error de red";
            if (attempt < 2) continue;
          }
        }
      }

      // Send HTML content (or empty string if no text)
      const contentToSend = textOnly ? html.trim() : "";
      await createPostFn(user?._id || "", contentToSend, {
        title: postTitle.trim() || undefined,
        media:
          uploaded.length > 0 ? (uploaded as any) : undefined,
        documents:
          uploadedDocs.length > 0 ? (uploadedDocs as any) : undefined,
        mentions:
          pendingMentions.length > 0 ? (pendingMentions as any) : undefined,
      });

      pendingMedia.forEach((pm) => URL.revokeObjectURL(pm.preview));
      setPendingMedia([]);
      setPendingDocs([]);
      setPendingMentions([]);
      setContent("");
      setPostTitle("");
      if (editorRef.current) editorRef.current.innerHTML = "";
    } catch (err) {
      console.error("Error al crear la publicación:", err);
    } finally {
      setUploading(false);
      setPosting(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    try {
      await togglePostLike(user?._id || "", postId);
    } catch (err) {
      console.error("Error al dar me gusta:", err);
    }
  };
  const handleToggleFollow = useCallback(async (targetUserId: string) => {
    if (!user?._id) return;
    try {
      await toggleFollow(user._id, targetUserId);
    } catch (error) {
      console.error("Error toggling follow:", error);
    }
  }, [user?._id]);

  const handleToggleFavorite = async (postId: string) => {
    try {
      await togglePostFavorite(user?._id || "", postId);
    } catch (err) {
      console.error("Error al marcar favorito:", err);
    }
  };
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (isAdmin) {
        await deletePostAsAdmin(deleteTarget);
      } else {
        await deletePost(deleteTarget, user?._id || "");
      }
    } catch (err) {
      console.error("Error al eliminar:", err);
    }
    setDeleteTarget(null);
  };
  const handleConfirmUnfollow = async () => {
    if (!unfollowTarget) return;
    try {
      await toggleFollow(user?._id || "", unfollowTarget.userId);
    } catch (err) {
      console.error("Error al dejar de seguir:", err);
    }
    setUnfollowTarget(null);
  };
  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };
  const openLightbox = (items: LightboxItem[], index: number) =>
    setLightbox({ items, index });

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const arr = Array.from(e.target.files);
    const remaining = MAX_DOCS - pendingDocs.length;
    const newDocs: PendingDoc[] = arr.slice(0, remaining).filter(file => {
      if (file.size > MAX_DOC_MB * 1024 * 1024) {
        console.warn(`El archivo ${file.name} supera ${MAX_DOC_MB}MB`);
        return false;
      }
      return true;
    }).map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      name: file.name,
      size: file.size,
      extension: file.name.split(".").pop()?.toUpperCase() ?? "FILE",
    }));
    setPendingDocs(prev => [...prev, ...newDocs]);
    e.target.value = "";
  };

  const removePendingDoc = useCallback((id: string) => {
    setPendingDocs(prev => prev.filter(d => d.id !== id));
  }, []);

  const hasText =
    editorRef.current?.textContent?.trim().length ?? content.trim().length > 0;
  const isPostable = hasText || postTitle.trim().length > 0 || pendingMedia.length > 0 || pendingDocs.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 border-b border-border/50 bg-background">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <img src="/assets/67385.png" alt="Asternal" className="h-8 w-8 rounded-lg object-contain" />
            <span className="text-lg font-extrabold tracking-tight text-primary">Asternal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user?.name ?? "Jugador"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleSignOut}
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="mx-auto max-w-2xl px-4 pt-6 pb-20 sm:pt-10 sm:pb-24">
        <AnimatePresence mode="wait" initial={false}>
          {currentView === "userProfile" ? (
            <motion.div
              key="userProfile"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            >
              <UserProfileView userId={viewingUserId!} onBack={() => { setCurrentView("feed"); setViewingUserId(null); }} />
            </motion.div>
          ) : currentView === "profile" ? (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            >
              <ProfilePage onBack={() => setCurrentView("feed")} />
            </motion.div>
          ) : (<>
        {/* Composer */}
        <div
          className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="flex items-start gap-4">
            <Avatar className="h-10 w-10 shrink-0 border border-border/50">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {user?.name ? getInitials(user.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              {/* Title input */}
              <input
                type="text"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                placeholder="Título (opcional)"
                maxLength={120}
                className="w-full bg-transparent text-base font-bold text-card-foreground outline-none placeholder:text-muted-foreground/50"
              />
              <div className="my-2 border-t border-border/30" />
              {/* Rich text editor */}
              <div
                ref={editorRef}
                contentEditable
                data-placeholder="¿Qué tienes en mente, jugador?"
                onInput={handleEditorInput}
                onKeyDown={handleEditorKeyDown}
                onPaste={handleEditorPaste}
                className="min-h-[64px] w-full bg-transparent text-[15px] leading-relaxed text-card-foreground outline-none"
                style={{ wordBreak: "break-word" }}
              />

              {/* Media previews */}
              {pendingMedia.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <AnimatePresence initial={false}>
                  {pendingMedia.map((pm) => (
                    <motion.div
                      key={pm.id}
                      className="group relative overflow-hidden rounded-xl border border-border/40 bg-muted"
                    >
                      {pm.type === "video" ? (
                        <VideoThumb src={pm.preview} alt={pm.file.name} />
                      ) : (
                        <img
                          src={pm.preview}
                          alt={pm.file.name}
                          className="h-28 w-full object-contain"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removePending(pm.id)}
                        className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <div className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                        {pm.type === "video" ? (
                          <Film className="inline h-3 w-3" />
                        ) : (
                          <ImagePlus className="inline h-3 w-3" />
                        )}
                        {` `}
                        {pm.file.name.length > 16
                          ? pm.file.name.slice(0, 14) + "…"
                          : pm.file.name}
                      </div>
                    </motion.div>
                  ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Document previews */}
              {pendingDocs.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {pendingDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="group flex items-center gap-3 rounded-xl border border-border/40 bg-muted/30 px-3 py-2.5"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-card-foreground">{doc.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {doc.size < 1024 ? `${doc.size} B` : doc.size < 1048576 ? `${(doc.size / 1024).toFixed(1)} KB` : `${(doc.size / 1048576).toFixed(1)} MB`}
                        </div>
                      </div>
                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        {doc.extension}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePendingDoc(doc.id)}
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Separator */}
              <div className="mt-5 border-t border-border/40" />

              {/* Actions row */}
              <div className="mt-3.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={`${ACCEPTED_IMAGE},${ACCEPTED_VIDEO}`}
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <input
                    ref={docInputRef}
                    type="file"
                    accept={ACCEPTED_DOCS_ONLY}
                    multiple
                    className="hidden"
                    onChange={handleDocChange}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-primary"
                    onClick={() => fileInputRef.current?.click()}
                    title="Añadir imagen o vídeo"
                    disabled={pendingMedia.length >= MAX_FILES}
                  >
                    <ImagePlus className="h-4 w-4" />
                    <span className="text-xs hidden sm:inline">Foto/Video</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-primary"
                    onClick={() => docInputRef.current?.click()}
                    title="Añadir documento"
                    disabled={pendingDocs.length >= MAX_DOCS}
                  >
                    <Paperclip className="h-4 w-4" />
                    <span className="text-xs hidden sm:inline">Documento</span>
                  </Button>
                  {(pendingMedia.length > 0 || pendingDocs.length > 0) && (
                    <span className="ml-1 text-[11px] text-muted-foreground tabular-nums">
                      {pendingMedia.length + pendingDocs.length}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 px-5 min-w-[120px]"
                  disabled={!isPostable || posting}
                  onClick={handlePost}
                >
                  {posting || uploading ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {uploading
                    ? uploadProgress.total > 1
                      ? `Subiendo ${uploadProgress.current}/${uploadProgress.total}…`
                      : "Subiendo…"
                    : "Publicar"}
                </Button>
              </div>

              {/* Separator */}
              <div className="mt-4 border-t border-border/40" />

              {/* Formatting toolbar */}
              <FormatToolbar />

            </div>
          </div>
        </div>

        {/* ── Feed Tabs ──────────────────────────────────────────── */}
        <div
          className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card"
        >
          <div className="relative flex">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveTab(tab.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className={`relative flex-1 py-3 text-center text-xs font-semibold transition-colors ${
                  activeTab === tab.id
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-1/2 h-0.5 w-[calc(100%-1.5rem)] -translate-x-1/2 bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Feed */}
        <div className="mt-6 flex flex-col gap-4 sm:mt-8 sm:gap-5">
          <AnimatePresence initial={false}>
            {posts === undefined ? null : posts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-border/40 bg-card/50 px-6 py-12"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/8">
                    <Newspaper className="h-7 w-7 text-primary/60" />
                  </div>
                  {activeTab === "forYou" && (
                    <>
                      <p className="text-sm font-semibold text-foreground">
                        No hay publicaciones para ti
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Cuando haya publicaciones nuevas, aparecerán aquí.
                      </p>
                    </>
                  )}
                  {activeTab === "following" && (
                    <>
                      <p className="text-sm font-semibold text-foreground">
                        No hay publicaciones de tus seguidos
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Sigue a otras personas para ver sus publicaciones aquí.
                      </p>
                    </>
                  )}
                  {activeTab === "popular" && (
                    <>
                      <p className="text-sm font-semibold text-foreground">
                        No hay tendencias aún
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Las publicaciones con más interacciones aparecerán aquí.
                      </p>
                    </>
                  )}
                </div>
              </motion.div>
            ) : (
              <div
                key={activeTab}
                className="flex flex-col gap-4 sm:gap-5"
              >
              {posts.map((post, idx) => (
                <PostCard
                  key={post._id}
                  post={{
                    ...post,
                    authorImageUrl: (post as any).authorImageUrl ?? undefined,
                    documentUrls: (post as any).documentUrls ?? [],
                    hashtags: (post as any).hashtags ?? [],
                  }}
                  currentUserId={user?._id}
                  onToggleLike={handleToggleLike}
                  onToggleFavorite={handleToggleFavorite}
                  onFollow={(userId) => handleToggleFollow(userId)}
                  onRequestUnfollow={(userId, name) => setUnfollowTarget({ userId, name })}
                  onRequestDelete={setDeleteTarget}
                  onOpenLightbox={openLightbox}
                  onOpenComments={setCommentsModalPost}
                  onOpenProfile={(userId) => { setViewingUserId(userId); setCurrentView("userProfile"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  isAdmin={isAdmin}
                  postNumber={posts.length - idx}
                />
              ))}
              </div>
            )}
          </AnimatePresence>
        </div>
        </>
          )}
        </AnimatePresence>
      </main>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <Lightbox
            items={lightbox.items}
            initialIndex={lightbox.index}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>

      {/* Mention picker */}
      <AnimatePresence>
        {showMentionPicker && (
          <MentionPicker
            onClose={() => {
              setShowMentionPicker(false);
              pendingMentionRangeRef.current = null;
            }}
            onSelect={handleSelectMention}
          />
        )}
      </AnimatePresence>

      {/* Comments modal */}
      <AnimatePresence>
        {commentsModalPost && (
          <CommentsModal
            post={commentsModalPost}
            currentUserId={user?._id}
            onClose={() => setCommentsModalPost(null)}
          />
        )}
      </AnimatePresence>

      {/* Delete dialog */}
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Unfollow dialog */}
      <UnfollowConfirmDialog
        open={unfollowTarget !== null}
        userName={unfollowTarget?.name ?? ""}
        onConfirm={handleConfirmUnfollow}
        onCancel={() => setUnfollowTarget(null)}
      />

      {/* ── Bottom Navigation Bar ─────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => { setCurrentView("feed"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 transition-colors ${currentView === "feed" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Home className="h-5 w-5" />
            <span className={`text-[10px] ${currentView === "feed" ? "font-semibold" : "font-medium"}`}>Inicio</span>
          </button>
          <button
            type="button"
            onClick={() => { setCurrentView("profile"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 transition-colors ${currentView === "profile" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <User className="h-5 w-5" />
            <span className={`text-[10px] ${currentView === "profile" ? "font-semibold" : "font-medium"}`}>Perfil</span>
          </button>
        </div>
      </nav>

      {/* Bottom padding to account for fixed nav */}
      <div className="h-16" />
    </div>
  );
}
