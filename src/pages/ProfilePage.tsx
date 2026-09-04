// ▶ [MIGRACIÓN LOVABLE CLOUD] Esta página usa @/lib/db, que ahora
// funciona 100% en el dispositivo, sin sincronización remota.
// Al migrar a Lovable Cloud, @/lib/db se reconecta al backend.
import { useState, useRef, useCallback, useEffect } from "react";
import { PostPoll } from "@/components/PostPoll";
import {
  updateProfile,
  uploadFile,
  generateFilePath,
  getStorageUrl,
  getUserProfile,
  getFollowStats,
  getFollowers,
  getFollowing,
} from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Camera,
  Check,
  User,
  MoreHorizontal,
  Pencil,
  X,
  Play,
  Share2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Format large numbers in Spanish */
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

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface ProfilePageProps {
  onBack: () => void;
}

export default function ProfilePage({ onBack }: ProfilePageProps) {
  const { user } = useAuth();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<any[] | undefined>(undefined);
  
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?._id) return;
      try {
        const data = await getUserProfile(user._id, user._id);
        setCurrentUser(data);
        setUserPosts(data?.posts || []);
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };
    fetchProfile();
  }, [user?._id]);

  // Inline edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editBio, setEditBio] = useState("");

  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [savedTitle, setSavedTitle] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [savedBio, setSavedBio] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEnterEdit = () => {
    setEditName((currentUser as any)?.name ?? user?.name ?? "");
    setEditTitle((currentUser as any)?.title ?? "");
    setEditBio((currentUser as any)?.bio ?? "");
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setSavedName(false);
    setSavedTitle(false);
    setSavedBio(false);
  };

  const handleSaveName = async () => {
    const currentName = (currentUser as any)?.name || user?.name || "";
    if (!editName.trim() || editName.trim() === currentName || savingName) return;
    setSavingName(true);
    try {
      await updateProfile(user?._id || '', { name: editName.trim() });
      setCurrentUser((prev: any) => ({ ...(prev || {}), name: editName.trim() }));
      setSavedName(true);
      setTimeout(() => setSavedName(false), 2000);
    } catch (err) {
      console.error("Error al actualizar nombre:", err);
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveTitle = async () => {
    const currentTitle = (currentUser as any)?.title ?? "";
    if (editTitle === currentTitle || savingTitle) return;
    setSavingTitle(true);
    try {
      await updateProfile(user?._id || '', { title: editTitle.trim() || undefined });
      setCurrentUser((prev: any) => ({ ...(prev || {}), title: editTitle.trim() }));
      setSavedTitle(true);
      setTimeout(() => setSavedTitle(false), 2000);
    } catch (err) {
      console.error("Error al actualizar título:", err);
    } finally {
      setSavingTitle(false);
    }
  };

  const handleSaveBio = async () => {
    const currentBio = (currentUser as any)?.bio ?? "";
    if (editBio === currentBio || savingBio) return;
    setSavingBio(true);
    try {
      await updateProfile(user?._id || '', { bio: editBio.trim() || undefined });
      setCurrentUser((prev: any) => ({ ...(prev || {}), bio: editBio.trim() }));
      setSavedBio(true);
      setTimeout(() => setSavedBio(false), 2000);
    } catch (err) {
      console.error("Error al actualizar bio:", err);
    } finally {
      setSavingBio(false);
    }
  };

  const handleAvatarUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || savingAvatar) return;
      if (!file.type.startsWith("image/")) return;
      if (file.size > 5 * 1024 * 1024) return;
      setSavingAvatar(true);
      try {
        const path = generateFilePath(user?._id || '', file.name, 'avatars');
        await uploadFile('avatars', file, path);
        await updateProfile(user?._id || '', { image: path });
        // Sincronización inmediata del avatar
        setCurrentUser((prev: any) => ({
          ...(prev || {}),
          image: path,
          avatarUrl: getStorageUrl('avatars', path),
        }));
      } catch (err) {
        console.error("Error al subir avatar:", err);
      } finally {
        setSavingAvatar(false);
        e.target.value = "";
      }
    },
    [savingAvatar, updateProfile, user?._id],
  );

  const currentTitle = (currentUser as any)?.title ?? "";
  const currentBio = (currentUser as any)?.bio ?? "";
  const displayName = (currentUser as any)?.name || user?.name || "Sin nombre";

  const [followStats, setFollowStats] = useState<{ followers: number; following: number } | undefined>(undefined);
  useEffect(() => {
    const fetchStats = async () => {
      if (!user?._id) return;
      try {
        const data = await getFollowStats(user._id);
        setFollowStats(data);
      } catch (error) {
        console.error("Error fetching follow stats:", error);
      }
    };
    fetchStats();
  }, [user?._id]);
  const [showFollowList, setShowFollowList] = useState<"followers" | "following" | null>(null);

  const stagger = (i: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay: i * 0.06, ease: [0.32, 0.72, 0, 1] as const },
  });

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold">
            {editing ? "Editar perfil" : "Mi perfil"}
          </span>
        </div>

        {editing ? (
          <button
            type="button"
            onClick={handleCancelEdit}
            className="flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancelar
          </button>
        ) : (
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
              <DropdownMenuItem onClick={handleEnterEdit} className="gap-2 text-sm">
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast("Esta función estará disponible próximamente")}
                className="gap-2 text-sm"
              >
                <Share2 className="h-3.5 w-3.5" />
                Compartir perfil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* ── Card 1: Avatar + Name + Title + Follow Stats ──────── */}
      <motion.div {...stagger(0)} className="rounded-2xl border border-border/60 bg-card px-5 py-7 sm:px-7 sm:py-9">
        <div className="flex flex-col items-center gap-4">
          {/* Avatar */}
          <div className="relative">
            <Avatar className="h-24 w-24 border-2 border-border/50">
              {currentUser?.avatarUrl && <AvatarImage src={currentUser.avatarUrl} alt={displayName} />}
              <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
                {displayName !== "Sin nombre" ? getInitials(displayName) : <User className="h-10 w-10" />}
              </AvatarFallback>
            </Avatar>
            {editing && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={savingAvatar}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                {savingAvatar ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          {/* Name */}
          {editing ? (
            <div className="flex h-10 w-full max-w-sm items-center gap-2.5">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={40}
                placeholder="Tu nombre"
                className="h-10 flex-1 rounded-xl border border-border/60 bg-background px-3 text-sm text-card-foreground text-center outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={handleSaveName}
                disabled={!editName.trim() || editName.trim() === (user?.name ?? "") || savingName}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
              >
                {savingName ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </button>
            </div>
          ) : (
            <div className="flex h-10 w-full max-w-sm items-center justify-center">
              <p className="truncate text-xl font-extrabold tracking-tight text-card-foreground">{displayName}</p>
            </div>
          )}

          {/* Title */}
          {editing ? (
            <div className="flex h-10 w-full max-w-sm items-center gap-2.5">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={60}
                placeholder="Título (opcional)"
                className="h-10 flex-1 rounded-xl border border-border/60 bg-background px-3 text-sm text-card-foreground text-center outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                disabled={editTitle === ((currentUser as any)?.title ?? "") || savingTitle}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
              >
                {savingTitle ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </button>
            </div>
          ) : currentTitle ? (
            <div className="flex w-full max-w-sm items-center justify-center">
              <p className="truncate text-sm font-medium italic text-primary/80">{currentTitle}</p>
            </div>
          ) : null}

          {/* Separator */}
          <div className="h-px w-14 bg-border/50" />

          {/* Follow Stats — always rendered to prevent layout shift */}
          <div className="flex items-center gap-6 text-sm" style={{ minHeight: 40 }}>
            {followStats ? (
              <>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  onClick={() => setShowFollowList("followers")}
                  className="flex flex-col items-center gap-0.5"
                >
                  <motion.span
                    key={followStats.followers}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="text-lg font-bold tabular-nums text-card-foreground"
                  >{formatCount(followStats.followers)}</motion.span>
                  <span className="text-[11px] text-muted-foreground">seguidores</span>
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  onClick={() => setShowFollowList("following")}
                  className="flex flex-col items-center gap-0.5"
                >
                  <motion.span
                    key={followStats.following}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="text-lg font-bold tabular-nums text-card-foreground"
                  >{formatCount(followStats.following)}</motion.span>
                  <span className="text-[11px] text-muted-foreground">siguiendo</span>
                </motion.button>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="h-5 w-8 animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-14 animate-pulse rounded bg-muted" />
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="h-5 w-8 animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-12 animate-pulse rounded bg-muted" />
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Card 2: Bio / Descripción ───────────────────────── */}
      <motion.div {...stagger(1)} className="mt-3">
        <div className="rounded-2xl border border-border/60 bg-card px-5 py-4 sm:px-7 sm:py-5">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descripción</h3>
            {editing && <Pencil className="h-3 w-3 text-muted-foreground" />}
          </div>
          {editing ? (
            <div>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                maxLength={200}
                rows={4}
                placeholder="Escribe algo sobre ti…"
                className="w-full min-h-[100px] resize-none rounded-xl border border-border/60 bg-background px-4 py-3 text-sm text-card-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground tabular-nums">{editBio.length}/200</span>
                <Button
                  size="sm"
                  className="gap-1.5 px-4"
                  disabled={editBio === ((currentUser as any)?.bio ?? "") || savingBio}
                  onClick={handleSaveBio}
                >
                  {savingBio ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : savedBio ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : null}
                  {savedBio ? "Guardado" : "Guardar"}
                </Button>
              </div>
            </div>
          ) : currentBio ? (
            <p className="text-sm text-muted-foreground leading-relaxed">{currentBio}</p>
          ) : (
            <p className="text-sm text-muted-foreground/50 italic">Sin descripción</p>
          )}
        </div>
      </motion.div>

      {/* ── Section: Mis publicaciones ──────────────────────── */}
      {userPosts && userPosts.length > 0 && (
        <motion.div {...stagger(3)} className="mt-6">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mis publicaciones</p>
          </div>
          <div className="flex flex-col gap-4">
            {userPosts.map((post) => (
              <div key={post._id} className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
                {post.title && <p className="mb-1 text-sm font-bold text-card-foreground">{post.title}</p>}
                <div className="text-[15px] leading-relaxed text-card-foreground" dangerouslySetInnerHTML={{ __html: post.content || "" }} />
                {/* PARTE 5 · ENCUESTAS: también visibles en «Mis publicaciones». */}
                {post.poll && (
                  <div className="mt-3">
                    <PostPoll poll={post.poll} userId={user?._id} />
                  </div>
                )}
                {post.mediaUrls && post.mediaUrls.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {post.mediaUrls.map((m: { url: string; type: string }, i: number) =>
                      m.type === "video" ? (
                        <div key={i} className="relative h-28 w-full rounded-xl overflow-hidden bg-muted">
                          <video
                            src={m.url}
                            className="h-full w-full object-contain"
                            muted
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/90">
                              <Play className="ml-0.5 h-3.5 w-3.5" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <img key={i} src={m.url} alt="" className="h-28 w-full rounded-xl object-cover" />
                      ),
                    )}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {post.likes} me gusta · {post.favorites} favoritos
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {showFollowList && user?._id && (
          <FollowListModalInline
            userId={user._id}
            type={showFollowList}
            onClose={() => setShowFollowList(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Follow list modal (inline version for ProfilePage) ─────────────
function FollowListModalInline({
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
      if (!userId) return;
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
