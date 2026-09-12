// ═══════════════════════════════════════════════════════════════════
// Widgets del feed social: publicaciones, menciones, comentarios,
// seguidores y notificaciones (extraído de Dashboard.tsx).
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  FileText,
  Heart,
  MessageCircle,
  Reply,
  Search,
  Send,
  Share2,
  Star,
  Trash2,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/FollowButton";
import ProfileLayout from "@/components/ProfileLayout";
import { PostPoll, type PollViewData } from "@/components/PostPoll";
import { useAuth } from "@/hooks/use-auth";
import {
  createComment,
  deleteComment,
  getComments,
  getFollowers,
  getFollowing,
  isFollowing,
  searchUsers,
  toggleCommentLike,
  toggleFollow,
} from "@/lib/db";
import { MediaGrid } from "./editor-widgets";
import {
  formatTime,
  getInitials,
  sanitizePostHtml,
  type DocumentUrl,
  type LightboxItem,
  type MentionUser,
} from "./shared";

// ── Comment item ───────────────────────────────────────────────────
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
    <div className={depth > 0 ? "ml-6 border-l-2 border-border/24 pl-4" : ""}>
      <div className="flex items-start gap-2.5 py-2.5">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-muted text-[10px] font-semibold">
            {getInitials(comment.authorName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">{comment.authorName}</span>
            <span className="text-[10px] text-muted-foreground">
              {formatTime(comment.createdAt)}
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-card-foreground">
            {comment.content}
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              onClick={async () => {
                if (currentUserId)
                  await toggleCommentLike(currentUserId, comment._id);
              }}
              className={`flex items-center gap-1 text-[10px] transition-colors ${
                comment.likedByMe
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              <motion.span
                key={`${comment.likedByMe}-${comment._id}`}
                animate={comment.likedByMe ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <Heart
                  className={`h-3 w-3 transition-colors duration-150 ${comment.likedByMe ? "fill-primary text-primary" : "fill-transparent"}`}
                />
              </motion.span>
              {comment.likes > 0 && (
                <span className="tabular-nums">{comment.likes}</span>
              )}
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
          className="ml-4 mt-1 overflow-hidden rounded-xl border border-border/24 bg-muted/20 pl-3 pr-1 py-1 sm:ml-6"
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
              className="mx-4 w-full max-w-xs rounded-2xl border border-border/35 bg-card p-5 shadow-xl"
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                >
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

// ── Post card ──────────────────────────────────────────────────────
export function PostCard({
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
  refreshTick = 0,
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
    poll?: PollViewData | null;
  };
  currentUserId?: string;
  onToggleLike: (postId: string) => void;
  onToggleFavorite: (postId: string) => void;
  onFollow: (userId: string) => void;
  onRequestUnfollow: (userId: string, name: string) => void;
  onRequestDelete: (postId: string) => void;
  isAdmin?: boolean;
  onOpenLightbox: (media: LightboxItem[], index: number) => void;
  onOpenComments: (post: {
    _id: string;
    authorId: string;
    title?: string;
    content: string;
    createdAt: number;
    authorName: string;
    mediaUrls: LightboxItem[];
    postNumber: number;
  }) => void;
  onOpenProfile: (userId: string) => void;
  postNumber?: number;
  /** Sube cuando el feed se refresca: re-chequea Seguir/Siguiendo. */
  refreshTick?: number;
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
      if (!currentUserId || !post.authorId || post.authorId === currentUserId)
        return;
      try {
        const data = await isFollowing(currentUserId, post.authorId);
        setIsFollowingUser(data);
      } catch (error) {
        console.error("Error checking follow status:", error);
      }
    };
    checkFollow();
  }, [currentUserId, post.authorId, refreshTick]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden rounded-2xl bg-white shadow-md transition-shadow duration-300 ease-out hover:shadow-lg dark:bg-slate-900"
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-3.5">
          <button
            type="button"
            onClick={() => onOpenProfile(post.authorId)}
            className="shrink-0 cursor-pointer"
          >
            <Avatar className="h-10 w-10 border border-border/30">
              {(post as any).authorImageUrl && (
                <AvatarImage
                  src={(post as any).authorImageUrl}
                  alt={post.authorName}
                  className="object-cover"
                />
              )}
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {getInitials(post.authorName)}
              </AvatarFallback>
            </Avatar>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenProfile(post.authorId)}
                className="text-sm font-semibold hover:underline cursor-pointer"
              >
                {post.authorName}
              </button>
              <span className="text-xs text-muted-foreground">
                {formatTime(post.createdAt)}
              </span>
              {currentUserId && post.authorId !== currentUserId && (
                <div className="ml-auto">
                  <FollowButton
                    isFollowing={isFollowingUser}
                    onFollow={() => {
                      onFollow(post.authorId);
                      setIsFollowingUser(true);
                    }}
                    onUnfollowRequest={() =>
                      onRequestUnfollow(post.authorId, post.authorName)
                    }
                  />
                </div>
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
            {/* PARTE 5 · ENCUESTAS: encuesta publicada en la tarjeta.
                Votos anónimos: solo se muestra el recuento por opción. */}
            {post.poll && (
              <div className="mt-3">
                <PostPoll poll={post.poll} userId={currentUserId} />
              </div>
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
        <div className="px-4 pb-3 pt-3 sm:px-5 sm:pt-4 border-t border-border/24">
          <div className="flex flex-col gap-2">
            {post.documentUrls.map((doc, i) => {
              const ext = doc.name.split(".").pop()?.toUpperCase() ?? "FILE";
              const sizeStr =
                doc.size < 1024
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
            {/* Sin «Me gusta» cuando no se ha dado like: solo el ícono. */}
            {post.likes > 0 && (
              <span className="tabular-nums">{post.likes}</span>
            )}
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
              <Star
                className={`h-4 w-4 transition-colors duration-150 ${post.favoritedByMe ? "fill-yellow-500" : "fill-transparent"}`}
              />
            </motion.span>
            {post.favorites > 0 && (
              <span className="tabular-nums">{post.favorites}</span>
            )}
          </motion.button>
          {/* Share */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            onClick={() => toast("Esta función estará disponible próximamente")}
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
      <div className="border-t border-border/30 px-4 py-2 sm:px-5">
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          whileHover={{ backgroundColor: "var(--muted)" }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          onClick={() => onOpenComments({ ...post, postNumber: postNumber ?? 0 })}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          {commentCount > 0
            ? `Ver ${commentCount} comentario${commentCount > 1 ? "s" : ""}`
            : "Escribe un comentario…"}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Mention Picker Modal ──────────────────────────────────────
export function MentionPicker({
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
    return () => {
      document.body.style.overflow = prev;
    };
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
      <div className="flex items-center gap-3 border-b border-border/30 bg-background px-4 py-3">
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
      <div className="border-b border-border/24 px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-muted/50 px-3 py-2 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20">
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
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground hover:text-foreground"
            >
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
                  <Avatar className="h-9 w-9 shrink-0 border border-border/30">
                    {u.image ? (
                      <img
                        src={u.image}
                        alt={u.name}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                        {getInitials(u.name)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <span className="text-sm font-medium text-card-foreground">
                    {u.name}
                  </span>
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
export function CommentsModal({
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

  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(
    null,
  );
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);

  const topLevelComments = comments.filter((c) => !c.parentCommentId);
  const commentCount = comments.length;

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
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
      await createComment(
        pid,
        currentUserId || "",
        commentText.trim(),
        replyTo?.id || undefined,
      );
      setCommentText("");
      setReplyTo(null);
      requestAnimationFrame(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
      const data = await getComments(post._id);
      setComments(data);
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
      <div className="border-b border-border/30 bg-background px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <Avatar className="h-9 w-9 shrink-0 border border-border/30">
            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
              {getInitials(post.authorName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            {post.title ? (
              <h3 className="truncate text-sm font-bold text-card-foreground">
                {post.title}
              </h3>
            ) : (
              <h3 className="truncate text-sm font-semibold text-card-foreground">
                {post.authorName}
              </h3>
            )}
            <p className="text-[10px] text-muted-foreground">
              Publicación n.º {post.postNumber} · {post.authorName} ·{" "}
              {formatTime(post.createdAt)} · {commentCount} comentario
              {commentCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5">
        {topLevelComments.length > 0 && (
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Comentarios
          </p>
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
                  className="rounded-xl border border-border/24 bg-card/50 px-3 py-2"
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
      <div className="border-t border-border/30 bg-background px-4 py-3 sm:px-5">
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
                Respondiendo a{" "}
                <span className="font-medium text-foreground">
                  {replyTo.name}
                </span>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="ml-auto flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleComment();
                }
              }}
              placeholder={
                replyTo ? "Escribe una respuesta…" : "Escribe un comentario…"
              }
              className="min-h-[36px] w-full rounded-xl border border-border/30 bg-muted/50 px-3 py-2 text-xs text-card-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
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
type FollowListUser = {
  _id: string;
  name: string;
  imageUrl?: string | null;
};

export function FollowListModal({
  userId,
  type,
  onClose,
  currentUserId,
}: {
  userId: string;
  type: "followers" | "following";
  onClose: () => void;
  currentUserId?: string;
}) {
  const [list, setList] = useState<FollowListUser[]>([]);
  const [inFlight, setInFlight] = useState<Set<string>>(new Set());
  const [listStats, setListStats] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchList = async () => {
      try {
        const data =
          type === "followers"
            ? await getFollowers(userId)
            : await getFollowing(userId);
        setList(data as FollowListUser[]);
      } catch (error) {
        console.error("Error fetching follow list:", error);
      }
    };
    fetchList();
  }, [type, userId]);

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
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isFollowingUser = (targetId: string) => {
    if (!currentUserId) return false;
    return listStats[targetId] ?? false;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[95] flex flex-col bg-background"
    >
      <div className="border-b border-border/30 bg-background px-4 py-3">
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
        {list.length === 0 ? (
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
            {list.map((u) => {
              const following = isFollowingUser(u._id);
              const busy = inFlight.has(u._id);
              return (
                <div key={u._id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar className="h-10 w-10 shrink-0 border border-border/30">
                    {u.imageUrl && (
                      <AvatarImage
                        src={u.imageUrl}
                        alt={u.name}
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {getInitials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-card-foreground">
                    {u.name}
                  </span>
                  {currentUserId && currentUserId !== u._id && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (!currentUserId) return;
                        setInFlight((prev) => new Set(prev).add(u._id));
                        toggleFollow(currentUserId, u._id)
                          .then((nowFollowing) => {
                            setListStats((prev) => ({
                              ...prev,
                              [u._id]: nowFollowing,
                            }));
                            setInFlight((prev) => {
                              const next = new Set(prev);
                              next.delete(u._id);
                              return next;
                            });
                          })
                          .catch((error) => {
                            console.error(
                              "Error toggling follow in list:",
                              error,
                            );
                            setInFlight((prev) => {
                              const next = new Set(prev);
                              next.delete(u._id);
                              return next;
                            });
                          });
                      }}
                      className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
                        following
                          ? "border border-slate-300 text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      {busy ? "…" : following ? "Siguiendo" : "Seguir"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Tabs del feed ──────────────────────────────────────────────
export const TABS: {
  id: "forYou" | "following" | "popular";
  label: string;
}[] = [
  { id: "forYou", label: "Para ti" },
  { id: "following", label: "Seguidos" },
  { id: "popular", label: "Tendencias" },
];

// ═══════════════════════════════════════════════════════════════════
// Notifications panel
// ═══════════════════════════════════════════════════════════════════
const NOTIFICATION_GROUPS: { type: string; label: string; icon: any }[] = [
  { type: "like", label: "Me gusta", icon: Heart },
  { type: "favorite", label: "Favoritos", icon: Star },
  { type: "comment", label: "Comentarios", icon: MessageCircle },
  { type: "reply", label: "Respuestas", icon: Reply },
  { type: "follow", label: "Nuevos seguidores", icon: UserPlus },
];

function notificationMessage(n: any): string {
  switch (n.type) {
    case "like":
      return `${n.actorName} le dio me gusta a tu publicación`;
    case "favorite":
      return `${n.actorName} guardó tu publicación en favoritos`;
    case "comment":
      return `${n.actorName} comentó tu publicación`;
    case "reply":
      return `${n.actorName} respondió a tu comentario`;
    case "follow":
      return `${n.actorName} comenzó a seguirte`;
    default:
      return `${n.actorName} interactuó contigo`;
  }
}

export function NotificationsPanel({
  notifications,
  loading,
  onClose,
}: {
  notifications: any[];
  loading: boolean;
  onClose: () => void;
}) {
  const groups = NOTIFICATION_GROUPS.map((group) => ({
    ...group,
    items: notifications.filter((n) => n.type === group.type),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/10"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        className="fixed right-3 top-14 z-50 flex max-h-[70vh] w-[calc(100%-1.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border/35 bg-card shadow-lift"
      >
        <div className="flex items-center justify-between border-b border-border/24 px-4 py-3">
          <h3 className="text-sm font-bold text-card-foreground">
            Notificaciones
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-7 w-7 text-muted-foreground/30" />
              <p className="mt-3 text-xs text-muted-foreground">
                No tienes notificaciones todavía.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {groups.map((group, gi) => (
                <div key={group.type}>
                  {gi > 0 && <div className="h-px bg-border/40" />}
                  <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
                    <group.icon className="h-3 w-3 text-primary" />
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </h4>
                    <span className="ml-auto text-[10px] text-muted-foreground/60 tabular-nums">
                      {group.items.length}
                    </span>
                  </div>
                  <div className="px-2 pb-2">
                    {group.items.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/40"
                      >
                        <Avatar className="h-8 w-8 shrink-0 border border-border/30">
                          {n.actorImageUrl && (
                            <AvatarImage
                              src={n.actorImageUrl}
                              alt={n.actorName ?? ""}
                              className="object-cover"
                            />
                          )}
                          <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                            {getInitials(n.actorName ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs leading-relaxed text-card-foreground">
                            {notificationMessage(n)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {formatTime(new Date(n.created_at).getTime())}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// User Profile View (viewing another user's profile)
// ═══════════════════════════════════════════════════════════════════
export function UserProfileView({
  userId,
  onBack,
}: {
  userId: string;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const isOwn = !!user?._id && user._id === userId;
  // Usa el mismo layout base que Mi perfil — 100% identico visualmente
  return (
    <ProfileLayout
      profileUserId={userId}
      currentUserId={user?._id}
      isOwnProfile={isOwn}
      onBack={onBack}
    />
  );
}

// ── Profile/skeleton placeholder used during navigation ─────────────
export function ProfileSkeleton({ style }: { style?: React.CSSProperties }) {
  return (
    <div className="flex flex-col gap-4" style={style}>
      <div className="rounded-2xl border border-border/35 bg-card p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-24 w-24 animate-pulse rounded-full border-2 border-border/30 bg-muted" />
          <div className="flex flex-col items-center gap-2">
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-20 animate-pulse rounded bg-muted/70" />
          </div>
          <div className="h-px w-16 bg-border/60" />
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-1.5">
              <div className="h-5 w-8 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-14 animate-pulse rounded bg-muted/70" />
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div className="flex flex-col items-center gap-1.5">
              <div className="h-5 w-8 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-12 animate-pulse rounded bg-muted/70" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
