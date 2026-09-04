import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  X,
  Send,
  Heart,
  Flag,
  Search,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

import { PostLightbox } from "@/components/PostLightbox";
import { ImageInput } from "@/components/ImageInput";
import { BanBanner } from "@/components/BanBanner";
import { uploadCompressedImage } from "@/lib/upload-image";
import type { CompressedImage } from "@/lib/compress-image";
import { supabase } from "@/integrations/supabase/client";
import type { Post, PostType } from "@/types";

const CATEGORIES = ["Otazka", "Straty_a_nalezy", "Info_pre_susedov", "Hlasnik"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABEL: Record<Category, string> = {
  Otazka: "❓ Otázka",
  Straty_a_nalezy: "🔎 Straty a nálezy",
  Info_pre_susedov: "📣 Info pre susedov",
  Hlasnik: "📢 Hlásnik",
};

const NEIGHBOR_CATEGORIES: Category[] = ["Otazka", "Straty_a_nalezy", "Info_pre_susedov"];

const TRH_DISCLAIMER =
  "Prevádzkovateľ aplikácie nezodpovedá za legálnosť, kvalitu ani pôvod produktov. Používatelia sú povinní dodržiavať legislatívu SR (dane, hygiena).";
const OFFICIAL_NOTICE_MAX_DAYS = 4;
const POST_TTL_MS = 4 * 24 * 3600_000;

type Announcement = {
  id: string;
  source: "rss" | "internal";
  title: string;
  content: string;
  audio_url: string | null;
  expires_at: string | null;
  link: string | null;
  priority: "oznam" | "prioritne" | "urgentne" | "vystraha";
  published_at: string;
  author_id: string | null;
};

function timeAgo(iso: string) {
  if (!iso) return "pred chvíľou";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "pred chvíľou";
  if (s < 3600) return `pred ${Math.floor(s / 60)} min`;
  if (s < 86400) return `pred ${Math.floor(s / 3600)} h`;
  return `pred ${Math.floor(s / 86400)} dňami`;
}

function isAnnouncementExpired(item: Announcement) {
  if (!item.expires_at) return false;
  return new Date(item.expires_at).getTime() <= Date.now();
}

type ModalMode = null | { kind: "official" } | { kind: "neighbor" };

type CreatedPost = {
  id: string;
  userId: string;
  userName: string;
  type: PostType;
  category: string;
  title: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  expiresAt?: string;
};

type PostReply = {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
};

type PostProfileRow = { name: string | null; role: string | null };
type PostRow = {
  id: string;
  user_id: string;
  type: PostType;
  category: string | null;
  title: string;
  content: string;
  image_url: string | null;
  created_at: string;
  expires_at: string | null;
  profiles: PostProfileRow | null;
};

type ReplyProfileRow = { name: string | null };
type PostReplyRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: ReplyProfileRow | null;
};

function canReplyToPost(post: Post) {
  return post.type === "susedsky_zivot" && NEIGHBOR_CATEGORIES.includes(post.category as Category);
}

function isPostExpired(post: Post) {
  if (post.type === "hlasnik" || post.type === "official_alert") {
    const fallbackTs = new Date(post.createdAt).getTime() + POST_TTL_MS;
    const explicitTs = post.expiresAt ? new Date(post.expiresAt).getTime() : NaN;
    const expiryTs = Number.isFinite(explicitTs) ? explicitTs : fallbackTs;
    return expiryTs <= Date.now();
  }

  if (canReplyToPost(post)) {
    return new Date(post.createdAt).getTime() + POST_TTL_MS <= Date.now();
  }

  return false;
}

export function NastenkaScreen() {
  const { profile, userId } = useCurrentUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [repliesByPost, setRepliesByPost] = useState<Record<string, PostReply[]>>({});
  const [replyDraftByPost, setReplyDraftByPost] = useState<Record<string, string>>({});
  const [replyBusyByPost, setReplyBusyByPost] = useState<Record<string, boolean>>({});
  const [likesByPost, setLikesByPost] = useState<Record<string, boolean>>({});
  const [likesCountByPost, setLikesCountByPost] = useState<Record<string, number>>({});
  const [reportedByPost, setReportedByPost] = useState<Record<string, boolean>>({});
  const isReadonly = !(profile?.is_active_neighbor ?? false);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalMode>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [lightboxPost, setLightboxPost] = useState<Post | null>(null);

  const canCreateOfficialNotice = profile?.role === "Starosta" || profile?.role === "Uradnik";
  const canWrite = profile?.is_active_neighbor ?? false;

  const loadPosts = useCallback(async () => {
    // Načítame príspevky bez toho, aby sme riskovali vyradenie kvôli chýbajúcemu profilu
    const [postsRes, announcementsRes] = await Promise.all([
      supabase
        .from("posts")
        .select(
          "id, user_id, type, category, title, content, image_url, created_at, expires_at, profiles!user_id(name, role)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("announcements")
        .select("*")
        .eq("source", "internal")
        .order("published_at", { ascending: false }),
    ]);

    if (postsRes.error) {
      console.error("Chyba pri načítaní príspevkov zo Supabase:", postsRes.error);
      return;
    }

    const mapped: Post[] = ((postsRes.data as PostRow[] | null) ?? [])
      .map((row) => ({
        id: row.id,
        userId: row.user_id,
        userName: row.profiles?.name || "Sused", // Ochrana: ak chýba profil, nevypadneme, ale dáme default
        type: row.type,
        category: row.category ?? "Oznam",
        title: row.title,
        content: row.content,
        imageUrl: row.image_url ?? undefined,
        createdAt: row.created_at,
        expiresAt: row.expires_at ?? undefined,
        likes: [],
        isReported: false,
      }))
      .filter((post) => !isPostExpired(post));

    setPosts(mapped);

    // Načítaj announcements (Digitálny rozhlas)
    const announcementsList = ((announcementsRes.data as Announcement[] | null) ?? [])
      .filter((ann) => !isAnnouncementExpired(ann));
    setAnnouncements(announcementsList);

    const postIds = mapped.map((post) => post.id);
    if (postIds.length === 0) {
      setRepliesByPost({});
      setLikesByPost({});
      setLikesCountByPost({});
      setReportedByPost({});
      return;
    }

    const { data: replyRows } = await supabase
      .from("post_replies")
      .select("id, post_id, user_id, content, created_at, profiles!user_id(name)")
      .in("post_id", postIds)
      .order("created_at", { ascending: true });

    const repliesMap: Record<string, PostReply[]> = {};
    for (const row of (replyRows as PostReplyRow[] | null) ?? []) {
      const item: PostReply = {
        id: row.id,
        postId: row.post_id,
        userId: row.user_id,
        userName: row.profiles?.name ?? "Sused",
        content: row.content,
        createdAt: row.created_at,
      };
      if (!repliesMap[row.post_id]) repliesMap[row.post_id] = [];
      repliesMap[row.post_id].push(item);
    }
    setRepliesByPost(repliesMap);

    const { data: likeRows } = await supabase
      .from("post_likes")
      .select("post_id")
      .in("post_id", postIds);

    const likesCount: Record<string, number> = {};
    for (const row of likeRows ?? []) {
      likesCount[row.post_id] = (likesCount[row.post_id] ?? 0) + 1;
    }
    setLikesCountByPost(likesCount);

    if (!userId) {
      setLikesByPost({});
      setReportedByPost({});
      return;
    }

    const [{ data: likedRows }, { data: reportRows }] = await Promise.all([
      supabase.from("post_likes").select("post_id").eq("user_id", userId).in("post_id", postIds),
      supabase
        .from("post_reports")
        .select("post_id")
        .eq("reporter_id", userId)
        .in("post_id", postIds),
    ]);

    const likedMap: Record<string, boolean> = {};
    for (const row of likedRows ?? []) {
      likedMap[row.post_id] = true;
    }

    const reportedMap: Record<string, boolean> = {};
    for (const row of reportRows ?? []) {
      reportedMap[row.post_id] = true;
    }

    setLikesByPost(likedMap);
    setReportedByPost(reportedMap);
  }, [userId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadPosts();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadPosts]);

  useEffect(() => {
    let channel: any = null;
    let isMounted = true;

    const setupRealtime = async () => {
      try {
        // Unikátne meno kanála s timestamp
        const channelName = `nastenka-live-${Date.now()}`;
        channel = supabase.channel(channelName, {
          config: { broadcast: { ack: true } }
        });
        
        // Všetky .on() PRED .subscribe()
        channel
          .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
            if (isMounted) {
              void loadPosts();
            }
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "post_replies" }, () => {
            if (isMounted) {
              void loadPosts();
            }
          });

        await channel.subscribe((status: string) => {
          if (!isMounted) return;
          if (status !== 'SUBSCRIBED' && status !== 'SUBSCRIBING') {
            console.warn('Nastenka realtime status:', status);
          }
        });
      } catch (err) {
        if (isMounted) {
          console.error('Error setting up nastenka realtime:', err);
        }
      }
    };

    void setupRealtime();

    // Bezpečný cleanup - odpojenie kanála
    return () => {
      isMounted = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  async function toggleLike(postId: string) {
    if (!userId) return;

    const isLiked = !!likesByPost[postId];
    setLikesByPost((prev) => ({ ...prev, [postId]: !isLiked }));
    setLikesCountByPost((prev) => ({
      ...prev,
      [postId]: Math.max(0, (prev[postId] ?? 0) + (isLiked ? -1 : 1)),
    }));

    if (isLiked) {
      const { error } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);

      if (error) {
        setLikesByPost((prev) => ({ ...prev, [postId]: isLiked }));
        setLikesCountByPost((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
      }
      return;
    }

    const { error } = await supabase.from("post_likes").insert({
      post_id: postId,
      user_id: userId,
    });

    if (error) {
      setLikesByPost((prev) => ({ ...prev, [postId]: isLiked }));
      setLikesCountByPost((prev) => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] ?? 0) - 1),
      }));
    }
  }

  async function reportPost(postId: string) {
    if (!userId || reportedByPost[postId]) return;
    setReportedByPost((prev) => ({ ...prev, [postId]: true }));

    const { error } = await supabase.from("post_reports").upsert(
      {
        post_id: postId,
        reporter_id: userId,
      },
      {
        onConflict: "post_id,reporter_id",
        ignoreDuplicates: true,
      },
    );

    if (error) {
      setReportedByPost((prev) => ({ ...prev, [postId]: false }));
    }
  }

  async function addReply(postId: string) {
    if (!userId || replyBusyByPost[postId]) return;
    const content = (replyDraftByPost[postId] ?? "").trim();
    if (!content) return;

    setReplyBusyByPost((prev) => ({ ...prev, [postId]: true }));
    const { error } = await supabase.from("post_replies").insert({
      post_id: postId,
      user_id: userId,
      content,
    });
    setReplyBusyByPost((prev) => ({ ...prev, [postId]: false }));

    if (error) {
      return;
    }

    setReplyDraftByPost((prev) => ({ ...prev, [postId]: "" }));
    await loadPosts();
  }

  async function deletePost(postId: string) {
    if (!userId) return;
    if (!confirm("Naozaj vymazať tento príspevok?")) return;

    const { error } = await supabase.from("posts").delete().eq("id", postId).eq("user_id", userId);

    if (error) return;

    setPosts((prev) => prev.filter((post) => post.id !== postId));
    setRepliesByPost((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    if (lightboxPost?.id === postId) setLightboxPost(null);
  }

  async function updatePost(payload: {
    postId: string;
    title: string;
    content: string;
    category: Category;
  }) {
    if (!userId) return;
    const { error } = await supabase
      .from("posts")
      .update({
        title: payload.title,
        content: payload.content,
        category: payload.category,
      })
      .eq("id", payload.postId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }

    setPosts((prev) =>
      prev.map((post) =>
        post.id === payload.postId
          ? {
              ...post,
              title: payload.title,
              content: payload.content,
              category: payload.category,
            }
          : post,
      ),
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return posts;
    return posts.filter((p) =>
      [p.title, p.content, p.category, p.userName].join(" ").toLowerCase().includes(q),
    );
  }, [posts, q]);

  const oznamy = filtered.filter((p) => p.type === "hlasnik" || p.type === "official_alert");
  
  // Combine official posts and digital announcements for display
  const allNotices = useMemo(() => {
    return [
      ...oznamy.map(p => ({
        id: p.id,
        type: 'post' as const,
        title: p.title,
        content: p.content,
        createdAt: p.createdAt,
        imageUrl: p.imageUrl,
        userName: p.userName,
        post: p,
      })),
      ...announcements.map(a => ({
        id: a.id,
        type: 'announcement' as const,
        title: a.title,
        content: a.content,
        createdAt: a.published_at,
        imageUrl: null,
        userName: a.author_id ?? 'Obecný rozhlas',
        announcement: a,
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [oznamy, announcements]);

  // Auto-hide Hlásnik section if empty
  const hasNotices = allNotices.length > 0;

  const prispevky = filtered.filter((p) => {
    if (p.type !== "susedsky_zivot" && p.type !== "farsky_oznam") return false;
    if (!NEIGHBOR_CATEGORIES.includes(p.category as Category)) return false;
    return true;
  });

  const lightboxViewPost = useMemo(() => {
    if (!lightboxPost) return null;
    const likesCount = likesCountByPost[lightboxPost.id] ?? 0;
    return {
      ...lightboxPost,
      likes: Array.from({ length: likesCount }, () => ""),
      isReported: lightboxPost.isReported || !!reportedByPost[lightboxPost.id],
    };
  }, [lightboxPost, likesCountByPost, reportedByPost]);

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-y-auto">
      {/* Search */}
      <div className="sticky top-0 z-10 bg-[color:var(--bg-app)]/88 px-4 pb-2 pt-3 backdrop-blur md:px-6">
        <div className="app-surface-muted flex items-center gap-2 rounded-full px-3 py-2 backdrop-blur">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hľadať v príspevkoch…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {profile && (
        <div className="px-4 pt-3 md:px-6">
          <BanBanner profile={profile} />
        </div>
      )}

      {profile && !canWrite && (
        <div className="px-4 pt-3 md:px-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Režim čítania: na pridanie príspevkov, odpovedí, lajkov a správ potrebuješ platný
            pozývací kód.
          </div>
        </div>
      )}

      {/* Hlásnik */}
      <section className="border-b border-[color:var(--border-card)] bg-[color:var(--bg-surface)] pb-3 text-foreground">
        <div className="flex items-center justify-between px-4 pb-2 pt-1 md:px-6">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">📢 Obecný hlásnik</h2>
            <p className="text-[11px] text-muted-foreground">Oficiálne oznamy a digitálny rozhlas</p>
          </div>
          {canCreateOfficialNotice && !isReadonly && (
            <button
              onClick={() => setModal({ kind: "official" })}
              className="btn-primary-glow flex items-center gap-1 px-3 py-1.5 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> Pridať úradný oznam
            </button>
          )}
        </div>
        {hasNotices && (
          <div className="overflow-x-auto md:overflow-visible">
            <div className="flex gap-3 px-4 pb-2 md:grid md:grid-cols-2 md:px-6 xl:grid-cols-3">
              {allNotices.map((notice) => (
                notice.type === 'post' && notice.post ? (
                  <OfficialCard
                    key={notice.id}
                    post={notice.post}
                    onOpen={() => setLightboxPost(notice.post)}
                    onReport={() => {
                      void reportPost(notice.post!.id);
                    }}
                    reported={notice.post.isReported || !!reportedByPost[notice.post.id]}
                    locked={!canWrite}
                  />
                ) : notice.type === 'announcement' && notice.announcement ? (
                  <AnnouncementNoticeCard
                    key={notice.id}
                    announcement={notice.announcement}
                  />
                ) : null
              ))}
            </div>
          </div>
        )}
        {!hasNotices && (
          <div className="text-center py-6 text-xs text-neutral-500">
            Zatiaľ žiadne oznamy.
          </div>
        )}
      </section>

      {/* Susedský život */}
      <section className="flex flex-col">
        <div className="flex items-center justify-between px-4 pb-2 pt-4 md:px-6">
          <div>
            <h2 className="text-base font-semibold tracking-tight">🏘️ Susedský život</h2>
            <p className="text-[11px] text-muted-foreground">Príspevky od susedov</p>
          </div>
          {!isReadonly && (
            <button
              onClick={() => setModal({ kind: "neighbor" })}
              className="btn-primary-glow flex items-center gap-1 px-2.5 py-1 text-xs font-medium"
            >
              <Plus className="h-3 w-3" /> Príspevok
            </button>
          )}
        </div>
        <div className="px-4 pb-4 md:px-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {prispevky.length === 0 && (
              <p className="py-8 text-center text-xs text-neutral-500">
                {q ? "Nič nezodpovedá vyhľadávaniu." : "Zatiaľ žiadne príspevky. Buď prvý!"}
              </p>
            )}
            {prispevky.map((p) => (
              <NeighborCard
                key={p.id}
                post={p}
                liked={!!likesByPost[p.id]}
                locked={!canWrite}
                onOpen={() => setLightboxPost(p)}
                onLike={() => {
                  void toggleLike(p.id);
                }}
                onReport={() => {
                  void reportPost(p.id);
                }}
                replies={repliesByPost[p.id] ?? []}
                likesCount={likesCountByPost[p.id] ?? 0}
                reported={p.isReported || !!reportedByPost[p.id]}
              />
            ))}
          </div>
        </div>
      </section>

      {modal && (
        <NewPostModal
          mode={modal.kind}
          onClose={() => setModal(null)}
          onPosted={(createdPost) => {
            setPosts((prev) => [
              {
                ...createdPost,
                likes: [],
                isReported: false,
              },
              ...prev.filter((post) => post.id !== createdPost.id),
            ]);
            void loadPosts();
          }}
        />
      )}

      {editingPost && (
        <EditPostModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSave={async (payload) => {
            await updatePost(payload);
            setEditingPost(null);
          }}
        />
      )}

      <PostLightbox
        post={lightboxViewPost}
        liked={lightboxPost ? !!likesByPost[lightboxPost.id] : false}
        isReadonly={!canWrite}
        canManage={!!lightboxPost && lightboxPost.userId === userId && canWrite}
        onEdit={
          lightboxPost && canWrite
            ? () => {
                setEditingPost(lightboxPost);
                setLightboxPost(null);
              }
            : undefined
        }
        onDelete={
          lightboxPost && canWrite
            ? () => {
                void deletePost(lightboxPost.id);
              }
            : undefined
        }
        replies={lightboxPost ? (repliesByPost[lightboxPost.id] ?? []) : []}
        canReply={!!lightboxPost && canWrite && canReplyToPost(lightboxPost)}
        replyDraft={lightboxPost ? (replyDraftByPost[lightboxPost.id] ?? "") : ""}
        onReplyDraftChange={
          lightboxPost && canWrite
            ? (value) => {
                setReplyDraftByPost((prev) => ({ ...prev, [lightboxPost.id]: value }));
              }
            : undefined
        }
        onReplySubmit={
          lightboxPost && canWrite
            ? () => {
                void addReply(lightboxPost.id);
              }
            : undefined
        }
        replyBusy={lightboxPost ? !!replyBusyByPost[lightboxPost.id] : false}
        onLike={
          lightboxPost
            ? () => {
                void toggleLike(lightboxPost.id);
              }
            : undefined
        }
        onReport={
          lightboxPost
            ? () => {
                void reportPost(lightboxPost.id);
                setLightboxPost(null);
              }
            : undefined
        }
        onClose={() => setLightboxPost(null)}
      />
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const label = CATEGORY_LABEL[category as Category] ?? category;
  return (
    <span className="chip-muted rounded-full px-2 py-0.5 text-[10px] font-medium">
      {label}
    </span>
  );
}

function OfficialCard({
  post,
  onOpen,
  onReport,
  reported,
  locked,
}: {
  post: Post;
  onOpen: () => void;
  onReport: () => void;
  reported: boolean;
  locked: boolean;
}) {
  return (
    <article
      onClick={onOpen}
      className="flex h-full w-64 shrink-0 cursor-pointer flex-col rounded-2xl border border-[color:var(--border-card)] bg-[color:var(--bg-surface-hover)] p-3 shadow-sm transition hover:shadow-md md:w-auto md:shrink"
    >
      <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-brand">
        <span>{timeAgo(post.createdAt)}</span>
        {reported && <span className="text-rose-600">nahlásené</span>}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{post.title}</h3>
      <p className="mt-1 line-clamp-3 flex-1 text-xs leading-snug text-muted-foreground">
        {post.content}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{post.userName}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReport();
          }}
          disabled={reported || locked}
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-[color:var(--bg-surface)] disabled:opacity-40"
          title={locked ? "Aktivuj pozývací kód" : undefined}
        >
          <Flag className="h-3 w-3" /> Nahlásiť
        </button>
      </div>
    </article>
  );
}

function AnnouncementNoticeCard({ announcement }: { announcement: Announcement }) {
  const priorityColors: Record<string, string> = {
    oznam: "border-neutral-200 bg-neutral-50",
    prioritne: "border-yellow-200 bg-yellow-50",
    urgentne: "border-orange-200 bg-orange-50",
    vystraha: "border-red-200 bg-red-50",
  };

  const priorityBadge: Record<string, string> = {
    oznam: "text-neutral-700",
    prioritne: "text-yellow-700",
    urgentne: "text-orange-700",
    vystraha: "text-red-700",
  };

  return (
    <article
      className={`flex h-full w-64 shrink-0 flex-col rounded-2xl border ${priorityColors[announcement.priority]} p-3 shadow-sm transition hover:shadow-md md:w-auto md:shrink`}
    >
      <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider">
        <span className={`text-brand ${priorityBadge[announcement.priority]}`}>
          📻 {announcement.priority === "oznam" ? "Rozhlas" : announcement.priority}
        </span>
        <span className="text-[10px] text-muted-foreground">{timeAgo(announcement.published_at)}</span>
      </div>
      <h3 className="text-sm font-semibold text-foreground">{announcement.title}</h3>
      <p className="mt-1 line-clamp-3 flex-1 text-xs leading-snug text-muted-foreground">
        {announcement.content}
      </p>
      <div className="mt-2">
        <span className="text-[10px] text-muted-foreground">Digitálny rozhlas</span>
      </div>
    </article>
  );
}

function NeighborCard({
  post,
  liked,
  likesCount,
  reported,
  locked,
  onOpen,
  onLike,
  onReport,
  replies,
}: {
  post: Post;
  liked: boolean;
  likesCount: number;
  reported: boolean;
  locked: boolean;
  onOpen: () => void;
  onLike: () => void;
  onReport: () => void;
  replies: PostReply[];
}) {
  const showTrhDisclaimer = post.category === "Susedsky_trh";
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  return (
    <article
      onClick={onOpen}
      className="app-card cursor-pointer rounded-2xl p-3 shadow-sm backdrop-blur transition hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="chip-muted flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold">
            {post.userName.charAt(0)}
          </div>
          <div>
            <div className="text-xs font-semibold text-foreground">
              {post.userName}
            </div>
            <div className="text-[10px] text-muted-foreground">{timeAgo(post.createdAt)}</div>
          </div>
        </div>
        <CategoryBadge category={post.category} />
      </div>

      {post.title && (
        <p className="mt-2 text-sm font-semibold text-foreground">
          {post.title}
        </p>
      )}
      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
        {post.content}
      </p>
      {post.imageUrl && (
        <img src={post.imageUrl} alt="" className="mt-2 max-h-64 w-full rounded-xl object-cover" />
      )}

      {showTrhDisclaimer && (
        <div className="mt-2 flex gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 text-[10px] leading-snug text-amber-900 dark:border-amber-300 dark:bg-amber-100 dark:text-amber-900">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-900" />
          <span>{TRH_DISCLAIMER}</span>
        </div>
      )}

      <div className="mt-2 flex items-center gap-3 border-t border-[color:var(--border-card)] pt-2 text-[11px]">
        <button
          onClick={stop(onLike)}
          disabled={locked}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 transition ${
            liked
              ? "text-rose-600"
                : "text-muted-foreground hover:bg-[color:var(--bg-surface-hover)]"
          } ${locked ? "cursor-not-allowed opacity-40 hover:bg-transparent" : ""}`}
          title={locked ? "Aktivuj pozývací kód" : undefined}
        >
          <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
          <span>{likesCount}</span>
        </button>
        <span className="text-muted-foreground">💬 {replies.length}</span>
        <button
          onClick={stop(onReport)}
          disabled={reported || locked}
          className="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-muted-foreground hover:bg-[color:var(--bg-surface-hover)] disabled:opacity-40"
          title={locked ? "Aktivuj pozývací kód" : undefined}
        >
          <Flag className="h-3.5 w-3.5" />
          {reported ? "Nahlásené" : "Nahlásiť"}
        </button>
      </div>

      <div className="mt-2 flex items-center justify-end border-t border-[color:var(--border-card)] pt-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          Rozklikni detail
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </article>
  );
}

function EditPostModal({
  post,
  onClose,
  onSave,
}: {
  post: Post;
  onClose: () => void;
  onSave: (payload: {
    postId: string;
    title: string;
    content: string;
    category: Category;
  }) => Promise<void>;
}) {
  const isOfficial = post.type === "hlasnik" || post.type === "official_alert";
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [category, setCategory] = useState<Category>(() => {
    if (isOfficial) return "Hlasnik";
    return NEIGHBOR_CATEGORIES.includes(post.category as Category)
      ? (post.category as Category)
      : "Otazka";
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onSave({
        postId: post.id,
        title: title.trim() || (isOfficial ? "Oznam" : "Príspevok"),
        content: content.trim(),
        category,
      });
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Uloženie zlyhalo.");
    } finally {
      setBusy(false);
    }
  }

  const options = isOfficial ? (["Hlasnik"] as Category[]) : NEIGHBOR_CATEGORIES;

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/30 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-5">
      <div className="app-modal-surface flex h-full w-full flex-col md:h-auto md:max-h-[92%] md:max-w-2xl md:rounded-3xl md:border md:border-[color:var(--border-card)] md:shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[color:var(--border-card)] px-4 py-3">
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[color:var(--bg-surface-hover)]"
            aria-label="Zavrieť"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="font-semibold">✏️ Upraviť príspevok</h2>
        </div>

        <form onSubmit={submit} className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Kategória</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {options.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    category === c
                      ? "btn-primary-glow"
                      : "chip-muted hover:bg-[color:var(--bg-surface-hover)]"
                  }`}
                >
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Nadpis</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="app-input mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Obsah</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              required
              className="app-input mt-1 w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
            />
          </div>

          {err && <p className="text-xs text-rose-600">{err}</p>}

          <div className="mt-auto flex flex-col gap-2 pt-4">
            <button
              type="submit"
              disabled={busy}
              className="btn-primary-glow flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              Uložiť zmeny
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="app-surface-muted w-full rounded-xl py-3 text-sm font-medium text-muted-foreground hover:bg-[color:var(--bg-surface-hover)] disabled:opacity-60"
            >
              Zrušiť
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewPostModal({
  mode,
  onClose,
  onPosted,
}: {
  mode: "official" | "neighbor";
  onClose: () => void;
  onPosted: (createdPost: CreatedPost) => void;
}) {
  const { profile, userId } = useCurrentUser();
  const isOfficial = mode === "official";
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Category>(isOfficial ? "Hlasnik" : "Otazka");
  const [image, setImage] = useState<CompressedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canAttachImage = !isOfficial && category === "Straty_a_nalezy";

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!content.trim() || busy || !userId) return;

    setBusy(true);
    setErr(null);

    try {
      const type: PostType = isOfficial ? "hlasnik" : "susedsky_zivot";
      const finalTitle = title.trim() || (isOfficial ? "Oznam" : "Príspevok");
      const finalContent = content.trim();

      let imageUrl: string | null = null;
      if (canAttachImage && image) {
        const upload = await uploadCompressedImage(image, userId);
        imageUrl = upload.imageUrl;
      }

      const postData = {
        user_id: userId,
        type,
        category,
        title: finalTitle,
        content: finalContent,
        image_url: imageUrl,
        expires_at: isOfficial
          ? new Date(Date.now() + OFFICIAL_NOTICE_MAX_DAYS * 24 * 3600_000).toISOString()
          : null,
      };

      console.log("Odosielam do Supabase:", postData);

      const { data, error } = await supabase
        .from("posts")
        .insert(postData)
        .select("id, user_id, type, category, title, content, image_url, created_at, expires_at")
        .single();

      if (error) {
        console.error("CHYBA SUPABASE (DETAIL):", error);
        throw new Error(error.message || "Nepodarilo sa uložiť príspevok.");
      }

      onPosted({
        id: data.id,
        userId: data.user_id,
        userName: profile?.name ?? "Sused",
        type: data.type as PostType,
        category: data.category ?? category,
        title: data.title,
        content: data.content,
        imageUrl: data.image_url ?? undefined,
        createdAt: data.created_at,
        expiresAt: data.expires_at ?? undefined,
      });

      onClose();
    } catch (err: unknown) {
      console.error("Užívateľská chyba:", err);
      setErr(err instanceof Error ? err.message : "Nepodarilo sa uložiť príspevok.");
    } finally {
      setBusy(false);
    }
  }

  const options = isOfficial ? (["Hlasnik"] as Category[]) : NEIGHBOR_CATEGORIES;

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/30 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-5">
      <div className="flex h-full w-full flex-col bg-white dark:bg-neutral-950 md:h-auto md:max-h-[92%] md:max-w-2xl md:rounded-3xl md:border md:border-neutral-200 md:shadow-2xl dark:md:border-white/15">
        <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-white/10">
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-white/10"
            aria-label="Zavrieť"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="font-semibold">
            {isOfficial ? "📢 Nový úradný oznam" : "🏘️ Nový príspevok"}
          </h2>
        </div>

        <form onSubmit={submit} className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Kategória</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {options.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    category === c
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/15"
                  }`}
                >
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Nadpis</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isOfficial ? "Napr. Odstávka vody" : "Krátky nadpis (voliteľné)"}
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-400 dark:bg-neutral-200 dark:text-neutral-900"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Obsah</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={5}
              className="mt-1 w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-400 dark:bg-neutral-200 dark:text-neutral-900"
            />
          </div>

          {canAttachImage && (
            <ImageInput value={image} onChange={setImage} label="Fotka (1 obrázok, voliteľné)" />
          )}

          {err && <p className="text-xs text-rose-600">{err}</p>}

          <div className="mt-auto flex flex-col gap-2 pt-4">
            <button
              type="submit"
              disabled={busy}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-md active:scale-[0.99] disabled:opacity-60 ${
                isOfficial ? "bg-orange-500" : "bg-neutral-900"
              }`}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Zverejniť
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="w-full rounded-xl border border-neutral-200 bg-white py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-300 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              Zrušiť
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
