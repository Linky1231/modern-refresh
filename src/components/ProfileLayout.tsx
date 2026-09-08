// ▶ Componente base reutilizable para Perfil — usado tanto para "Mi perfil" como para perfil de otros
// Refinamiento 5 puntos: header unificado, tarjeta contadores py-3 px-4 con divisor discreto,
// título PUBLICACIONES px-4 uppercase, tarjetas publicación definidas y pb-28.
import { useState, useRef, useCallback, useEffect } from "react";
import { PostPoll } from "@/components/PostPoll";
import {
  updateProfile,
  uploadFile,
  generateFilePath,
  getUserProfile,
  getFollowStats,
  getFollowers,
  getFollowing,
  toggleFollow,
  isFollowing as checkIsFollowing,
} from "@/lib/db";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { UnfollowConfirmModal } from "@/components/UnfollowConfirmModal";
import { FollowButton } from "@/components/FollowButton";
import {
  ArrowLeft,
  Camera,
  User,
  MoreHorizontal,
  X,
  Check,
  FileText,
  Play,
  Share2,
  Pencil,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

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

interface ProfileLayoutProps {
  profileUserId: string;
  currentUserId?: string;
  isOwnProfile: boolean;
  onBack: () => void;
  headerTitle?: string;
}

export default function ProfileLayout({
  profileUserId,
  currentUserId,
  isOwnProfile,
  onBack,
  headerTitle,
}: ProfileLayoutProps) {
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[] | undefined>(undefined);
  const [followStats, setFollowStats] = useState<{ followers: number; following: number } | undefined>(undefined);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFollowList, setShowFollowList] = useState<"followers" | "following" | null>(null);
  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!profileUserId) return;
    try {
      const data = await getUserProfile(profileUserId, currentUserId);
      setProfile(data);
      setPosts(data?.posts || []);
    } catch (e) {
      console.error("Error fetching profile:", e);
    }
    try {
      const stats = await getFollowStats(profileUserId);
      setFollowStats(stats);
    } catch (e) {
      console.error("Error fetching follow stats:", e);
    }
    if (!isOwnProfile && currentUserId && profileUserId !== currentUserId) {
      try {
        const following = await checkIsFollowing(currentUserId, profileUserId);
        setIsFollowing(following);
      } catch {}
    }
  }, [profileUserId, currentUserId, isOwnProfile]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const handleFollowPress = async () => {
    if (!currentUserId || !profileUserId) return;
    if (isFollowing) {
      setShowUnfollowConfirm(true);
      return;
    }
    try {
      const nowFollowing = await toggleFollow(currentUserId, profileUserId);
      setIsFollowing(nowFollowing);
      const stats = await getFollowStats(profileUserId);
      setFollowStats(stats);
      toast.success("Siguiendo");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar el seguimiento");
    }
  };

  const handleConfirmUnfollow = async () => {
    if (!currentUserId || !profileUserId) return;
    setShowUnfollowConfirm(false);
    try {
      const nowFollowing = await toggleFollow(currentUserId, profileUserId);
      setIsFollowing(nowFollowing);
      const stats = await getFollowStats(profileUserId);
      setFollowStats(stats);
      toast.success("Dejaste de seguir");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar el seguimiento");
    }
  };

  const displayName = (profile?.name as string | undefined) ?? "Sin nombre";
  const title = headerTitle ?? (isOwnProfile ? "Mi perfil" : displayName);

  return (
    <div className="pb-28">
      {/* ── 1. Header superior unificado — ← y ··· en la misma barra, sin doble header ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-sm"
      >
        <div className="flex items-center justify-between px-1 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100"
              aria-label="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-[15px] font-semibold tracking-tight text-slate-800">{title}</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Más opciones"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {isOwnProfile && (
                <DropdownMenuItem onClick={() => setShowEditModal(true)} className="gap-2 text-sm">
                  <Pencil className="h-3.5 w-3.5" />
                  Editar perfil
                </DropdownMenuItem>
              )}
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

        {/* Banner por defecto — MISMA clase y estilos para Mi perfil y perfil ajeno */}
        <div className="h-32 w-full overflow-hidden rounded-t-3xl border-b border-blue-100 bg-gradient-to-r from-blue-500/15 via-blue-600/10 to-indigo-500/15">
          {profile?.bannerUrl ? (
            <img
              src={profile.bannerUrl}
              alt="Banner del perfil"
              className="h-full w-full object-cover object-center"
              loading="lazy"
            />
          ) : null}
        </div>

        {/* Avatar superpuesto — h-20 w-20 (-mt-10) centrado sobre borde inferior */}
        <div className="-mt-10 flex justify-center">
          <Avatar className="h-20 w-20 border-[3px] border-white bg-white shadow-md ring-1 ring-slate-200">
            {profile?.avatarUrl && (
              <AvatarImage src={profile.avatarUrl} alt={displayName} className="h-full w-full object-cover object-center" />
            )}
            <AvatarFallback className="flex h-full w-full items-center justify-center bg-[#eef3ff] text-[32px] font-extrabold leading-none text-[#4a6cf7]">
              {displayName !== "Sin nombre" ? getInitials(displayName).slice(0, 1) : <User className="h-10 w-10 text-[#4a6cf7]" />}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Nombre + Bio condicional */}
        <div className="mt-2 flex flex-col items-center gap-2 px-4">
          <p className="text-center text-xl font-extrabold tracking-tight text-card-foreground">{displayName}</p>

          {(profile?.title as string | undefined) && (
            <p className="text-center text-sm font-medium italic text-primary/80">{profile.title}</p>
          )}

          {/* Corrección estricta: si hay bio NUNCA se muestra + Añadir biografía */}
          {profile?.bio ? (
            <p className="mt-1 text-center text-sm text-slate-600">{profile.bio}</p>
          ) : (
            isOwnProfile && (
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="mt-1 cursor-pointer text-xs text-blue-500 hover:underline"
              >
                + Añadir biografía
              </button>
            )
          )}

          {!isOwnProfile && currentUserId && profileUserId !== currentUserId && (
            <div className="mt-1">
              <FollowButton
                isFollowing={isFollowing}
                size="lg"
                onFollow={handleFollowPress}
                onUnfollowRequest={() => setShowUnfollowConfirm(true)}
              />
            </div>
          )}
        </div>

        {/* 2. Tarjeta contadores — contenedor único rounded-2xl, py-3 px-4 por celda, divisor discreto border-slate-200/60 */}
        <div className="mt-4 px-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex divide-x divide-slate-200/60">
              <button
                type="button"
                onClick={() => setShowFollowList("followers")}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 px-4 py-3 text-center transition-colors hover:bg-slate-50"
              >
                <span className="font-bold text-slate-800 text-base tabular-nums">
                  {formatCount(followStats?.followers ?? 0)}
                </span>
                <span className="text-xs text-slate-500 font-medium">seguidores</span>
              </button>
              <button
                type="button"
                onClick={() => setShowFollowList("following")}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 px-4 py-3 text-center transition-colors hover:bg-slate-50"
              >
                <span className="font-bold text-slate-800 text-base tabular-nums">
                  {formatCount(followStats?.following ?? 0)}
                </span>
                <span className="text-xs text-slate-500 font-medium">siguiendo</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 3. Título PUBLICACIONES — px-4 alineado, sutil uppercase */}
      <div className="mx-auto mt-4 max-w-sm px-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Publicaciones</h2>
      </div>

      {/* 4. Feed de publicaciones — cada tarjeta definida */}
      <div className="mx-auto max-w-sm px-4">
        <ProfileTabContent posts={posts ?? []} currentUserId={currentUserId} />
      </div>

      {/* Follow list */}
      <AnimatePresence>
        {showFollowList && (
          <FollowListModalInline
            userId={profileUserId}
            type={showFollowList}
            onClose={() => setShowFollowList(null)}
            currentUserId={currentUserId}
          />
        )}
      </AnimatePresence>

      {/* Edit modal — solo propio */}
      <AnimatePresence>
        {showEditModal && isOwnProfile && profile && (
          <EditProfileModal
            currentUser={profile}
            user={{ _id: profileUserId, name: profile.name }}
            onClose={() => setShowEditModal(false)}
            onSaved={() => {
              setShowEditModal(false);
              void fetchAll();
            }}
          />
        )}
      </AnimatePresence>

      {/* Unfollow confirm — perfil ajeno */}
      <UnfollowConfirmModal
        open={showUnfollowConfirm}
        username={displayName}
        onConfirm={handleConfirmUnfollow}
        onCancel={() => setShowUnfollowConfirm(false)}
      />
    </div>
  );
}

function ProfileEmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon}
      <p className="mt-3 text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground/70">{subtitle}</p>
    </div>
  );
}

function ProfileTabContent({ posts, currentUserId }: { posts: any[]; currentUserId?: string }) {
  if (posts.length === 0) {
    return (
      <ProfileEmptyState
        icon={<FileText className="h-6 w-6 text-muted-foreground/40" />}
        title="No hay publicaciones"
        subtitle="Cuando publiques algo, aparecerán aquí."
      />
    );
  }
  return (
    <div className="flex flex-col">
      {posts.map((post) => (
        <div key={post._id} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm mb-3">
          {post.title && <p className="mb-1 text-sm font-bold text-card-foreground">{post.title}</p>}
          <div className="text-[15px] leading-relaxed text-card-foreground">
            <span dangerouslySetInnerHTML={{ __html: post.content || "" }} />
          </div>
          {post.poll && (
            <div className="mt-3">
              <PostPoll poll={post.poll} userId={currentUserId} />
            </div>
          )}
          {post.mediaUrls && post.mediaUrls.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {post.mediaUrls.map(({ url, type }: { url: string; type: string }, i: number) =>
                type === "video" ? (
                  <div key={i} className="relative h-28 w-full overflow-hidden rounded-xl bg-muted">
                    <video src={url} className="h-full w-full object-contain" muted preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/90">
                        <Play className="ml-0.5 h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <img key={i} src={url} alt="" className="h-28 w-full rounded-xl object-cover" />
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
  );
}

// ── Modal de edición — Banner arriba, avatar, campos
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
        <div className="flex shrink-0 items-center justify-between border-b border-border/20 px-5 py-3">
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
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Banner</label>
            <div className="relative h-28 w-full overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-r from-blue-500/15 via-blue-600/10 to-indigo-500/15">
              {bannerPreview ? (
                <img src={bannerPreview} alt="Banner" className="h-full w-full object-cover" />
              ) : null}
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

          <div className="mb-4 flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="h-24 w-24 border-2 border-border/30">
                {avatarPreview ? <AvatarImage src={avatarPreview} alt={name || "Perfil"} className="h-full w-full object-cover" /> : null}
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

type FollowListUser = { _id: string; name: string; imageUrl?: string | null };

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
        const data = type === "followers" ? await getFollowers(userId) : await getFollowing(userId);
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
          <h3 className="text-sm font-semibold">{type === "followers" ? "Seguidores" : "Siguiendo"}</h3>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <User className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-3 text-xs text-muted-foreground">
              {type === "followers" ? "Todavía no tiene seguidores." : "Todavía no sigue a nadie."}
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
                    {u.imageUrl && <AvatarImage src={u.imageUrl} alt={u.name} className="object-cover" />}
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {getInitials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-card-foreground">{u.name}</span>
                  {currentUserId && currentUserId !== u._id && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setInFlight((prev) => new Set(prev).add(u._id));
                        toggleFollow(currentUserId, u._id)
                          .then((nowFollowing: boolean) => {
                            setListStats((prev) => ({ ...prev, [u._id]: nowFollowing }));
                            setInFlight((prev) => {
                              const next = new Set(prev);
                              next.delete(u._id);
                              return next;
                            });
                          })
                          .catch((error: unknown) => {
                            console.error("Error toggling follow in list:", error);
                            setInFlight((prev) => {
                              const next = new Set(prev);
                              next.delete(u._id);
                              return next;
                            });
                          });
                      }}
                      className={`ml-auto rounded-full px-3 py-1 text-xs font-medium transition-colors ${
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
