// ▶ [MIGRACIÓN LOVABLE CLOUD] Esta página ya NO sincroniza con un
// backend: todas las llamadas a @/lib/db (feed, me gusta, comentarios,
// seguidores, notificaciones…) funcionan 100% en el dispositivo.
// Al migrar la app a Lovable Cloud, la capa @/lib/db se reconecta al backend.
//
// La página se encarga del estado y los flujos; los widgets viven en
// ./dashboard/shared, ./dashboard/editor-widgets y ./dashboard/feed-widgets.
import { useCallback, useEffect, useRef, useState } from "react";
import ProfilePage from "./ProfilePage";
import SceneEditorPage from "./SceneEditorPage";
import PollComposer, { type PollDraft } from "@/components/PollComposer";
import { useAuth } from "@/hooks/use-auth";
import {
  getPosts,
  createPost as createPostFn,
  deletePost,
  deletePostAsAdmin,
  togglePostLike,
  togglePostFavorite,
  searchUsers,
  getFollowing,
  toggleFollow,
  uploadFile,
  generateFilePath,
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationsRead,
} from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { UnfollowConfirmModal } from "@/components/UnfollowConfirmModal";
import { useNavigate } from "@/lib/router-compat";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Bell,
  ChevronDown,
  FileText,
  Home,
  ImagePlus,
  LogOut,
  Newspaper,
  Plus,
  Send,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DeleteConfirmDialog,
  FormatToolbar,
  Lightbox,
  RemoveButton,
} from "./dashboard/editor-widgets";
import {
  CommentsModal,
  MentionPicker,
  NotificationsPanel,
  PostCard,
  TABS,
  UserProfileView,
} from "./dashboard/feed-widgets";
import {
  ACCEPTED_DOCS_ONLY,
  ACCEPTED_IMAGE,
  MAX_DOCS,
  MAX_DOC_MB,
  MAX_FILES,
  MAX_IMAGE_MB,
  MAX_VIDEO_MB,
  getInitials,
  type LightboxItem,
  type MentionUser,
  type PendingDoc,
  type PendingMedia,
  type PostMention,
  type UploadedDoc,
  type UploadedMedia,
} from "./dashboard/shared";

// ── Pestañas del feed ──────────────────────────────────────────────
type FeedTab = "forYou" | "following" | "popular";

const TAB_EMPTY: Record<
  FeedTab,
  { title: string; subtitle: string; cta: string }
> = {
  forYou: {
    title: "No hay publicaciones para ti",
    subtitle: "Cuando haya publicaciones nuevas, aparecerán aquí.",
    cta: "Crear la primera",
  },
  following: {
    title: "No hay publicaciones de tus seguidos",
    subtitle: "Sigue a alguien y sus publicaciones aparecerán aquí.",
    cta: "Ver tendencias",
  },
  popular: {
    title: "No hay tendencias aún",
    subtitle: "Las publicaciones con más interacciones aparecerán aquí.",
    cta: "Ver lo más reciente",
  },
};

/** Icono del estado vacío: cada pestaña explica qué falta. */
function EmptyStateIcon({ tab }: { tab: FeedTab }) {
  const Icon =
    tab === "following" ? Users : tab === "popular" ? TrendingUp : Newspaper;
  return (
    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
      <Icon className="h-5 w-5 text-primary" strokeWidth={1.8} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FeedTab>("forYou");
  const isAdmin = (user as any)?.role === "admin";

  // ▶ Persistencia de pestañas: la pestaña activa sobrevive a los cambios
  // de vista (Inicio <-> Perfil) sin re-renders ni saltos de UI.
  const [tabInitDone, setTabInitDone] = useState(false);
  useEffect(() => {
    let parsed: FeedTab | null = null;
    try {
      const raw = window.localStorage.getItem("asternal_active_tab");
      if (raw === "forYou" || raw === "following" || raw === "popular") {
        parsed = raw;
      }
    } catch {}
    if (parsed) setActiveTab(parsed);
    setTabInitDone(true);
  }, []);

  useEffect(() => {
    if (!tabInitDone) return;
    try {
      window.localStorage.setItem("asternal_active_tab", activeTab);
    } catch {}
  }, [activeTab, tabInitDone]);

  const [currentView, setCurrentView] = useState<
    "feed" | "profile" | "userProfile" | "editor"
  >("feed");

  // Placeholder del editor: abre el creador de mapas (pizarrón).
  function EditorPlaceholder({ onBack }: { onBack: () => void }) {
    return <SceneEditorPage onBack={onBack} />;
  }

  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  // undefined = todavía cargando: evita mostrar el estado vacío antes de
  // tiempo (sin parpadeos ni saltos al llegar las publicaciones).
  const [posts, setPosts] = useState<any[] | undefined>(undefined);

  // Fetch posts when activeTab changes. Todo es local, así que leer el feed
  // es instantáneo: refreshPosts() se usa tras cada acción (publicar, me
  // gusta, favorito, borrar…) para que la UI refleje el cambio al momento.
  const refreshPosts = useCallback(async () => {
    if (!user?._id) return;
    try {
      const data = await getPosts(activeTab, user._id);
      setPosts(data);
    } catch (error) {
      console.error("Error fetching posts:", error);
    }
  }, [activeTab, user?._id]);

  useEffect(() => {
    if (!user?._id) return;
    void refreshPosts();
  }, [refreshPosts, user?._id]);

  const [content, setContent] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [showTitleField, setShowTitleField] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadState, setUploadState] = useState<"idle" | "uploading">("idle");
  const isBusy = posting || uploading || uploadState === "uploading";

  // ── PARTE 4 · ENCUESTAS: estado del editor dentro del compositor ──
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [pollDraft, setPollDraft] = useState<PollDraft | null>(null);
  // Sube cuando el feed se refresca: PostCard re-chequea Seguir/Siguiendo.
  const [refreshTick, setRefreshTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<{
    items: LightboxItem[];
    index: number;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [unfollowTarget, setUnfollowTarget] = useState<{
    userId: string;
    name: string;
  } | null>(null);
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
  const pendingMentionRangeRef = useRef<{ node: Node; offset: number } | null>(
    null,
  );

  // ── Notifications ────────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user?._id) return;
    setNotifLoading(true);
    try {
      const data = await getNotifications(user._id);
      setNotifications(data);
      setUnreadCount(0);
      await markNotificationsRead(user._id);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setNotifLoading(false);
    }
  }, [user?._id]);

  const refreshUnread = useCallback(async () => {
    if (!user?._id) return;
    try {
      setUnreadCount(await getUnreadNotificationsCount(user._id));
    } catch (error) {
      console.error("Error fetching unread notifications:", error);
    }
  }, [user?._id]);

  useEffect(() => {
    void refreshUnread();
    const interval = setInterval(() => void refreshUnread(), 20000);
    return () => clearInterval(interval);
  }, [refreshUnread]);

  const handleBellClick = useCallback(() => {
    setNotifOpen((open) => {
      if (!open) void loadNotifications();
      return !open;
    });
  }, [loadNotifications]);

  // ── Personas sugeridas (estado vacío de «Seguidos») ────────────
  const [suggested, setSuggested] = useState<
    Array<{ _id: string; name: string; image?: string | null }>
  >([]);
  useEffect(() => {
    if (activeTab !== "following" || !user?._id) return;
    let active = true;
    (async () => {
      try {
        // Se excluyen las personas que ya sigues: el botón «Seguir» las
        // dejaría de seguir sin querer.
        const [people, following] = await Promise.all([
          searchUsers("", user._id),
          getFollowing(user._id),
        ]);
        const followedIds = new Set(
          (following as Array<{ _id: string }>).map((u) => u._id),
        );
        const candidates = (
          people as Array<{ _id: string; name: string; image?: string | null }>
        ).filter((u) => !followedIds.has(u._id));
        if (active) setSuggested(candidates.slice(0, 3));
      } catch (error) {
        console.error("Error fetching suggested users:", error);
      }
    })();
    return () => {
      active = false;
    };
  }, [activeTab, user?._id, refreshTick]);

  // ── File handling ──────────────────────────────────────────────
  // ▶ [MODO LOCAL / DISPOSITIVO] Las imágenes se guardan en el dispositivo
  // via @/lib/db.uploadFile (data URL), igual que el avatar de perfil.
  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      const remaining = MAX_FILES - pendingMedia.length;
      const fresh: PendingMedia[] = [];

      for (const file of arr.slice(0, remaining)) {
        const isVideo = file.type.startsWith("video/");
        const maxMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
        if (file.size > maxMb * 1024 * 1024) {
          console.warn(`El archivo ${file.name} supera ${maxMb}MB`);
          continue;
        }

        // En modo local solo aceptamos imágenes; los vídeos no se persisten.
        if (isVideo) {
          toast.warning(
            "Los vídeos no se pueden adjuntar en modo local. Estarán disponibles al migrar a Lovable Cloud.",
          );
          continue;
        }

        const preview = URL.createObjectURL(file);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        fresh.push({ id, file, type: "image" as const, preview });
      }

      setPendingMedia((prev) => [...prev, ...fresh]);
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
    if (e.target.files) void addFiles(e.target.files);
    e.target.value = "";
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) void addFiles(e.dataTransfer.files);
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
        if (offset > 0 && text[offset - 1] === "@") {
          const afterAt = text.slice(offset);
          if (!afterAt.includes(" ") || afterAt.length === 0) {
            pendingMentionRangeRef.current = { node, offset: offset - 1 };
            setShowMentionPicker(true);
          }
        }
      }
    }
  }, []);

  const handleSelectMention = useCallback((mentionUser: MentionUser) => {
    setShowMentionPicker(false);
    if (!editorRef.current) return;

    // Restore the selection to where @ was typed
    const saved = pendingMentionRangeRef.current;
    if (!saved) return;
    pendingMentionRangeRef.current = null;

    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.setStart(saved.node, saved.offset);
    range.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
    range.deleteContents();

    const span = document.createElement("span");
    span.className = "mention";
    span.setAttribute("data-mention-user-id", mentionUser._id);
    span.setAttribute("data-mention-name", mentionUser.name);
    span.textContent = `@${mentionUser.name}`;
    span.contentEditable = "false";
    range.insertNode(span);

    const space = document.createTextNode(" ");
    span.parentNode?.insertBefore(space, span.nextSibling);
    const newRange = document.createRange();
    newRange.setStartAfter(space);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    setPendingMentions((prev) => {
      if (prev.some((m) => m.userId === mentionUser._id)) return prev;
      return [...prev, { userId: mentionUser._id, name: mentionUser.name }];
    });

    requestAnimationFrame(() => {
      if (editorRef.current) {
        setContent(editorRef.current.innerHTML);
      }
    });
  }, []);

  const handleEditorKeyDown = useCallback(
    (_e: React.KeyboardEvent) => {
      // Shift+Enter = newline, Enter = newline in contentEditable (default)
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

  // ── Publicar ───────────────────────────────────────────────────
  const handlePost = async () => {
    const html = editorRef.current?.innerHTML ?? content;
    const textOnly = editorRef.current?.textContent?.trim() ?? "";
    if (
      (!textOnly &&
        !postTitle.trim() &&
        pendingMedia.length === 0 &&
        pendingDocs.length === 0 &&
        !pollDraft) ||
      isBusy
    )
      return;

    setPosting(true);
    setUploading(true);
    setUploadState("uploading");
    const start = Date.now();
    try {
      const timeoutLimit = 25_000;

      const totalFiles = pendingMedia.length + pendingDocs.length;
      setUploadProgress({ current: 0, total: totalFiles });

      const uploaded: UploadedMedia[] = [];
      let filesUploaded = 0;
      for (const pm of pendingMedia) {
        if (Date.now() - start > timeoutLimit) {
          toast.error("Subida cancelada por timeout. Inténtalo de nuevo.");
          throw new Error("timeout");
        }
        try {
          const filePath = generateFilePath(
            user?._id || "",
            pm.file.name,
            "media",
          );
          const storagePath = await uploadFile("media", pm.file, filePath);
          uploaded.push({
            storageId: storagePath,
            type: pm.type,
            mime: pm.file.type || undefined,
          });
          filesUploaded++;
          setUploadProgress({ current: filesUploaded, total: totalFiles });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Error al guardar la imagen";
          console.error(`Error al subir ${pm.file.name}:`, message);
          toast.error(message);
          throw new Error("media_upload_failed");
        }
      }

      const uploadedDocs: UploadedDoc[] = [];
      if (totalFiles > 0) {
        for (const doc of pendingDocs) {
          if (Date.now() - start > timeoutLimit) {
            toast.error("Subida cancelada por timeout. Inténtalo de nuevo.");
            throw new Error("timeout");
          }
          try {
            const docPath = generateFilePath(
              user?._id || "",
              doc.file.name,
              "documents",
            );
            const storagePath = await uploadFile("documents", doc.file, docPath);
            uploadedDocs.push({
              storageId: storagePath,
              name: doc.name,
              size: doc.size,
              mime: doc.file.type || undefined,
            });
            filesUploaded++;
            setUploadProgress({ current: filesUploaded, total: totalFiles });
          } catch (err) {
            const message =
              err instanceof Error
                ? err.message
                : "Error al guardar el documento";
            console.error(`Error al subir ${doc.file.name}:`, message);
            toast.error(message);
            throw new Error("doc_upload_failed");
          }
        }
      }

      const contentToSend = textOnly ? html.trim() : "";
      await createPostFn(user?._id || "", contentToSend, {
        title: postTitle.trim() || undefined,
        media: uploaded.length > 0 ? (uploaded as any) : undefined,
        documents: uploadedDocs.length > 0 ? (uploadedDocs as any) : undefined,
        mentions:
          pendingMentions.length > 0 ? (pendingMentions as any) : undefined,
        poll: pollDraft ?? undefined,
      });

      pendingMedia.forEach((pm) => URL.revokeObjectURL(pm.preview));
      setPendingMedia([]);
      setPendingDocs([]);
      setPendingMentions([]);
      setContent("");
      setPostTitle("");
      setShowTitleField(false);
      setPollDraft(null);
      setShowPollComposer(false);
      if (editorRef.current) editorRef.current.innerHTML = "";
      void refreshPosts();
      toast.success("Publicación creada");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "timeout") {
        // already toasted above
      } else if (err instanceof Error && err.message === "media_upload_failed") {
        // already toasted above
      } else if (err instanceof Error && err.message === "doc_upload_failed") {
        // already toasted above
      } else {
        const message =
          err instanceof Error ? err.message : "No se pudo publicar";
        toast.error(message);
        console.error("Error al crear la publicación:", err);
      }
    } finally {
      setUploading(false);
      setPosting(false);
      setUploadState("idle");
    }
  };

  const handleToggleLike = async (postId: string) => {
    try {
      await togglePostLike(user?._id || "", postId);
      void refreshPosts();
    } catch (err) {
      console.error("Error al dar me gusta:", err);
    }
  };

  const handleToggleFollow = useCallback(
    async (targetUserId: string) => {
      if (!user?._id) return;
      try {
        await toggleFollow(user._id, targetUserId);
        setRefreshTick((t) => t + 1);
      } catch (error) {
        console.error("Error toggling follow:", error);
      }
    },
    [user?._id],
  );

  const handleToggleFavorite = async (postId: string) => {
    try {
      await togglePostFavorite(user?._id || "", postId);
      void refreshPosts();
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
      void refreshPosts();
      toast.success("Publicación eliminada");
    } catch (err) {
      console.error("Error al eliminar:", err);
      toast.error("No se pudo eliminar la publicación");
    }
    setDeleteTarget(null);
  };

  const handleConfirmUnfollow = async () => {
    if (!unfollowTarget) return;
    try {
      await toggleFollow(user?._id || "", unfollowTarget.userId);
      void refreshPosts();
      setRefreshTick((t) => t + 1);
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
    const newDocs: PendingDoc[] = arr
      .slice(0, remaining)
      .filter((file) => {
        if (file.size > MAX_DOC_MB * 1024 * 1024) {
          console.warn(`El archivo ${file.name} supera ${MAX_DOC_MB}MB`);
          return false;
        }
        return true;
      })
      .map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        extension: file.name.split(".").pop()?.toUpperCase() ?? "FILE",
      }));
    setPendingDocs((prev) => [...prev, ...newDocs]);
    e.target.value = "";
  };

  const removePendingDoc = useCallback((id: string) => {
    setPendingDocs((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const hasText =
    editorRef.current?.textContent?.trim().length ?? content.trim().length > 0;
  const isPostable =
    hasText ||
    postTitle.trim().length > 0 ||
    pendingMedia.length > 0 ||
    pendingDocs.length > 0 ||
    pollDraft !== null;
  const attachmentCount =
    pendingMedia.length + pendingDocs.length + (pollDraft ? 1 : 0);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      {/* ── Cabecera ─────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 mb-2 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex h-12 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Asternal"
              className="h-7 w-7 rounded-lg object-contain"
            />
            <span className="text-lg font-extrabold tracking-tight text-primary">
              Asternal
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleBellClick}
                title="Notificaciones"
              >
                <Bell className="h-4 w-4" />
              </Button>
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
            {/* La cuenta vive en un menú: cerrar sesión deja de ser un icono
                suelto (y demasiado accesible) en la cabecera. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Menú de cuenta"
                >
                  <Avatar className="h-7 w-7 border border-border/30">
                    {user?.image && (
                      <AvatarImage
                        src={user.image}
                        alt={user.name ?? ""}
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
                      {user?.name ? getInitials(user.name) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => {
                    setCurrentView("profile");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="gap-2 text-sm"
                >
                  <User className="h-3.5 w-3.5" />
                  Mi perfil
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="gap-2 text-sm"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      {/* Notifications panel */}
      <AnimatePresence>
        {notifOpen && (
          <NotificationsPanel
            notifications={notifications}
            loading={notifLoading}
            onClose={() => setNotifOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="mx-auto max-w-2xl px-3 pt-3 pb-20 sm:px-4 sm:pt-5 sm:pb-24">
        <AnimatePresence mode="wait" initial={false}>
          {currentView === "userProfile" &&
          viewingUserId &&
          viewingUserId !== user?._id ? (
            <motion.div
              key="userProfile"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            >
              <UserProfileView
                userId={viewingUserId}
                onBack={() => {
                  setCurrentView("feed");
                  setViewingUserId(null);
                }}
              />
            </motion.div>
          ) : currentView === "profile" || currentView === "userProfile" ? (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            >
              <ProfilePage onBack={() => setCurrentView("feed")} />
            </motion.div>
          ) : currentView === "editor" ? (
            <motion.div
              key="editor"
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0.4 }}
              transition={{ duration: 0.15 }}
            >
              <EditorPlaceholder onBack={() => setCurrentView("feed")} />
            </motion.div>
          ) : (
            <>
              {/* ── Compositor compacto ───────────────────────── */}
              <div
                className="rounded-2xl bg-white p-3.5 shadow-md sm:p-4 dark:bg-slate-900"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9 shrink-0 rounded-full border border-border/30">
                    {user?.image && (
                      <AvatarImage
                        src={user.image}
                        alt={user.name ?? ""}
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary uppercase">
                      {user?.name ? getInitials(user.name) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    {/* Título opcional: oculto hasta que se pide, para que el
                        protagonista sea el contenido. */}
                    {(showTitleField || postTitle.length > 0) && (
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={postTitle}
                          onChange={(e) => setPostTitle(e.target.value)}
                          placeholder="Título (opcional)"
                          maxLength={120}
                          autoFocus
                          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-card-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/60"
                        />
                        {postTitle.length === 0 && (
                          <button
                            type="button"
                            onClick={() => setShowTitleField(false)}
                            className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    )}

                    <div
                      ref={editorRef}
                      contentEditable
                      data-placeholder="¿Qué tienes en mente, jugador?"
                      onInput={handleEditorInput}
                      onKeyDown={handleEditorKeyDown}
                      onPaste={handleEditorPaste}
                      className="min-h-[44px] w-full bg-transparent text-[15px] leading-relaxed text-card-foreground outline-none"
                      style={{ wordBreak: "break-word" }}
                    />

                    {/* Media previews */}
                    {pendingMedia.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <AnimatePresence initial={false}>
                          {pendingMedia.map((pm) => (
                            <motion.div
                              key={pm.id}
                              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                            >
                              <img
                                src={pm.preview}
                                alt={pm.file.name}
                                className="h-full max-h-32 w-full rounded-xl object-cover"
                              />
                              <RemoveButton
                                onClick={() => removePending(pm.id)}
                                label={`Eliminar ${pm.file.name}`}
                              />
                              <div className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                                <ImagePlus className="inline h-3 w-3" />
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
                      <div className="mt-2.5 flex flex-col gap-1.5">
                        {pendingDocs.map((doc) => (
                          <div
                            key={doc.id}
                            className="group relative flex items-center gap-3 rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-10 shadow-sm"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-medium text-card-foreground">
                                {doc.name}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {doc.size < 1024
                                  ? `${doc.size} B`
                                  : doc.size < 1048576
                                    ? `${(doc.size / 1024).toFixed(1)} KB`
                                    : `${(doc.size / 1048576).toFixed(1)} MB`}
                              </div>
                            </div>
                            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                              {doc.extension}
                            </span>
                            <RemoveButton
                              onClick={() => removePendingDoc(doc.id)}
                              label={`Eliminar ${doc.name}`}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Encuesta del compositor */}
                    <AnimatePresence>
                      {showPollComposer && (
                        <div className="mt-2.5">
                          <PollComposer
                            onChange={setPollDraft}
                            onRemove={() => {
                              setPollDraft(null);
                              setShowPollComposer(false);
                            }}
                          />
                        </div>
                      )}
                    </AnimatePresence>

                    {/* Herramientas: adjuntos · encuesta · formato */}
                    <FormatToolbar
                      onAddMedia={() => fileInputRef.current?.click()}
                      onAddDoc={() => docInputRef.current?.click()}
                      onTogglePoll={() => {
                        if (showPollComposer) {
                          setPollDraft(null);
                          setShowPollComposer(false);
                        } else {
                          setShowPollComposer(true);
                        }
                      }}
                      pollActive={showPollComposer || !!pollDraft}
                      mediaDisabled={pendingMedia.length >= MAX_FILES}
                      docDisabled={pendingDocs.length >= MAX_DOCS}
                    />

                    {/* Hidden file inputs */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_IMAGE}
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

                    {/* Fila de publicación */}
                    <div className="mt-2.5 flex items-center gap-2 border-t border-slate-200/80 pt-2.5 dark:border-slate-700">
                      {!showTitleField && postTitle.length === 0 && (
                        <button
                          type="button"
                          onClick={() => setShowTitleField(true)}
                          className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          + Añadir título
                        </button>
                      )}
                      {attachmentCount > 0 && (
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {attachmentCount} adjunto
                          {attachmentCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      {!isPostable && (
                        <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">
                          Escribe algo para publicar
                        </span>
                      )}
                      <Button
                        size="sm"
                        className={
                          "ml-auto gap-1.5 rounded-xl px-5 shadow-sm transition-colors " +
                          (isPostable
                            ? "bg-primary text-primary-foreground hover:brightness-110"
                            : "bg-slate-200 text-slate-400 shadow-none dark:bg-slate-800")
                        }
                        disabled={!isPostable || isBusy}
                        onClick={handlePost}
                      >
                        {isBusy ? (
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        {uploadState === "uploading"
                          ? uploadProgress.total > 1
                            ? `Subiendo ${uploadProgress.current}/${uploadProgress.total}…`
                            : "Subiendo…"
                          : "Publicar"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Pestañas del feed ─────────────────────────── */}
              <div className="mt-4">
                <div className="flex items-stretch border-b border-slate-200/80 dark:border-slate-800">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={`relative flex-1 py-2.5 text-center text-sm transition-colors ${
                        activeTab === tab.id
                          ? "font-bold text-slate-900 dark:text-white"
                          : "font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                      }`}
                    >
                      <span className="relative inline-block">
                        {tab.label}
                        {activeTab === tab.id && (
                          <motion.div
                            layoutId="activeTab"
                            layout="position"
                            className="absolute inset-x-0 -bottom-1 h-[2px] rounded-full bg-primary"
                            transition={{
                              type: "spring",
                              stiffness: 400,
                              damping: 30,
                            }}
                          />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Feed ──────────────────────────────────────── */}
              <div className="mt-4 flex flex-col gap-3.5 sm:mt-5 sm:gap-4">
                {posts === undefined ? null : posts.length === 0 ? (
                  <div className="rounded-2xl bg-white px-5 py-8 shadow-sm dark:bg-slate-900">
                    <div className="flex flex-col items-center text-center">
                      <EmptyStateIcon tab={activeTab} />
                      <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
                        {TAB_EMPTY[activeTab].title}
                      </p>
                      <p className="mt-1 max-w-[17rem] text-[13px] text-slate-500 dark:text-slate-400">
                        {TAB_EMPTY[activeTab].subtitle}
                      </p>

                      {/* Ruta inmediata para salir del estado vacío */}
                      {activeTab === "following" && suggested.length > 0 ? (
                        <div className="mt-4 w-full max-w-xs">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Personas sugeridas
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {suggested.map((u) => (
                              <div
                                key={u._id}
                                className="flex items-center gap-3 rounded-xl border border-border/40 px-3 py-2 text-left"
                              >
                                <Avatar className="h-8 w-8 shrink-0 border border-border/30">
                                  {u.image && (
                                    <AvatarImage
                                      src={u.image}
                                      alt={u.name}
                                      className="object-cover"
                                    />
                                  )}
                                  <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                                    {getInitials(u.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="min-w-0 flex-1 truncate text-xs font-medium text-card-foreground">
                                  {u.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => void handleToggleFollow(u._id)}
                                  className="shrink-0 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                                >
                                  Seguir
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-4 rounded-xl"
                          onClick={() => {
                            if (activeTab === "popular") {
                              setActiveTab("forYou");
                            } else if (activeTab === "following") {
                              setActiveTab("popular");
                            } else {
                              editorRef.current?.focus();
                            }
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          {TAB_EMPTY[activeTab].cta}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div key={activeTab} className="flex flex-col gap-3.5 sm:gap-4">
                    {posts.map((post, idx) => (
                      <PostCard
                        key={post._id}
                        post={{
                          ...post,
                          authorImageUrl:
                            (post as any).authorImageUrl ?? undefined,
                          documentUrls: (post as any).documentUrls ?? [],
                          hashtags: (post as any).hashtags ?? [],
                        }}
                        currentUserId={user?._id}
                        onToggleLike={handleToggleLike}
                        onToggleFavorite={handleToggleFavorite}
                        onFollow={(userId) => handleToggleFollow(userId)}
                        onRequestUnfollow={(userId, name) =>
                          setUnfollowTarget({ userId, name })
                        }
                        onRequestDelete={setDeleteTarget}
                        onOpenLightbox={openLightbox}
                        onOpenComments={setCommentsModalPost}
                        onOpenProfile={(userId) => {
                          // Si es MI propio perfil, abre EXACTAMENTE la misma
                          // pantalla que la pestaña Perfil (ProfilePage).
                          if (user?._id && userId === user._id) {
                            setViewingUserId(null);
                            setCurrentView("profile");
                          } else {
                            setViewingUserId(userId);
                            setCurrentView("userProfile");
                          }
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        isAdmin={isAdmin}
                        postNumber={posts.length - idx}
                        refreshTick={refreshTick}
                      />
                    ))}
                  </div>
                )}
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
      <UnfollowConfirmModal
        open={unfollowTarget !== null}
        username={unfollowTarget?.name ?? ""}
        onConfirm={handleConfirmUnfollow}
        onCancel={() => setUnfollowTarget(null)}
      />

      {/* ── Navegación inferior: 3 elementos, compacta ────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200/70 bg-white/95 shadow-[0_-6px_20px_-10px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-2xl items-center gap-1.5 px-3 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5">
          <button
            type="button"
            aria-label="Inicio"
            title="Inicio"
            onClick={() => {
              setCurrentView("feed");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={
              "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm transition-colors " +
              (currentView === "feed"
                ? "bg-primary/10 font-semibold text-primary"
                : "font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200")
            }
          >
            <Home className="h-[18px] w-[18px]" />
            <span>Inicio</span>
          </button>

          <button
            type="button"
            aria-label="Abrir el editor de juegos"
            title="Abrir el editor de juegos"
            onClick={() => navigate("/editor")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-[3px] ring-white transition-transform hover:scale-105 active:scale-95 dark:ring-slate-950"
          >
            <Plus className="h-5 w-5" strokeWidth={2.25} />
          </button>

          <button
            type="button"
            aria-label="Perfil"
            title="Perfil"
            onClick={() => {
              setCurrentView("profile");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={
              "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm transition-colors " +
              (currentView === "profile"
                ? "bg-primary/10 font-semibold text-primary"
                : "font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200")
            }
          >
            <User className="h-[18px] w-[18px]" />
            <span>Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
