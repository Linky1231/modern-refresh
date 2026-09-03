import { supabase } from "./supabase";

// ========================================
// TYPES
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

// ========================================
// AUTH FUNCTIONS
// ========================================

/**
 * Register a new user with username and password
 */
export async function registerUser(
  username: string,
  password: string,
  name?: string
) {
  // Validate username
  const cleanUsername = username.trim().toLowerCase();
  if (cleanUsername.length < 3) {
    throw new Error("El nombre de usuario debe tener al menos 3 caracteres");
  }
  if (cleanUsername.length > 20) {
    throw new Error("El nombre de usuario no puede tener más de 20 caracteres");
  }
  if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
    throw new Error(
      "El nombre de usuario solo puede contener letras minúsculas, números y guiones bajos"
    );
  }
  if (password.length < 4) {
    throw new Error("La contraseña debe tener al menos 4 caracteres");
  }

  // Check if username is taken
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("username", cleanUsername)
    .maybeSingle();

  if (existing) {
    throw new Error("Este nombre de usuario ya está en uso");
  }

  // Create auth user with Supabase Auth
  // The database trigger (handle_new_user) auto-creates the user profile
  const displayName = name?.trim() || cleanUsername;
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: `${cleanUsername}@asternal.local`,
    password: password,
    options: {
      data: {
        username: cleanUsername,
        name: displayName,
      },
    },
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error("Error al crear el usuario");

  // The trigger auto-creates the profile, but wait briefly then fetch it
  // If the trigger hasn't finished yet, insert manually as fallback
  await new Promise((r) => setTimeout(r, 500));

  const { data: existingProfile } = await supabase
    .from("users")
    .select("id")
    .eq("id", authData.user.id)
    .single();

  if (!existingProfile) {
    // Trigger didn't fire yet — insert manually
    await supabase.from("users").insert({
      id: authData.user.id,
      username: cleanUsername,
      name: displayName,
      email: `${cleanUsername}@asternal.local`,
      role: "user",
    });
  }

  // Auto sign-in (Supabase may not auto-sign-in depending on email confirmation settings)
  // Try to establish a session
  if (!authData.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: `${cleanUsername}@asternal.local`,
      password: password,
    });
    // Ignore signInError — user may need to confirm email
  }

  return {
    _id: authData.user.id,
    name: displayName,
    username: cleanUsername,
  };
}

/**
 * Login with username and password
 */
export async function loginUser(username: string, password: string) {
  const cleanUsername = username.trim().toLowerCase();

  // Sign in first: reading the users table before having a session can be
  // blocked by row level security, which made valid logins fail.
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: `${cleanUsername}@asternal.local`,
      password: password,
    });

  if (authError) {
    const message = /invalid login credentials/i.test(authError.message)
      ? "Usuario o contraseña incorrectos"
      : authError.message;
    throw new Error(message);
  }
  if (!authData.user) throw new Error("No se pudo iniciar sesión");

  // Now load (or lazily create) the profile with the authenticated session.
  const profile = await getCurrentUser();

  return {
    _id: profile?.id ?? authData.user.id,
    name: profile?.name || cleanUsername,
    username: profile?.username || cleanUsername,
    email: profile?.email ?? authData.user.email,
    image: profile?.image,
    role: profile?.role || "user",
  };
}

/**
 * Logout current user
 */
export async function logoutUser() {
  await supabase.auth.signOut();
}

/**
 * Get current user from Supabase
 */
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // If profile doesn't exist yet (trigger race condition), create it
  if (!profile) {
    const username = user.user_metadata?.username || user.email?.split("@")[0] || "user";
    const name = user.user_metadata?.name || username;
    const { error: insertError } = await supabase.from("users").insert({
      id: user.id,
      username,
      name,
      email: user.email,
      role: "user",
    });
    if (!insertError) {
      const { data: newProfile } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      return newProfile;
    }
  }

  return profile;
}

// ========================================
// USER FUNCTIONS
// ========================================

/**
 * Search users by name for @mentions
 */
export async function searchUsers(query: string, currentUserId?: string) {
  const searchTerm = query.trim().toLowerCase();

  let queryBuilder = supabase.from("users").select("id, name, image").limit(20);

  if (searchTerm.length > 0) {
    queryBuilder = queryBuilder.ilike("name", `%${searchTerm}%`);
  }

  if (currentUserId) {
    queryBuilder = queryBuilder.neq("id", currentUserId);
  }

  const { data, error } = await queryBuilder;

  if (error) throw error;

  return (data || []).map((u) => ({
    _id: u.id,
    name: u.name || "Anónimo",
    image: u.image,
  }));
}

/**
 * Update user profile
 */
export async function updateProfile(
  userId: string,
  updates: { name?: string; bio?: string; title?: string; image?: string }
) {
  const { error } = await supabase
    .from("users")
    .update({
      ...(updates.name !== undefined && { name: updates.name.trim() }),
      ...(updates.bio !== undefined && { bio: updates.bio.slice(0, 200) }),
      ...(updates.title !== undefined && { title: updates.title.slice(0, 60) }),
      ...(updates.image !== undefined && { image: updates.image }),
    })
    .eq("id", userId);

  if (error) throw error;
}

/**
 * Get user profile with follow stats and posts
 */
export async function getUserProfile(userId: string, currentUserId?: string) {
  // Get user
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (userError || !user) return null;

  // Get follower count
  const { count: followerCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", userId);

  // Get following count
  const { count: followingCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", userId);

  // Check if current user follows this user
  let isFollowing = false;
  if (currentUserId && currentUserId !== userId) {
    const { data } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", currentUserId)
      .eq("following_id", userId)
      .single();

    isFollowing = !!data;
  }

  // Get user's posts
  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .eq("author_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  // Process posts with likes/favorites status
  const postsWithStatus = await Promise.all(
    (posts || []).map(async (post) => {
      let likedByMe = false;
      let favoritedByMe = false;

      if (currentUserId) {
        const { data: likeData } = await supabase
          .from("likes")
          .select("id")
          .eq("user_id", currentUserId)
          .eq("post_id", post.id)
          .single();

        likedByMe = !!likeData;

        const { data: favData } = await supabase
          .from("favorites")
          .select("id")
          .eq("user_id", currentUserId)
          .eq("post_id", post.id)
          .single();

        favoritedByMe = !!favData;
      }

      return {
        _id: post.id,
        authorId: post.author_id,
        title: post.title,
        content: post.content,
        createdAt: new Date(post.created_at).getTime(),
        likes: post.likes,
        favorites: post.favorites,
        shares: post.shares,
        mediaUrls: (post.media || []).map((m: any) => ({
          url: getStorageUrl("media", m.storageId),
          type: m.type,
          mime: m.mime,
        })),
        documentUrls: (post.documents || []).map((d: any) => ({
          url: getStorageUrl("documents", d.storageId),
          name: d.name,
          size: d.size,
          mime: d.mime,
        })),
        authorName: user.name || "Anónimo",
        authorImageUrl: user.image
          ? getStorageUrl("avatars", user.image)
          : undefined,
        likedByMe,
        favoritedByMe,
        mentions: post.mentions || [],
        hashtags: post.hashtags || [],
      };
    })
  );

  return {
    _id: user.id,
    name: user.name || "Anónimo",
    email: user.email,
    image: user.image,
    avatarUrl: user.image ? getStorageUrl("avatars", user.image) : undefined,
    bio: user.bio || "",
    title: user.title || "",
    followers: followerCount || 0,
    following: followingCount || 0,
    isFollowing,
    posts: postsWithStatus,
  };
}

// ========================================
// POST FUNCTIONS
// ========================================

/**
 * Get posts with sorting algorithm
 */
export async function getPosts(
  sortBy: "forYou" | "following" | "popular" = "forYou",
  currentUserId?: string
) {
  let queryBuilder = supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  // For "following" sort, we need to get followed user IDs first
  if (sortBy === "following" && currentUserId) {
    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", currentUserId);

    const followedIds = (follows || []).map((f) => f.following_id);

    if (followedIds.length === 0) {
      return [];
    }

    queryBuilder = queryBuilder.in("author_id", followedIds);
  }

  const { data: posts, error } = await queryBuilder;

  if (error) throw error;

  // Get all unique author IDs
  const authorIds = [...new Set((posts || []).map((p) => p.author_id))];

  // Fetch all authors in one query
  const { data: authors } = await supabase
    .from("users")
    .select("id, name, image")
    .in("id", authorIds);

  const authorMap = new Map(
    (authors || []).map((a) => [
      a.id,
      { name: a.name || "Anónimo", image: a.image },
    ])
  );

  // Process posts
  const processedPosts = await Promise.all(
    (posts || []).map(async (post) => {
      const author = authorMap.get(post.author_id);

      // Check if current user liked/favorited
      let likedByMe = false;
      let favoritedByMe = false;

      if (currentUserId) {
        const { data: likeData } = await supabase
          .from("likes")
          .select("id")
          .eq("user_id", currentUserId)
          .eq("post_id", post.id)
          .single();

        likedByMe = !!likeData;

        const { data: favData } = await supabase
          .from("favorites")
          .select("id")
          .eq("user_id", currentUserId)
          .eq("post_id", post.id)
          .single();

        favoritedByMe = !!favData;
      }

      return {
        _id: post.id,
        authorId: post.author_id,
        title: post.title,
        content: post.content,
        createdAt: new Date(post.created_at).getTime(),
        likes: post.likes,
        favorites: post.favorites,
        shares: post.shares,
        mediaUrls: (post.media || []).map((m: any) => ({
          url: getStorageUrl("media", m.storageId),
          type: m.type,
          mime: m.mime,
        })),
        documentUrls: (post.documents || []).map((d: any) => ({
          url: getStorageUrl("documents", d.storageId),
          name: d.name,
          size: d.size,
          mime: d.mime,
        })),
        authorName: author?.name || "Anónimo",
        authorImage: author?.image,
        authorImageUrl: author?.image
          ? getStorageUrl("avatars", author.image)
          : undefined,
        likedByMe,
        favoritedByMe,
        mentions: post.mentions || [],
        hashtags: post.hashtags || [],
      };
    })
  );

  // Apply scoring algorithm
  if (sortBy === "popular") {
    processedPosts.sort((a, b) => {
      const scoreA =
        a.likes * 2 + (a.shares || 0) * 4 + (a.favorites || 0) * 3;
      const scoreB =
        b.likes * 2 + (b.shares || 0) * 4 + (b.favorites || 0) * 3;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.createdAt - a.createdAt;
    });
  } else if (sortBy === "forYou") {
    const now = Date.now();
    processedPosts.sort((a, b) => {
      const baseScoreA =
        a.likes * 2 + (a.shares || 0) * 4 + (a.favorites || 0) * 3;
      const baseScoreB =
        b.likes * 2 + (b.shares || 0) * 4 + (b.favorites || 0) * 3;

      const ageHoursA = (now - a.createdAt) / (1000 * 60 * 60);
      const ageHoursB = (now - b.createdAt) / (1000 * 60 * 60);

      const recencyA = ageHoursA < 24 ? 1.5 : ageHoursA < 72 ? 1.2 : 1.0;
      const recencyB = ageHoursB < 24 ? 1.5 : ageHoursB < 72 ? 1.2 : 1.0;

      const scoreA = baseScoreA * recencyA;
      const scoreB = baseScoreB * recencyB;

      return scoreB - scoreA;
    });
  }
  // "following" is already sorted by created_at desc

  return processedPosts.slice(0, 50);
}

/**
 * Create a new post
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
  }
) {
  if (
    content.trim().length === 0 &&
    (!options?.media || options.media.length === 0) &&
    (!options?.documents || options.documents.length === 0)
  ) {
    throw new Error("La publicación no puede estar vacía");
  }

  if (content.length > 2000) {
    throw new Error("El contenido es demasiado largo (máximo 2000 caracteres)");
  }

  // Extract hashtags
  const textContent = content.replace(/<[^>]*>/g, "");
  const hashtagMatches = textContent.match(/#[\w\u00C0-\u024F]+/g);
  const hashtags = hashtagMatches
    ? [...new Set(hashtagMatches.map((h) => h.toLowerCase()))]
    : [];

  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: authorId,
      title: options?.title?.trim() || null,
      content: content.trim(),
      media: options?.media || [],
      documents: options?.documents || [],
      mentions: options?.mentions || [],
      hashtags,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a post
 */
export async function deletePost(postId: string, userId: string) {
  // Verify ownership
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", postId)
    .single();

  if (postError || !post) throw new Error("Publicación no encontrada");
  if (post.author_id !== userId) throw new Error("No autorizado");

  // Delete associated data
  await supabase.from("likes").delete().eq("post_id", postId);
  await supabase.from("favorites").delete().eq("post_id", postId);
  await supabase.from("comments").delete().eq("post_id", postId);

  // Delete the post
  const { error } = await supabase.from("posts").delete().eq("id", postId);

  if (error) throw error;
}

/**
 * Delete post as admin
 */
export async function deletePostAsAdmin(postId: string) {
  // Delete associated data
  await supabase.from("likes").delete().eq("post_id", postId);
  await supabase.from("favorites").delete().eq("post_id", postId);
  await supabase.from("comments").delete().eq("post_id", postId);

  // Delete the post
  const { error } = await supabase.from("posts").delete().eq("id", postId);

  if (error) throw error;
}

// ========================================
// LIKE FUNCTIONS
// ========================================

/**
 * Toggle like on a post
 */
export async function togglePostLike(userId: string, postId: string) {
  // Check if already liked
  const { data: existing } = await supabase
    .from("likes")
    .select("id")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .single();

  if (existing) {
    // Remove like
    await supabase.from("likes").delete().eq("id", existing.id);
    await supabase.rpc("decrement_post_likes", { post_id: postId });
    return false;
  } else {
    // Add like
    await supabase.from("likes").insert({ user_id: userId, post_id: postId });
    await supabase.rpc("increment_post_likes", { post_id: postId });
    return true;
  }
}

// ========================================
// FAVORITE FUNCTIONS
// ========================================

/**
 * Toggle favorite on a post
 */
export async function togglePostFavorite(userId: string, postId: string) {
  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .single();

  if (existing) {
    await supabase.from("favorites").delete().eq("id", existing.id);
    await supabase.rpc("decrement_post_favorites", { post_id: postId });
    return false;
  } else {
    await supabase
      .from("favorites")
      .insert({ user_id: userId, post_id: postId });
    await supabase.rpc("increment_post_favorites", { post_id: postId });
    return true;
  }
}

// ========================================
// COMMENT FUNCTIONS
// ========================================

/**
 * Get comments for a post
 */
export async function getComments(postId: string, currentUserId?: string) {
  const { data: comments, error } = await supabase
    .from("comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  // Get all unique author IDs
  const authorIds = [
    ...new Set((comments || []).map((c) => c.author_id)),
  ];

  // Fetch all authors in one query
  const { data: authors } = await supabase
    .from("users")
    .select("id, name, image")
    .in("id", authorIds);

  const authorMap = new Map(
    (authors || []).map((a) => [
      a.id,
      { name: a.name || "Anónimo", image: a.image },
    ])
  );

  // Process comments
  return await Promise.all(
    (comments || []).map(async (comment) => {
      const author = authorMap.get(comment.author_id);

      let likedByMe = false;
      if (currentUserId) {
        const { data } = await supabase
          .from("comment_likes")
          .select("id")
          .eq("user_id", currentUserId)
          .eq("comment_id", comment.id)
          .single();

        likedByMe = !!data;
      }

      return {
        ...comment,
        authorName: author?.name || "Anónimo",
        authorImage: author?.image,
        likedByMe,
      };
    })
  );
}

/**
 * Create a comment
 */
export async function createComment(
  postId: string,
  authorId: string,
  content: string,
  parentCommentId?: string
) {
  if (content.trim().length === 0) {
    throw new Error("El comentario no puede estar vacío");
  }

  if (content.length > 1000) {
    throw new Error(
      "El comentario es demasiado largo (máximo 1000 caracteres)"
    );
  }

  // Verify parent comment exists if replying
  if (parentCommentId) {
    const { data: parent } = await supabase
      .from("comments")
      .select("id")
      .eq("id", parentCommentId)
      .eq("post_id", postId)
      .single();

    if (!parent) {
      throw new Error("Comentario padre no encontrado");
    }
  }

  const { data, error } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      author_id: authorId,
      content: content.trim(),
      parent_comment_id: parentCommentId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Toggle comment like
 */
export async function toggleCommentLike(userId: string, commentId: string) {
  const { data: existing } = await supabase
    .from("comment_likes")
    .select("id")
    .eq("user_id", userId)
    .eq("comment_id", commentId)
    .single();

  if (existing) {
    await supabase.from("comment_likes").delete().eq("id", existing.id);
    await supabase.rpc("decrement_comment_likes", { comment_id: commentId });
    return false;
  } else {
    await supabase
      .from("comment_likes")
      .insert({ user_id: userId, comment_id: commentId });
    await supabase.rpc("increment_comment_likes", { comment_id: commentId });
    return true;
  }
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: string, userId: string) {
  // Verify ownership
  const { data: comment, error: commentError } = await supabase
    .from("comments")
    .select("author_id")
    .eq("id", commentId)
    .single();

  if (commentError || !comment) throw new Error("Comentario no encontrado");
  if (comment.author_id !== userId) throw new Error("No autorizado");

  // Delete likes for this comment
  await supabase.from("comment_likes").delete().eq("comment_id", commentId);

  // Delete replies to this comment
  const { data: replies } = await supabase
    .from("comments")
    .select("id")
    .eq("parent_comment_id", commentId);

  for (const reply of replies || []) {
    await supabase
      .from("comment_likes")
      .delete()
      .eq("comment_id", reply.id);
    await supabase.from("comments").delete().eq("id", reply.id);
  }

  // Delete the comment
  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);

  if (error) throw error;
}

// ========================================
// FOLLOW FUNCTIONS
// ========================================

/**
 * Toggle follow a user
 */
export async function toggleFollow(followerId: string, followingId: string) {
  if (followerId === followingId) {
    throw new Error("No puedes seguirte a ti mismo");
  }

  const { data: existing } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .single();

  if (existing) {
    await supabase.from("follows").delete().eq("id", existing.id);
    return false;
  } else {
    await supabase
      .from("follows")
      .insert({ follower_id: followerId, following_id: followingId });
    return true;
  }
}

/**
 * Check if user A follows user B
 */
export async function isFollowing(followerId: string, followingId: string) {
  const { data } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .single();

  return !!data;
}

/**
 * Get follow stats for a user
 */
export async function getFollowStats(userId: string) {
  const { count: followerCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", userId);

  const { count: followingCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", userId);

  return {
    followers: followerCount || 0,
    following: followingCount || 0,
  };
}

/**
 * Get list of followers
 */
export async function getFollowers(userId: string) {
  const { data: follows, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("following_id", userId);

  if (error) throw error;

  const followerIds = (follows || []).map((f) => f.follower_id);

  if (followerIds.length === 0) return [];

  const { data: users } = await supabase
    .from("users")
    .select("id, name, image")
    .in("id", followerIds);

  return (users || []).map((u) => ({
    _id: u.id,
    name: u.name || "Anónimo",
    imageUrl: u.image ? getStorageUrl("avatars", u.image) : undefined,
  }));
}

/**
 * Get list of users this user follows
 */
export async function getFollowing(userId: string) {
  const { data: follows, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (error) throw error;

  const followingIds = (follows || []).map((f) => f.following_id);

  if (followingIds.length === 0) return [];

  const { data: users } = await supabase
    .from("users")
    .select("id, name, image")
    .in("id", followingIds);

  return (users || []).map((u) => ({
    _id: u.id,
    name: u.name || "Anónimo",
    imageUrl: u.image ? getStorageUrl("avatars", u.image) : undefined,
  }));
}

// ========================================
// STORAGE FUNCTIONS
// ========================================

/**
 * Get public URL for a storage object
 */
export function getStorageUrl(bucket: string, path: string): string {
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
}

/**
 * Upload file to storage
 */
export async function uploadFile(
  bucket: string,
  file: File,
  path: string
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;

  return getStorageUrl(bucket, path);
}

/**
 * Delete file from storage
 */
export async function deleteFile(
  bucket: string,
  path: string
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) throw error;
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Generate unique file path
 */
export function generateFilePath(
  userId: string,
  fileName: string,
  folder: string = "uploads"
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = fileName.split(".").pop();
  return `${folder}/${userId}/${timestamp}-${random}.${ext}`;
}
