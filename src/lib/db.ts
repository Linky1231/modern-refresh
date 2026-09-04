// ═══════════════════════════════════════════════════════════════════
// CAPA DE DATOS — MODO LOCAL / SOLO DISPOSITIVO
//
// Toda la sincronización remota (auth, publicaciones, likes,
// comentarios, seguidores, notificaciones y archivos) fue ELIMINADA.
// Los datos viven únicamente en el navegador del dispositivo
// (localStorage): sin red, sin servidor, sin base de datos remota.
//
// ▶ [MIGRACIÓN LOVABLE CLOUD] Cuando migres la app a Lovable Cloud,
//   cada función de este archivo debe reconectarse al backend que
//   provea Lovable (auth, base de datos y storage). Las firmas y los
//   contratos de datos se conservan intactos para que el resto del
//   código (páginas y componentes) no tenga que cambiar.
//   Busca el marcador "▶ [LOVABLE CLOUD]" para ver cada punto de
//   reconexión.
// ═══════════════════════════════════════════════════════════════════

export const AUTH_STORAGE_KEY = "asternal_auth";
const DB_KEY = "asternal_local_db_v1";

// ========================================
// TYPES (contratos de datos conservados tal cual estaban)
// ========================================

export interface User {
  id: string;
  username: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
  bio: string | null;
  title: string | null;
  role: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  title: string | null;
  content: string;
  likes: number;
  favorites: number;
  shares: number;
  media: Array<{ storageId: string; type: "image" | "video"; mime?: string }>;
  documents: Array<{
    storageId: string;
    name: string;
    size: number;
    mime?: string;
  }>;
  mentions: Array<{ userId: string; name: string }>;
  hashtags: string[];
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  likes: number;
  parent_comment_id: string | null;
  created_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface PollOption {
  id: string;
  text: string;
}

export interface PollData {
  id: string;
  question: string;
  options: PollOption[];
}

export interface NotificationItem {
  id: string;
  user_id: string;
  actor_id: string;
  type: "like" | "favorite" | "comment" | "reply" | "follow";
  post_id: string | null;
  comment_id: string | null;
  read: boolean;
  created_at: string;
  actorName?: string;
  actorImageUrl?: string;
}

// ========================================
// ALMACENAMIENTO LOCAL DEL DISPOSITIVO
// ========================================

interface LocalUserRow {
  id: string;
  username: string;
  name: string;
  email: string | null;
  image: string | null; // ruta de avatar (se resuelve vía files) o data URL
  bio: string;
  title: string;
  role: string;
  created_at: string;
}

interface LocalPostRow {
  id: string;
  author_id: string;
  title: string | null;
  content: string;
  media: Post["media"];
  documents: Post["documents"];
  mentions: Post["mentions"];
  poll?: PollData | null;
  hashtags: string[];
  created_at: string;
}

interface LocalCommentRow {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  parent_comment_id: string | null;
  created_at: string;
}

interface LocalDB {
  users: LocalUserRow[];
  posts: LocalPostRow[];
  comments: LocalCommentRow[];
  likes: Array<{ user_id: string; post_id: string }>;
  favorites: Array<{ user_id: string; post_id: string }>;
  commentLikes: Array<{ user_id: string; comment_id: string }>;
  follows: Array<{ follower_id: string; following_id: string }>;
  notifications: NotificationItem[];
  pollVotes: Array<{ user_id: string; poll_id: string; option_id: string }>;
  /** Archivos subidos en el dispositivo: ruta -> data URL */
  files: Record<string, string>;
}

function emptyDB(): LocalDB {
  return {
    users: [],
    posts: [],
    comments: [],
    likes: [],
    favorites: [],
    commentLikes: [],
    follows: [],
    notifications: [],
    pollVotes: [],
    files: {},
  };
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

let memory: LocalDB | null = null;

function getDB(): LocalDB {
  if (memory) return memory;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<LocalDB>;
        memory = { ...emptyDB(), ...parsed };
        return memory;
      }
    } catch (e) {
      console.error("No se pudo leer la base local:", e);
    }
  }
  memory = emptyDB();
  return memory;
}

/** Guarda el estado local. Lanza error claro si el dispositivo está lleno. */
function saveDB() {
  const db = getDB();
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    throw new Error(
      "El almacenamiento local del dispositivo está lleno. Elimina publicaciones con imágenes para liberar espacio.",
    );
  }
}

// ── Helpers de consulta local ──────────────────────────────────────

function findUser(id: string): LocalUserRow | null {
  return getDB().users.find((u) => u.id === id) ?? null;
}

function findUserByUsername(username: string): LocalUserRow | null {
  const clean = username.trim().toLowerCase();
  return getDB().users.find((u) => u.username.toLowerCase() === clean) ?? null;
}

function ensureUser(id: string, fallback?: Partial<LocalUserRow>): LocalUserRow {
  const existing = findUser(id);
  if (existing) return existing;
  const row: LocalUserRow = {
    id,
    username: fallback?.username ?? `usuario-${id.slice(0, 6)}`,
    name: fallback?.name ?? "Anónimo",
    email: fallback?.email ?? null,
    image: fallback?.image ?? null,
    bio: fallback?.bio ?? "",
    title: fallback?.title ?? "",
    role: fallback?.role ?? "user",
    created_at: fallback?.created_at ?? new Date().toISOString(),
  };
  getDB().users.push(row);
  return row;
}

/** Resuelve un identificador de archivo a una URL usable en el dispositivo. */
function resolveFileUrl(storageId: string | null | undefined): string {
  if (!storageId) return "";
  if (storageId.startsWith("data:")) return storageId;
  const file = getDB().files[storageId];
  return file ?? "";
}

function getAuthorMap(userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, LocalUserRow>();
  for (const id of ids) {
    const u = findUser(id);
    if (u) map.set(id, u);
  }
  return map;
}

function likesMapFor<K extends "post_id" | "comment_id">(
  rows: Array<{ user_id: string } & { [P in K]: string }>,
  key: K,
  userId: string | undefined,
  targetIds: string[],
) {
  const set = new Map<string, boolean>();
  if (!userId) return set;
  const targets = new Set(targetIds);
  for (const row of rows) {
    if (row.user_id === userId && targets.has(row[key])) {
      set.set(row[key], true);
    }
  }
  return set;
}

/** Convierte una publicación local a la vista que consume la interfaz. */
function toPostView(
  post: LocalPostRow,
  author: LocalUserRow,
  likedByMe: boolean,
  favoritedByMe: boolean,
) {
  return {
    _id: post.id,
    authorId: post.author_id,
    title: post.title,
    content: post.content,
    createdAt: new Date(post.created_at).getTime(),
    likes: getDB().likes.filter((l) => l.post_id === post.id).length,
    favorites: getDB().favorites.filter((f) => f.post_id === post.id).length,
    shares: 0,
    mediaUrls: (post.media || []).map((m) => ({
      url: resolveFileUrl(m.storageId),
      type: m.type,
      mime: m.mime,
    })),
    documentUrls: (post.documents || []).map((d) => ({
      url: resolveFileUrl(d.storageId),
      name: d.name,
      size: d.size,
      mime: d.mime,
    })),
    authorName: author?.name || "Anónimo",
    authorImage: author?.image ?? null,
    authorImageUrl: author?.image
      ? resolveFileUrl(author.image)
      : undefined,
    poll: post.poll ? { ...post.poll, votes: countPollVotes(post.poll.id) } : undefined,
    likedByMe,
    favoritedByMe,
    mentions: post.mentions || [],
    hashtags: post.hashtags || [],
  };
}

function extractHashtags(html: string): string[] {
  const text = html.replace(/<[^>]*>/g, "");
  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
  return matches ? [...new Set(matches.map((h) => h.toLowerCase()))] : [];
}

// ========================================
// AUTH FUNCTIONS (LOCALES — ▶ [LOVABLE CLOUD]: reconectar a auth de Lovable)
// ========================================

/**
 * Registra un usuario nuevo. En modo local la contraseña no se
 * guarda en el dispositivo (no se valida al iniciar sesión).
 * ▶ [LOVABLE CLOUD] Al migrar, volcar a registro real con el backend.
 */
export async function registerUser(
  username: string,
  password: string,
  name?: string,
) {
  const cleanUsername = username.trim().toLowerCase();
  if (cleanUsername.length < 3) {
    throw new Error("El nombre de usuario debe tener al menos 3 caracteres");
  }
  if (cleanUsername.length > 20) {
    throw new Error("El nombre de usuario no puede tener más de 20 caracteres");
  }
  if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
    throw new Error(
      "El nombre de usuario solo puede contener letras minúsculas, números y guiones bajos",
    );
  }
  if (password.length < 4) {
    throw new Error("La contraseña debe tener al menos 4 caracteres");
  }
  if (findUserByUsername(cleanUsername)) {
    throw new Error("Este nombre de usuario ya está en uso");
  }

  const displayName = name?.trim() || cleanUsername;
  const row: LocalUserRow = {
    id: uid(),
    username: cleanUsername,
    name: displayName,
    email: `${cleanUsername}@local.asternal`,
    image: null,
    bio: "",
    title: "",
    role: "user",
    created_at: new Date().toISOString(),
  };
  getDB().users.push(row);
  saveDB();

  return { _id: row.id, name: displayName, username: cleanUsername };
}

/**
 * Inicia sesión. En modo local solo se comprueba que el usuario
 * exista en este dispositivo (la contraseña no se almacena).
 * ▶ [LOVABLE CLOUD] Al migrar, validar credenciales con el backend.
 */
export async function loginUser(username: string, _password: string) {
  const cleanUsername = username.trim().toLowerCase();
  const user = findUserByUsername(cleanUsername);
  if (!user) {
    throw new Error("Usuario o contraseña incorrectos");
  }
  return {
    _id: user.id,
    name: user.name || cleanUsername,
    username: user.username || cleanUsername,
    email: user.email ?? null,
    image: user.image,
    role: user.role || "user",
  };
}

/**
 * Cierra la sesión local (limpia la sesión guardada del dispositivo).
 * ▶ [LOVABLE CLOUD] Al migrar, cerrar la sesión real del backend.
 */
export async function logoutUser() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // sin ventana o almacenamiento no disponible
    }
  }
}

/**
 * Devuelve el perfil local del usuario con sesión activa (si existe).
 * ▶ [LOVABLE CLOUD] Al migrar, leer el usuario autenticado del backend.
 */
export async function getCurrentUser() {
  if (typeof window === "undefined") return null;
  let cached: { _id?: string } | null = null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    cached = raw ? (JSON.parse(raw) as { _id?: string }) : null;
  } catch {
    return null;
  }
  if (!cached?._id) return null;
  const row = findUser(cached._id);
  return row;
}

// ========================================
// USER FUNCTIONS
// ========================================

/**
 * Busca usuarios por nombre o usuario para @menciones.
 * ▶ [LOVABLE CLOUD] Conectar a búsqueda de usuarios del backend.
 */
export async function searchUsers(query: string, currentUserId?: string) {
  const searchTerm = query.trim().toLowerCase();
  return getDB()
    .users.filter((u) => {
      if (currentUserId && u.id === currentUserId) return false;
      if (!searchTerm) return true;
      return (
        u.name.toLowerCase().includes(searchTerm) ||
        u.username.toLowerCase().includes(searchTerm)
      );
    })
    .slice(0, 20)
    .map((u) => ({
      _id: u.id,
      name: u.name || "Anónimo",
      image: u.image,
    }));
}

/**
 * Actualiza el perfil del usuario en el dispositivo.
 * ▶ [LOVABLE CLOUD] Conectar a actualización de perfil del backend.
 */
export async function updateProfile(
  userId: string,
  updates: { name?: string; bio?: string; title?: string; image?: string },
) {
  const user = ensureUser(userId);
  if (updates.name !== undefined) user.name = updates.name.trim();
  if (updates.bio !== undefined) user.bio = updates.bio.slice(0, 200);
  if (updates.title !== undefined) user.title = updates.title.slice(0, 60);
  if (updates.image !== undefined) user.image = updates.image;
  saveDB();
}

/**
 * Perfil de un usuario con sus estadísticas y publicaciones.
 * ▶ [LOVABLE CLOUD] Conectar a consulta de perfil del backend.
 */
export async function getUserProfile(userId: string, currentUserId?: string) {
  const user = findUser(userId);
  if (!user) return null;

  const db = getDB();
  const followers = db.follows.filter((f) => f.following_id === userId).length;
  const following = db.follows.filter((f) => f.follower_id === userId).length;
  const isFollowing =
    !!currentUserId &&
    currentUserId !== userId &&
    db.follows.some(
      (f) => f.follower_id === currentUserId && f.following_id === userId,
    );

  const posts = db.posts
    .filter((p) => p.author_id === userId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 30)
    .map((post) => {
      const likedByMe = db.likes.some(
        (l) => l.post_id === post.id && l.user_id === currentUserId,
      );
      const favoritedByMe = db.favorites.some(
        (f) => f.post_id === post.id && f.user_id === currentUserId,
      );
      return toPostView(post, user, likedByMe, favoritedByMe);
    });

  return {
    _id: user.id,
    name: user.name || "Anónimo",
    email: user.email,
    image: user.image,
    avatarUrl: user.image ? resolveFileUrl(user.image) : undefined,
    bio: user.bio || "",
    title: user.title || "",
    followers,
    following,
    isFollowing,
    posts,
  };
}

// ========================================
// PARTE 1 · ENCUESTAS: almacenamiento + recuento de votos (locales)
// ▶ [LOVABLE CLOUD]: votos con el backend
// ========================================

/** Cuenta votos de una encuesta. Anónimo: solo se guarda el recuento por opción. */
function countPollVotes(pollId: string): Record<string, number> {
  const db = getDB();
  const counts: Record<string, number> = {};
  for (const v of db.pollVotes) {
    if (v.poll_id === pollId) {
      counts[v.option_id] = (counts[v.option_id] || 0) + 1;
    }
  }
  return counts;
}

/** Construye la encuesta (entre 2 y 5 opciones). Devuelve null si no es válida. */
function buildPoll(
  input?: { question?: string; options?: string[] },
): PollData | null {
  if (!input) return null;
  const question = (input.question || "").trim().slice(0, 200);
  const seen = new Set<string>();
  const options: PollOption[] = [];
  for (const raw of input.options || []) {
    const text = (raw || "").trim().slice(0, 100);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    options.push({ id: uid(), text });
    if (options.length >= 5) break;
  }
  if (!question || options.length < 2) return null;
  return { id: uid(), question, options };
}

// ========================================
// POST FUNCTIONS
// ========================================

/**
 * Publicaciones con ordenación (para ti / siguiendo / populares).
 * ▶ [LOVABLE CLOUD] Conectar a feed del backend.
 */
export async function getPosts(
  sortBy: "forYou" | "following" | "popular" = "forYou",
  currentUserId?: string,
) {
  const db = getDB();

  let posts = [...db.posts].sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1,
  );

  if (sortBy === "following" && currentUserId) {
    const followedIds = new Set(
      db.follows
        .filter((f) => f.follower_id === currentUserId)
        .map((f) => f.following_id),
    );
    if (followedIds.size === 0) return [];
    posts = posts.filter((p) => followedIds.has(p.author_id));
  }

  posts = posts.slice(0, 200);
  const authorMap = getAuthorMap(posts.map((p) => p.author_id));
  const likedMap = likesMapFor(
    db.likes,
    "post_id",
    currentUserId,
    posts.map((p) => p.id),
  );
  const favoritedMap = likesMapFor(
    db.favorites,
    "post_id",
    currentUserId,
    posts.map((p) => p.id),
  );

  const processed = posts.map((post) =>
    toPostView(
      post,
      authorMap.get(post.author_id) ?? ensureUser(post.author_id),
      likedMap.get(post.id) ?? false,
      favoritedMap.get(post.id) ?? false,
    ),
  );

  const now = Date.now();
  const score = (p: (typeof processed)[number]) =>
    p.likes * 2 + (p.shares || 0) * 4 + (p.favorites || 0) * 3;

  if (sortBy === "popular") {
    processed.sort(
      (a, b) => score(b) - score(a) || b.createdAt - a.createdAt,
    );
  } else if (sortBy === "forYou") {
    processed.sort((a, b) => {
      const recency = (p: (typeof processed)[number]) => {
        const ageHours = (now - p.createdAt) / (1000 * 60 * 60);
        return ageHours < 24 ? 1.5 : ageHours < 72 ? 1.2 : 1.0;
      };
      return score(b) * recency(b) - score(a) * recency(a);
    });
  }

  return processed.slice(0, 50);
}

/**
 * Crea una publicación guardándola solo en el dispositivo.
 * ▶ [LOVABLE CLOUD] Conectar a creación de publicación del backend.
 */
export async function createPost(
  authorId: string,
  content: string,
  options?: {
    title?: string;
    media?: Array<{ storageId: string; type: "image" | "video"; mime?: string }>;
    documents?: Array<{
      storageId: string;
      name: string;
      size: number;
      mime?: string;
    }>;
    mentions?: Array<{ userId: string; name: string }>;
    poll?: { question: string; options: string[] };
  },
) {
  if (
    content.trim().length === 0 &&
    (!options?.media || options.media.length === 0) &&
    (!options?.documents || options.documents.length === 0) &&
    !options?.poll
  ) {
    throw new Error("La publicación no puede estar vacía");
  }
  if (content.length > 2000) {
    throw new Error("El contenido es demasiado largo (máximo 2000 caracteres)");
  }

  const row: LocalPostRow = {
    id: uid(),
    author_id: authorId,
    title: options?.title?.trim() || null,
    content: content.trim(),
    media: options?.media || [],
    documents: options?.documents || [],
    mentions: options?.mentions || [],
    poll: buildPoll(options?.poll) ?? null,
    hashtags: extractHashtags(content),
    created_at: new Date().toISOString(),
  };
  getDB().posts.push(row);
  ensureUser(authorId);
  saveDB();

  return {
    id: row.id,
    author_id: row.author_id,
    title: row.title,
    content: row.content,
    likes: 0,
    favorites: 0,
    shares: 0,
    media: row.media,
    documents: row.documents,
    mentions: row.mentions,
    poll: row.poll,
    hashtags: row.hashtags,
    created_at: row.created_at,
  };
}

/** Elimina una publicación (solo dueño). ▶ [LOVABLE CLOUD] reconectar. */
export async function deletePost(postId: string, userId: string) {
  const db = getDB();
  const post = db.posts.find((p) => p.id === postId);
  if (!post) throw new Error("Publicación no encontrada");
  if (post.author_id !== userId) throw new Error("No autorizado");
  removePostWithRelations(postId);
}

/** Elimina una publicación como admin. ▶ [LOVABLE CLOUD] reconectar. */
export async function deletePostAsAdmin(postId: string) {
  removePostWithRelations(postId);
}

function removePostWithRelations(postId: string) {
  const db = getDB();
  const targetPost = db.posts.find((p) => p.id === postId);
  if (targetPost?.poll) {
    db.pollVotes = db.pollVotes.filter(
      (v) => v.poll_id !== targetPost.poll!.id,
    );
  }
  const commentIds = db.comments
    .filter((c) => c.post_id === postId)
    .map((c) => c.id);
  db.comments = db.comments.filter((c) => c.post_id !== postId);
  db.likes = db.likes.filter((l) => l.post_id !== postId);
  db.favorites = db.favorites.filter((f) => f.post_id !== postId);
  db.commentLikes = db.commentLikes.filter(
    (cl) => !commentIds.includes(cl.comment_id),
  );
  db.notifications = db.notifications.filter(
    (n) => n.post_id !== postId && !commentIds.includes(n.comment_id ?? ""),
  );
  db.posts = db.posts.filter((p) => p.id !== postId);
  saveDB();
}

// ========================================
// LIKE / FAVORITE FUNCTIONS (locales)
// ========================================

/**
 * Me gusta / quitar me gusta de una publicación.
 * ▶ [LOVABLE CLOUD] Reconectar a likes del backend.
 */
export async function togglePostLike(userId: string, postId: string) {
  const db = getDB();
  const post = db.posts.find((p) => p.id === postId);
  if (!post) throw new Error("Publicación no encontrada");

  const index = db.likes.findIndex(
    (l) => l.user_id === userId && l.post_id === postId,
  );
  if (index >= 0) {
    db.likes.splice(index, 1);
    saveDB();
    return false;
  }
  db.likes.push({ user_id: userId, post_id: postId });
  saveDB();
  void notifyPostOwner(userId, postId, "like");
  return true;
}

/**
 * Favorito / quitar favorito de una publicación.
 * ▶ [LOVABLE CLOUD] Reconectar a favoritos del backend.
 */
export async function togglePostFavorite(userId: string, postId: string) {
  const db = getDB();
  const post = db.posts.find((p) => p.id === postId);
  if (!post) throw new Error("Publicación no encontrada");

  const index = db.favorites.findIndex(
    (f) => f.user_id === userId && f.post_id === postId,
  );
  if (index >= 0) {
    db.favorites.splice(index, 1);
    saveDB();
    return false;
  }
  db.favorites.push({ user_id: userId, post_id: postId });
  saveDB();
  void notifyPostOwner(userId, postId, "favorite");
  return true;
}

// ========================================
// COMMENT FUNCTIONS (locales)
// ========================================

/**
 * Comentarios de una publicación.
 * ▶ [LOVABLE CLOUD] Reconectar a comentarios del backend.
 */
export async function getComments(postId: string, currentUserId?: string) {
  const db = getDB();
  const comments = db.comments
    .filter((c) => c.post_id === postId)
    .sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
  const authorMap = getAuthorMap(comments.map((c) => c.author_id));
  const likedMap = likesMapFor(
    db.commentLikes,
    "comment_id",
    currentUserId,
    comments.map((c) => c.id),
  );

  return comments.map((comment) => {
    const author = authorMap.get(comment.author_id) ?? ensureUser(comment.author_id);
    return {
      ...comment,
      likes: db.commentLikes.filter((cl) => cl.comment_id === comment.id).length,
      authorName: author?.name || "Anónimo",
      authorImage: author?.image ?? null,
      authorImageUrl: author?.image ? resolveFileUrl(author.image) : undefined,
      likedByMe: likedMap.get(comment.id) ?? false,
    };
  });
}

/**
 * Crea un comentario o respuesta (guardado local).
 * ▶ [LOVABLE CLOUD] Reconectar a comentarios del backend.
 */
export async function createComment(
  postId: string,
  authorId: string,
  content: string,
  parentCommentId?: string,
) {
  if (content.trim().length === 0) {
    throw new Error("El comentario no puede estar vacío");
  }
  if (content.length > 1000) {
    throw new Error("El comentario es demasiado largo (máximo 1000 caracteres)");
  }

  const db = getDB();
  if (parentCommentId) {
    const parent = db.comments.find(
      (c) => c.id === parentCommentId && c.post_id === postId,
    );
    if (!parent) throw new Error("Comentario padre no encontrado");
  }

  const row: LocalCommentRow = {
    id: uid(),
    post_id: postId,
    author_id: authorId,
    content: content.trim(),
    parent_comment_id: parentCommentId || null,
    created_at: new Date().toISOString(),
  };
  db.comments.push(row);
  saveDB();

  // ▶ [LOVABLE CLOUD] Las notificaciones se generan con el backend.
  if (parentCommentId) {
    const parent = db.comments.find((c) => c.id === parentCommentId);
    if (parent) {
      await createNotification({
        userId: parent.author_id,
        actorId: authorId,
        type: "reply",
        postId,
        commentId: row.id,
      });
    }
  } else {
    const post = db.posts.find((p) => p.id === postId);
    if (post) {
      await createNotification({
        userId: post.author_id,
        actorId: authorId,
        type: "comment",
        postId,
        commentId: row.id,
      });
    }
  }

  return {
    id: row.id,
    post_id: row.post_id,
    author_id: row.author_id,
    content: row.content,
    likes: 0,
    parent_comment_id: row.parent_comment_id,
    created_at: row.created_at,
  };
}

/**
 * Me gusta de un comentario (local).
 * ▶ [LOVABLE CLOUD] Reconectar a likes de comentarios del backend.
 */
export async function toggleCommentLike(userId: string, commentId: string) {
  const db = getDB();
  const comment = db.comments.find((c) => c.id === commentId);
  if (!comment) throw new Error("Comentario no encontrado");

  const index = db.commentLikes.findIndex(
    (cl) => cl.user_id === userId && cl.comment_id === commentId,
  );
  if (index >= 0) {
    db.commentLikes.splice(index, 1);
    saveDB();
    return false;
  }
  db.commentLikes.push({ user_id: userId, comment_id: commentId });
  saveDB();
  return true;
}

/**
 * Elimina un comentario (solo dueño). ▶ [LOVABLE CLOUD] reconectar.
 */
export async function deleteComment(commentId: string, userId: string) {
  const db = getDB();
  const comment = db.comments.find((c) => c.id === commentId);
  if (!comment) throw new Error("Comentario no encontrado");
  if (comment.author_id !== userId) throw new Error("No autorizado");

  const toDelete = new Set<string>([commentId]);
  let found = true;
  while (found) {
    found = false;
    for (const c of db.comments) {
      if (c.parent_comment_id && toDelete.has(c.parent_comment_id) && !toDelete.has(c.id)) {
        toDelete.add(c.id);
        found = true;
      }
    }
  }

  db.comments = db.comments.filter((c) => !toDelete.has(c.id));
  db.commentLikes = db.commentLikes.filter(
    (cl) => !toDelete.has(cl.comment_id),
  );
  db.notifications = db.notifications.filter(
    (n) => !toDelete.has(n.comment_id ?? ""),
  );
  saveDB();
}

// ========================================
// FOLLOW FUNCTIONS (locales)
// ========================================

/**
 * Seguir / dejar de seguir. ▶ [LOVABLE CLOUD] reconectar.
 */
export async function toggleFollow(followerId: string, followingId: string) {
  if (followerId === followingId) {
    throw new Error("No puedes seguirte a ti mismo");
  }
  const db = getDB();
  const index = db.follows.findIndex(
    (f) => f.follower_id === followerId && f.following_id === followingId,
  );
  if (index >= 0) {
    db.follows.splice(index, 1);
    saveDB();
    return false;
  }
  db.follows.push({ follower_id: followerId, following_id: followingId });
  saveDB();
  await createNotification({
    userId: followingId,
    actorId: followerId,
    type: "follow",
  });
  return true;
}

/**
 * ¿El usuario A sigue al usuario B? ▶ [LOVABLE CLOUD] reconectar.
 */
export async function isFollowing(followerId: string, followingId: string) {
  return getDB().follows.some(
    (f) => f.follower_id === followerId && f.following_id === followingId,
  );
}

/**
 * Estadísticas de seguidores/siguiendo. ▶ [LOVABLE CLOUD] reconectar.
 */
export async function getFollowStats(userId: string) {
  const db = getDB();
  return {
    followers: db.follows.filter((f) => f.following_id === userId).length,
    following: db.follows.filter((f) => f.follower_id === userId).length,
  };
}

/**
 * Lista de seguidores. ▶ [LOVABLE CLOUD] reconectar.
 */
export async function getFollowers(userId: string) {
  const db = getDB();
  const followerIds = db.follows
    .filter((f) => f.following_id === userId)
    .map((f) => f.follower_id);
  const authorMap = getAuthorMap(followerIds);
  return followerIds.map((id) => {
    const u = authorMap.get(id) ?? ensureUser(id);
    return {
      _id: id,
      name: u.name || "Anónimo",
      imageUrl: u.image ? resolveFileUrl(u.image) : undefined,
    };
  });
}

/**
 * Lista de usuarios seguidos. ▶ [LOVABLE CLOUD] reconectar.
 */
export async function getFollowing(userId: string) {
  const db = getDB();
  const followingIds = db.follows
    .filter((f) => f.follower_id === userId)
    .map((f) => f.following_id);
  const authorMap = getAuthorMap(followingIds);
  return followingIds.map((id) => {
    const u = authorMap.get(id) ?? ensureUser(id);
    return {
      _id: id,
      name: u.name || "Anónimo",
      imageUrl: u.image ? resolveFileUrl(u.image) : undefined,
    };
  });
}

// ========================================
// STORAGE FUNCTIONS (solo dispositivo)
// ========================================

/**
 * URL pública local para un archivo guardado en el dispositivo.
 * ▶ [LOVABLE CLOUD] Al migrar, devolver la URL del storage de Lovable.
 */
export function getStorageUrl(bucket: string, path: string): string {
  void bucket; // el bucket ya no importa: todo vive en el dispositivo
  return resolveFileUrl(path);
}

/**
 * Guarda un archivo en el dispositivo (data URL en localStorage).
 * Solo imágenes/datos pequeños caben en modo local.
 * ▶ [LOVABLE CLOUD] Al migrar, subir a storage de Lovable Cloud.
 */
export async function uploadFile(
  bucket: string,
  file: File,
  path: string,
): Promise<string> {
  if (file.type.startsWith("video/")) {
    throw new Error(
      "Los vídeos no se guardan en modo local. Estarán disponibles al migrar la app a Lovable Cloud.",
    );
  }
  const maxByBucket: Record<string, number> = {
    avatars: 3 * 1024 * 1024,
    media: 4 * 1024 * 1024,
    documents: 3 * 1024 * 1024,
  };
  const maxBytes = maxByBucket[bucket] ?? 3 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(
      `El archivo supera el límite del modo local (${Math.round(maxBytes / 1024 / 1024)} MB). Al migrar a Lovable Cloud podrás subir archivos más grandes.`,
    );
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(new Error("No se pudo leer el archivo en el dispositivo"));
    reader.readAsDataURL(file);
  });

  getDB().files[path] = dataUrl;
  saveDB();
  return path;
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/** Genera una ruta única de archivo (sin red, solo nombres). */
export function generateFilePath(
  userId: string,
  fileName: string,
  folder: string = "uploads",
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = fileName.split(".").pop();
  return `${folder}/${userId}/${timestamp}-${random}.${ext}`;
}

// ========================================
// NOTIFICATION FUNCTIONS (locales)
// ========================================

/**
 * Inserta una notificación local. Ignora acciones propias.
 * ▶ [LOVABLE CLOUD] Al migrar, generar notificaciones con el backend.
 */
async function createNotification(input: {
  userId: string;
  actorId: string;
  type: "like" | "favorite" | "comment" | "reply" | "follow";
  postId?: string;
  commentId?: string;
}) {
  if (input.userId === input.actorId) return;
  const db = getDB();
  const duplicate = db.notifications.some(
    (n) =>
      n.user_id === input.userId &&
      n.actor_id === input.actorId &&
      n.type === input.type &&
      n.post_id === (input.postId ?? null) &&
      n.comment_id === (input.commentId ?? null),
  );
  if (duplicate) return;
  db.notifications.push({
    id: uid(),
    user_id: input.userId,
    actor_id: input.actorId,
    type: input.type,
    post_id: input.postId ?? null,
    comment_id: input.commentId ?? null,
    read: false,
    created_at: new Date().toISOString(),
  });
  saveDB();
}

/** Notifica al dueño de la publicación por like/favorito. Local. */
async function notifyPostOwner(
  actorId: string,
  postId: string,
  type: "like" | "favorite",
) {
  try {
    const post = getDB().posts.find((p) => p.id === postId);
    if (post) {
      await createNotification({
        userId: post.author_id,
        actorId,
        type,
        postId,
      });
    }
  } catch (error) {
    console.error("Error al crear la notificación local:", error);
  }
}

/**
 * Notificaciones del usuario (más nuevas primero), con datos del actor.
 * ▶ [LOVABLE CLOUD] Reconectar a notificaciones del backend.
 */
export async function getNotifications(
  userId: string,
  limit = 60,
): Promise<NotificationItem[]> {
  const db = getDB();
  const rows = db.notifications
    .filter((n) => n.user_id === userId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);

  const actorMap = getAuthorMap(rows.map((n) => n.actor_id));
  return rows.map((n) => {
    const actor = actorMap.get(n.actor_id);
    return {
      ...n,
      type: n.type as NotificationItem["type"],
      actorName: actor?.name || "Alguien",
      actorImageUrl: actor?.image ? resolveFileUrl(actor.image) : undefined,
    };
  });
}

/**
 * Notificaciones sin leer. ▶ [LOVABLE CLOUD] reconectar.
 */
export async function getUnreadNotificationsCount(userId: string) {
  return getDB().notifications.filter(
    (n) => n.user_id === userId && !n.read,
  ).length;
}

/**
 * Marca todas las notificaciones como leídas. ▶ [LOVABLE CLOUD] reconectar.
 */
export async function markNotificationsRead(userId: string) {
  const db = getDB();
  let changed = false;
  for (const n of db.notifications) {
    if (n.user_id === userId && !n.read) {
      n.read = true;
      changed = true;
    }
  }
  if (changed) saveDB();
}

// ========================================
// PARTE 1 · ENCUESTAS: funciones de voto (locales)
// ▶ [LOVABLE CLOUD]: reconectar
// ========================================

/**
 * Votos actuales de una encuesta (solo recuento por opción, anónimo).
 */
export async function getPollVotes(pollId: string) {
  return countPollVotes(pollId);
}

/**
 * Opción por la que ya votó el usuario en esta encuesta (o null).
 */
export async function getMyPollVote(userId: string, pollId: string) {
  const vote = getDB().pollVotes.find(
    (v) => v.user_id === userId && v.poll_id === pollId,
  );
  return vote?.option_id ?? null;
}

/**
 * Vota (o cambia el voto) en una encuesta. El voto queda anónimo:
 * solo se suma al recuento de la opción, nunca se expone quién votó.
 */
export async function voteOnPoll(
  userId: string,
  pollId: string,
  optionId: string,
) {
  const db = getDB();
  const poll = db.posts
    .map((p) => p.poll)
    .find((p) => p?.id === pollId);
  if (!poll) throw new Error("Encuesta no encontrada");
  if (!poll.options.some((o) => o.id === optionId)) {
    throw new Error("Opción no válida");
  }
  db.pollVotes = db.pollVotes.filter(
    (v) => !(v.user_id === userId && v.poll_id === pollId),
  );
  db.pollVotes.push({ user_id: userId, poll_id: pollId, option_id: optionId });
  saveDB();
  return { optionId, counts: countPollVotes(pollId) };
}
