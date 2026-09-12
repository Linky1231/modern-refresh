// ═══════════════════════════════════════════════════════════════════
// Constantes, tipos y utilidades compartidas por el dashboard
// (extraído de Dashboard.tsx sin cambios de comportamiento).
// ═══════════════════════════════════════════════════════════════════
import { useState, useCallback, useEffect } from "react";

// ── Constants ──────────────────────────────────────────────────────
export const ACCEPTED_IMAGE =
  "image/jpeg,image/png,image/gif,image/webp,image/bmp,image/svg+xml";
export const ACCEPTED_VIDEO =
  "video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,video/x-flv,video/3gpp,video/mpeg,video/ogg,video/*";
export const ACCEPTED_DOC =
  "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/zip,application/x-rar-compressed,application/json";
export const ACCEPTED_ALL = `${ACCEPTED_IMAGE},${ACCEPTED_VIDEO},${ACCEPTED_DOC}`;
export const ACCEPTED_DOCS_ONLY = ACCEPTED_DOC;
export const MAX_DOCS = 5;
export const MAX_DOC_MB = 25;
export const MAX_FILES = 10;
export const MAX_IMAGE_MB = 10;
export const MAX_VIDEO_MB = 50;

export const TEXT_COLORS = [
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
export interface PendingMedia {
  id: string;
  file: File;
  type: "image" | "video";
  preview: string;
}

export interface UploadedMedia {
  storageId: string;
  type: "image" | "video";
  mime?: string;
}

export interface LightboxItem {
  url: string;
  type: "image" | "video";
  mime?: string;
}

export interface MentionUser {
  _id: string;
  name: string;
  image?: string;
}

export interface PostMention {
  userId: string;
  name: string;
}

export interface PendingDoc {
  id: string;
  file: File;
  name: string;
  size: number;
  extension: string;
}

export interface UploadedDoc {
  storageId: string;
  name: string;
  size: number;
  mime?: string;
}

export interface DocumentUrl {
  url: string;
  name: string;
  size: number;
  mime?: string;
}

/** Format large numbers in Spanish: 1200 -> 1,2 mil, 10000 -> 10 mil, etc. */
export function formatCount(n: number): string {
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
export function formatTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "ahora mismo";
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Strip non-allowed HTML, keeping only <span style="color;font-size"> and <br>. */
export function sanitizePostHtml(html: string): string {
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
        const isMention =
          node.classList.contains("mention") ||
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
      // Keep structural heading/paragraph tags so text sizes persist,
      // but strip all their attributes (no styling leaks through).
      if (["H1", "H2", "H3", "P", "DIV"].includes(node.tagName)) {
        for (const attr of Array.from(node.attributes)) {
          node.removeAttribute(attr.name);
        }
        Array.from(node.childNodes).forEach(walk);
        return;
      }
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
    '<span class="hashtag">$1</span>',
  );
}

// ── Aspect ratio detection hook ───────────────────────────────────
/**
 * Detects if media has a problematic aspect ratio for feed display.
 * Returns { isProblematic, ratio } once dimensions are known.
 * Vertical photos (ratio < 0.55) or panoramic (ratio > 2.5) are flagged.
 */
export function useAspectCheck(
  type: "image" | "video",
): { isProblematic: boolean; ratio: number | null; onDimensions: (w: number, h: number) => void } {
  void type;
  const [ratio, setRatio] = useState<number | null>(null);
  const onDimensions = useCallback((w: number, h: number) => {
    if (w > 0 && h > 0) setRatio(w / h);
  }, []);
  const isProblematic = ratio !== null && (ratio < 0.55 || ratio > 2.5);
  return { isProblematic, ratio, onDimensions };
}

// ── Video blob URL hook ────────────────────────────────────────────
const videoBlobCache = new Map<string, string>();

export function useVideoObjectUrl(url: string, mime: string) {
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
export function useVideoThumbnail(url: string): string | null {
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    let cancelled = false;
    const cleanup = () => {
      try {
        URL.revokeObjectURL(video.src);
      } catch {}
    };
    video.onloadeddata = () => {
      if (cancelled) return;
      try {
        video.currentTime = 0.5;
      } catch {
        cleanup();
      }
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
    video.onerror = () => {
      if (!cancelled) cleanup();
    };
    video.src = url;
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [url]);
  return thumb;
}

// ── Selection formatting helper ────────────────────────────────────
/**
 * Remove a specific style from all spans in a document fragment,
 * unwrapping spans that become empty.
 */
export function removeStyleFromFragment(fragment: DocumentFragment, prop: string) {
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
export function removeStyleFromSelection(prop: string) {
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
export function applyStyleToSelection(prop: string, value: string) {
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
export function selectionHasStyle(prop: string, value: string): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  if (prop === "fontWeight") return document.queryCommandState("bold");
  if (prop === "textDecoration") return document.queryCommandState("underline");
  if (prop === "fontStyle") return document.queryCommandState("italic");
  const node = sel.getRangeAt(0).startContainer;
  const el = node instanceof HTMLElement ? node : node.parentElement;
  if (!el) return false;
  const computed = window.getComputedStyle(el);
  const actual = (computed as any)[prop];
  if (!actual) return false;
  if (prop === "fontSize") {
    const target = parseFloat(value);
    const current = parseFloat(actual);
    return Math.abs(target - current) < 1;
  }
  return actual === value;
}
