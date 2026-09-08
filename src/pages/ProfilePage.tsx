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
  toggleFollow,
} from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Camera,
  User,
  MoreHorizontal,
  X,
  Check,
  MessageCircle,
  Heart,
  FileText,
  Play,
  Share2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

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

async function fetchProfile(userId: string, setter: (v: any) => void, postsSetter: (v: any[]) => void) {
  try {
    const data = await getUserProfile(userId, userId);
    setter(data);
    postsSetter(data?.posts || []);
  } catch (error) {
    console.error("Error fetching profile:", error);
  }
}

interface ProfilePageProps {
  onBack: () => void;
}

type ProfileTab = "posts" | "replies" | "likes";

export default function ProfilePage({ onBack }: ProfilePageProps) {
  const { user } = useAuth();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<any[] | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");

  useEffect(() => {
    if (!user?._id) return;
    fetchProfile(user._id, setCurrentUser, setUserPosts);
  }, [user?._id]);

  // Follow stats
  const [followStats, setFollowStats] = useState<{
    followers: number;
    following: number;
  } | undefined>(undefined);
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

  const [showEditModal, setShowEditModal] = useState(false);

  const [showFollowList, setShowFollowList] = useState<
    "followers" | "following" | null
  >(null);

  const displayName = (currentUser?.name as string | undefined) ?? user?.name ?? "Sin nombre";

  return (
    <div className="pb-8">
      {/* Header — único nivel, sin duplicar la barra superior */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold">Mi perfil</span>
        </div>

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
              onClick={() => toast("Esta función estará disponible próximamente")}
              className="gap-2 text-sm"
            >
              <Share2 className="h-3.5 w-3.5" />
              Compartir perfil
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Banner + Avatar + Name + Title + Bio + Follow stats ─── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-sm"
      >
        {/* Banner + Avatar */}
        <div className="relative mx-auto h-36 w-full overflow-hidden rounded-b-2xl bg-muted">
          {currentUser?.bannerUrl ? (
            <img
              src={currentUser.bannerUrl}
              alt="Banner del perfil"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300" />
          )}
          <Avatar className="absolute -bottom-8 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full border-2 border-white bg-card shadow-md ring-1 ring-border/30">
            {currentUser?.avatarUrl && (
              <AvatarImage
                src={currentUser.avatarUrl}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            )}
            <AvatarFallback className="flex h-full w-full items-center justify-center bg-primary/10 text-2xl font-bold text-primary">
              {displayName !== "Sin nombre"
                ? getInitials(displayName)
                : <User className="h-10 w-10" />}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Nombre + botón editar (solo propio perfil) */}
        <div className="flex flex-col items-center gap-2 px-4 pt-10">
          <p className="text-xl font-extrabold tracking-tight text-card-foreground text-center">
            {displayName}
          </p>

          {(currentUser?.title as string | undefined) && (
            <p className="text-sm font-medium italic text-primary/80 text-center">
              {(currentUser?.title as string | undefined) || ""}
            </p>
          )}

          {/* Biografía */}
          {(currentUser?.bio as string | undefined) && (
            <p className="text-sm text-slate-600 text-center leading-relaxed mt-2">
              {(currentUser?.bio as string | undefined) || ""}
            </p>
          )}

          {/* Botón Editar perfil — solo propio perfil, visible directamente */}
          {user?._id && (
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="mt-2 border border-slate-300 rounded-full px-4 py-1.5 text-sm font-medium transition-colors hover:bg-slate-100"
            >
              Editar perfil
            </button>
          )}
        </div>

        {/* Stats (seguidos / seguidores) */}
        <div className="mt-6 flex items-center justify-center gap-6 text-sm">
          <button
            type="button"
            onClick={() => setShowFollowList("followers")}
            className="flex flex-col items-center gap-0.5 transition-colors hover:text-foreground"
          >
            <span className="text-lg font-bold tabular-nums text-card-foreground">
              {formatCount(followStats?.followers ?? 0)}
            </span>
            <span className="text-[11px] text-muted-foreground">seguidores</span>
          </button>
          <button
            type="button"
            onClick={() => setShowFollowList("following")}
            className="flex flex-col items-center gap-0.5 transition-colors hover:text-foreground"
          >
            <span className="text-lg font-bold tabular-nums text-card-foreground">
              {formatCount(followStats?.following ?? 0)}
            </span>
            <span className="text-[11px] text-muted-foreground">siguiendo</span>
          </button>
        </div>
      </motion.div>

      {/* ── Pestañas inferior de contenido del usuario ──────────── */}
      <div className="mt-6 flex border-b border-border/30">
        {([
          ["posts", "Publicaciones"],
          ["replies", "Respuestas"],
          ["likes", "Me gusta"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-3 text-center text-sm transition-colors ${
              activeTab === id
                ? "border-b-2 border-primary text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Contenido de cada pestaña ─────────────────────────── */}
      <div className="mt-4">
        {activeTab === "posts" && (
          <ProfileTabContent
            posts={userPosts ?? []}
            currentUserId={user?._id}
            renderPost={(post) => (
              <div
                key={post._id}
                className="rounded-2xl border border-border/35 bg-card p-4 sm:p-5"
              >
                {post.title && (
                  <p className="mb-1 text-sm font-bold text-card-foreground">
                    {post.title}
                  </p>
                )}
                <div className="text-[15px] leading-relaxed text-card-foreground">
                  <span
                    dangerouslySetInnerHTML={{
                      __html: post.content || "",
                    }}
                  />
                </div>
                {post.poll && (
                  <div className="mt-3">
                    <PostPoll poll={post.poll} userId={user?._id} />
                  </div>
                )}
                {post.mediaUrls && post.mediaUrls.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {post.mediaUrls.map(
                      ({ url, type }: { url: string; type: string }, i: number) =>
                        type === "video" ? (
                          <div
                            key={i}
                            className="relative h-28 w-full rounded-xl overflow-hidden bg-muted"
                          >
                            <video
                              src={url}
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
                          <img
                            key={i}
                            src={url}
                            alt=""
                            className="h-28 w-full rounded-xl object-cover"
                          />
                        ),
                    )}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {post.likes} me gusta · {post.favorites} favoritos
                </p>
              </div>
            )}
          />
        )}

        {activeTab === "replies" && (
          <ProfileEmptyState
            icon={<MessageCircle className="h-6 w-6 text-muted-foreground/40" />}
            title="No hay respuestas aún"
            subtitle="Cuando respondas a otras publicaciones, aparecerán aquí."
          />
        )}

        {activeTab === "likes" && (
          <ProfileEmptyState
            icon={<Heart className="h-6 w-6 text-muted-foreground/40" />}
            title="No hay publicaciones favoritas"
            subtitle="Los posts que marques como favoritos aparecerán aquí."
          />
        )}
      </div>

      {/* ── Seguidores / Siguiendo ─────────────────────────────── */}
      <AnimatePresence>
        {showFollowList && user?._id && (
          <FollowListModalInline
            userId={user._id}
            type={showFollowList}
            onClose={() => setShowFollowList(null)}
            currentUserId={user._id}
          />
        )}
      </AnimatePresence>

      {/* ── Modal de edición de perfil ─────────────────────────── */}
      <AnimatePresence>
        {showEditModal && user?._id && (
          <EditProfileModal
            currentUser={currentUser}
            user={user}
            onClose={() => setShowEditModal(false)}
            onSaved={() => {
              setShowEditModal(false);
              void fetchProfile(user._id, setCurrentUser, setUserPosts);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileEmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon}
      <p className="mt-3 text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground/70">{subtitle}</p>
    </div>
  );
}

function ProfileTabContent({
  posts,
  currentUserId,
  renderPost,
}: {
  posts: any[];
  currentUserId?: string;
  renderPost: (post: any) => React.ReactNode;
}) {
  return posts.length === 0 ? (
    <ProfileEmptyState
      icon={<FileText className="h-6 w-6 text-muted-foreground/40" />}
      title="No hay publicaciones"
      subtitle="Cuando publiques algo, aparecerán aquí."
    />
  ) : (
    <div className="flex flex-col gap-4">{posts.map(renderPost)}</div>
  );
}

// ── Modal de edición de perfil ─────────────────────────────────
function EditProfileModal({
  currentUser,
  user,
  onClose,
  onSaved,
}: {
  currentUser: any;
  user: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(undefined);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | undefined>(undefined);

  useEffect(() => {
    setName(currentUser?.name ?? user?.name ?? "");
    setTitle(currentUser?.title ?? "");
    setBio(currentUser?.bio ?? "");
    setAvatarPreview(currentUser?.avatarUrl);
    setBannerPreview(currentUser?.bannerUrl);
    setAvatarFile(null);
    setBannerFile(null);
  }, [currentUser, user]);

  const isNameDirty = name.trim() !== (currentUser?.name ?? user?.name ?? "");
  const isTitleDirty = title !== (currentUser?.title ?? "");
  const isBioDirty = bio !== (currentUser?.bio ?? "");
  const isAvatarDirty = avatarFile !== null;
  const isBannerDirty = bannerFile !== null;
  const hasChanges = isNameDirty || isTitleDirty || isBioDirty || isAvatarDirty || isBannerDirty;

  const handleAvatarSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imágenes");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen es demasiado grande (máx 5 MB)");
      return;
    }
    setAvatarFile(file);
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
    e.target.value = "";
  }, []);

  const handleBannerSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imágenes");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen es demasiado grande (máx 5 MB)");
      return;
    }
    setBannerFile(file);
    const url = URL.createObjectURL(file);
    setBannerPreview(url);
    e.target.value = "";
  }, []);

  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);
  useEffect(() => {
    return () => {
      if (bannerPreview && bannerPreview.startsWith("blob:")) URL.revokeObjectURL(bannerPreview);
    };
  }, [bannerPreview]);

  const handleSave = async () => {
    if (saving) return;
    if (!hasChanges) {
      toast.info("No hay cambios para guardar");
      return;
    }
    setSaving(true);
    try {
      let avatarPath: string | undefined;
      let bannerPath: string | undefined;
      if (avatarFile) {
        const path = generateFilePath(user?._id || "", avatarFile.name, "avatars");
        await uploadFile("avatars", avatarFile, path);
        avatarPath = path;
      }
      if (bannerFile) {
        const path = generateFilePath(user?._id || "", bannerFile.name, "banners");
        await uploadFile("banners", bannerFile, path);
        bannerPath = path;
      }
      const updates: Record<string, string | undefined> = {};
      if (isNameDirty) updates.name = name.trim() || undefined;
      if (isTitleDirty) updates.title = title.trim() || undefined;
      if (isBioDirty) updates.bio = bio.trim() || undefined;
      if (avatarPath) updates.image = avatarPath;
      if (bannerPath) updates.banner = bannerPath;
      if (Object.keys(updates).length > 0) {
        await updateProfile(user?._id || "", updates as any);
      }
      toast.success("Perfil actualizado");
      onSaved();
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el perfil");
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
        {/* Header: título + Guardar (top-right) */}
        <div className="flex items-center justify-between border-b border-border/20 px-5 py-3 shrink-0">
          <span className="text-sm font-semibold">Editar perfil</span>
          <div className="flex items-center gap-2">
            {saving ? (
              <span className="flex h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={!hasChanges}
                className="flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
              >
                <Check className="h-3.5 w-3.5" />
                Guardar
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
          {/* ── BANNER ── */}
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Banner
            </label>
            <div className="relative h-28 w-full overflow-hidden rounded-xl border border-border/35 bg-muted">
              {bannerPreview ? (
                <img src={bannerPreview} alt="Banner" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                  <span className="text-xs text-muted-foreground">Sin banner — toca para agregar</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                disabled={saving}
                className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/75 disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" />
                {bannerPreview ? "Cambiar banner" : "Agregar banner"}
              </button>
            </div>
            <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerSelect} />
            {isBannerDirty && <p className="mt-1.5 text-xs text-primary">Nuevo banner listo — pulsa Guardar</p>}
          </div>

          {/* Avatar + cámara */}
          <div className="flex flex-col items-center gap-3 mb-4">
            <div className="relative">
              <Avatar className="h-24 w-24 border-2 border-border/30">
                {avatarPreview ? (
                  <AvatarImage src={avatarPreview} alt={name || "Perfil"} className="h-full w-full object-cover" />
                ) : null}
                <AvatarFallback className="flex h-full w-full items-center justify-center bg-primary/10 text-2xl font-bold text-primary">
                  {name ? getInitials(name) : <User className="h-10 w-10" />}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
            </div>
            {isAvatarDirty && <p className="text-xs text-primary">Nueva foto lista — pulsa Guardar</p>}
          </div>

          {/* Nombre */}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Tu nombre"
              className="h-10 w-full rounded-xl border border-border/35 bg-background px-3 text-sm text-card-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>

          {/* Título */}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Título (opcional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              placeholder="Título (opcional)"
              className="h-10 w-full rounded-xl border border-border/35 bg-background px-3 text-sm text-card-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>

          {/* Biografía */}
          <div className="mb-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Biografía / Descripción</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              maxLength={160}
              placeholder="Cuéntanos algo sobre ti…"
              rows={4}
              className="min-h-[88px] w-full resize-none rounded-xl border border-border/35 bg-background px-3 py-2.5 text-sm text-card-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground/70">{bio.length}/160</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Follow list modal (inline version for ProfilePage) ─────────────
type FollowListUser = {
  _id: string;
  name: string;
  imageUrl?: string | null;
};

function FollowListModalInline({
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
  useEffect(() => {
    const fetchList = async () => {
      if (!userId) return;
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

  const [inFlight, setInFlight] = useState<Set<string>>(new Set());
  const [listStats, setListStats] = useState<Record<string, boolean>>({});

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
                <div
                  key={u._id}
                  className="flex items-center gap-3 px-5 py-3"
                >
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
                        setInFlight((prev) => new Set(prev).add(u._id));
                        toggleFollow(currentUserId, u._id).then(
                          (nowFollowing: boolean) => {
                            setListStats((prev) => ({
                              ...prev,
                              [u._id]: nowFollowing,
                            }));
                            setInFlight((prev) => {
                              const next = new Set(prev);
                              next.delete(u._id);
                              return next;
                            });
                          }
                        ).catch((error: unknown) => {
                          console.error(
                            "Error toggling follow in list:",
                            error
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
                          : "bg-blue-600 text-white hover:bg-blue-700"
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
