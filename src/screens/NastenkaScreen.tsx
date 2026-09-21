import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
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
  Radio,
  Megaphone,
  Info,
  Building2,
  Siren,
  Volume2,
  Trash2,
  Maximize2,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

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

type PostReply = {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
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
  const [likesByPost, setLikesByPost] = useState<Record<string, boolean>>({});
  const [likesCountByPost, setLikesCountByPost] = useState<Record<string, number>>({});
  const [reportedByPost, setReportedByPost] = useState<Record<string, boolean>>({});
  const isReadonly = !(profile?.is_active_neighbor ?? false);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalMode>(null);
  const [lightboxPost, setLightboxPost] = useState<Post | null>(null);

  const canCreateOfficialNotice = profile?.role === "Starosta" || profile?.role === "Uradnik";
  const canWrite = profile?.is_active_neighbor ?? false;

  const loadPosts = useCallback(async () => {
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
        userName: row.profiles?.name || "Sused",
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

    const announcementsList = ((announcementsRes.data as Announcement[] | null) ?? []).filter(
      (ann) => !isAnnouncementExpired(ann),
    );
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

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return posts;
    return posts.filter((p) =>
      [p.title, p.content, p.category, p.userName].join(" ").toLowerCase().includes(q),
    );
  }, [posts, q]);

  const oznamy = filtered.filter((p) => p.type === "hlasnik" || p.type === "official_alert");

  const allNotices = useMemo(() => {
    return [
      ...oznamy.map((p) => ({
        id: p.id,
        type: "post" as const,
        title: p.title,
        content: p.content,
        createdAt: p.createdAt,
        imageUrl: p.imageUrl,
        userName: p.userName,
        post: p,
      })),
      ...announcements.map((a) => ({
        id: a.id,
        type: "announcement" as const,
        title: a.title,
        content: a.content,
        createdAt: a.published_at,
        imageUrl: null,
        userName: a.author_id ?? "Obecný rozhlas",
        announcement: a,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [oznamy, announcements]);

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
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              📢 Obecný hlásnik
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Oficiálne oznamy a digitálny rozhlas
            </p>
          </div>
          {canCreateOfficialNotice && !isReadonly && (
            <button
              onClick={() => {
                setLightboxPost(null);
                setModal({ kind: "official" });
              }}
              className="btn-primary-glow flex items-center gap-1 px-3 py-1.5 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> Pridať úradný oznam
            </button>
          )}
        </div>
        {hasNotices && (
          <div className="overflow-x-auto md:overflow-visible">
            <div className="flex gap-3 px-4 pb-2 md:grid md:grid-cols-2 md:px-6 xl:grid-cols-3">
              {allNotices.map((notice) =>
                notice.type === "post" && notice.post ? (
                  <OfficialCard
                    key={notice.id}
                    post={notice.post}
                    onOpen={() => {
                      setModal(null);
                      setLightboxPost(notice.post);
                    }}
                    onReport={() => {
                      void reportPost(notice.post!.id);
                    }}
                    reported={notice.post.isReported || !!reportedByPost[notice.post.id]}
                    locked={!canWrite}
                  />
                ) : notice.type === "announcement" && notice.announcement ? (
                  <AnnouncementNoticeCard key={notice.id} announcement={notice.announcement} />
                ) : null,
              )}
            </div>
          </div>
        )}
        {!hasNotices && (
          <div className="text-center py-6 text-xs text-neutral-500">Zatiaľ žiadne oznamy.</div>
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
              onClick={() => {
                setLightboxPost(null);
                setModal({ kind: "neighbor" });
              }}
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
                onOpen={() => {
                  setModal(null);
                  setLightboxPost(p);
                }}
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

      {/* Modálne okno pre vytvorenie obsahu (bez prekrývania) */}
      {modal && !lightboxPost && (
        <CreatePostModal
          mode={modal.kind}
          onClose={() => setModal(null)}
          onCreated={() => {
            setModal(null);
            void loadPosts();
          }}
          userId={userId}
        />
      )}

      {/* Lightbox / Celooknový detail príspevku s komentármi */}
      {lightboxViewPost && !modal && (
        <PostLightboxModal
          post={lightboxViewPost}
          replies={repliesByPost[lightboxViewPost.id] ?? []}
          userId={userId}
          canWrite={canWrite}
          onClose={() => setLightboxPost(null)}
          onUpdate={() => void loadPosts()}
          onDelete={() => void deletePost(lightboxViewPost.id)}
          onLike={() => void toggleLike(lightboxViewPost.id)}
          liked={!!likesByPost[lightboxViewPost.id]}
        />
      )}
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const label = CATEGORY_LABEL[category as Category] ?? category;
  return (
    <span className="chip-muted rounded-full px-2 py-0.5 text-[10px] font-medium">{label}</span>
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
      className="flex h-full w-64 shrink-0 cursor-pointer flex-col rounded-xl border border-border bg-card p-2.5 shadow-sm transition hover:shadow-md md:w-auto md:shrink"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10 text-blue-500">
            <Megaphone className="h-3.5 w-3.5" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Úradný oznam
          </span>
        </div>
        <span className="text-[9px] text-muted-foreground">{timeAgo(post.createdAt)}</span>
      </div>

      <h3 className="text-xs font-semibold text-foreground leading-snug line-clamp-1">
        {post.title}
      </h3>

      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
        {post.content}
      </p>

      {reported && <div className="mt-1 text-[9px] font-medium text-rose-600">Nahlásené</div>}

      <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-border/40 text-[10px] text-muted-foreground">
        <span className="truncate max-w-[100px]">{post.userName}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReport();
          }}
          disabled={reported || locked}
          className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
          title={locked ? "Aktivuj pozývací kód" : undefined}
        >
          <Flag className="h-3 w-3" /> Nahlásiť
        </button>
      </div>
    </article>
  );
}

function AnnouncementNoticeCard({ announcement }: { announcement: Announcement }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const priorityConfig: Record<
    string,
    { label: string; icon: React.ReactNode; colorClass: string }
  > = {
    vystraha: {
      label: "Výstraha",
      icon: <Siren className="h-3.5 w-3.5 text-red-500" />,
      colorClass: "bg-red-500/10",
    },
    urgentne: {
      label: "Urgentné",
      icon: <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />,
      colorClass: "bg-orange-500/10",
    },
    prioritne: {
      label: "Prioritné",
      icon: <Info className="h-3.5 w-3.5 text-yellow-500" />,
      colorClass: "bg-yellow-500/10",
    },
    oznam: {
      label: "Digitálny rozhlas",
      icon: <Volume2 className="h-3.5 w-3.5 text-orange-500" />,
      colorClass: "bg-orange-500/10",
    },
  };

  const currentConfig = priorityConfig[announcement.priority] ?? priorityConfig.oznam;

  const togglePlayAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!announcement.audio_url || !audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.error("Chyba pri prehrávaní audia:", err);
        });
    }
  };

  return (
    <article className="flex h-full w-64 shrink-0 flex-col rounded-xl border border-border bg-card p-2.5 shadow-sm transition hover:shadow-md md:w-auto md:shrink">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-md ${currentConfig.colorClass}`}
          >
            {currentConfig.icon}
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
            {currentConfig.label}
          </span>
        </div>
        <span className="text-[9px] text-muted-foreground">
          {timeAgo(announcement.published_at)}
        </span>
      </div>

      <h3 className="text-xs font-semibold text-foreground leading-snug line-clamp-1">
        {announcement.title}
      </h3>

      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
        {announcement.content}
      </p>

      {announcement.audio_url && (
        <audio
          ref={audioRef}
          src={announcement.audio_url}
          onEnded={() => setIsPlaying(false)}
          preload="none"
        />
      )}

      <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-border/40 text-[10px]">
        <span className="text-muted-foreground">Obecný rozhlas</span>
        <div className="flex items-center gap-2">
          {announcement.audio_url && (
            <button
              onClick={togglePlayAudio}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition ${
                isPlaying
                  ? "bg-orange-500 text-white animate-pulse"
                  : "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20"
              }`}
            >
              <Volume2 className="h-3 w-3" />
              <span>{isPlaying ? "Hrať" : "Prehrať"}</span>
            </button>
          )}
          <Link
            to="/aktuality"
            className="font-semibold text-primary hover:underline flex items-center gap-0.5"
          >
            Archív →
          </Link>
        </div>
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
            <div className="text-xs font-semibold text-foreground">{post.userName}</div>
            <div className="text-[10px] text-muted-foreground">{timeAgo(post.createdAt)}</div>
          </div>
        </div>
        <CategoryBadge category={post.category} />
      </div>

      {post.title && <p className="mt-2 text-sm font-semibold text-foreground">{post.title}</p>}
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

function PostLightboxModal({
  post,
  replies,
  userId,
  canWrite,
  onClose,
  onUpdate,
  onDelete,
  onLike,
  liked,
}: {
  post: Post & { isReported?: boolean };
  replies: PostReply[];
  userId: string | null;
  canWrite: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  onLike: () => void;
  liked: boolean;
}) {
  const [replyContent, setReplyContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [fullImageOpen, setFullImageOpen] = useState(false);

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !replyContent.trim() || busy) return;

    setBusy(true);
    const { error } = await supabase.from("post_replies").insert({
      post_id: post.id,
      user_id: userId,
      content: replyContent.trim(),
    });
    setBusy(false);

    if (!error) {
      setReplyContent("");
      onUpdate();
    }
  }

  const isAuthor = userId === post.userId;

  return (
    <>
      {/* Hlavné celooknové okno detailu príspevku */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 backdrop-blur-sm">
        <div className="flex h-full max-h-[96vh] w-full max-w-3xl flex-col rounded-3xl bg-[color:var(--bg-surface)] shadow-2xl border border-[color:var(--border-card)] overflow-hidden">
          {/* Header s tlačidlom X */}
          <div className="flex items-center justify-between border-b border-[color:var(--border-card)] px-5 py-4 bg-card/50">
            <div className="flex items-center gap-3">
              <div className="chip-muted flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold">
                {post.userName.charAt(0)}
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{post.userName}</div>
                <div className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAuthor && (
                <button
                  onClick={onDelete}
                  className="rounded-full p-2 text-rose-600 hover:bg-rose-50 transition"
                  title="Vymazať príspevok"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted transition flex items-center gap-1 text-xs font-semibold"
                title="Zavrieť"
              >
                <X className="h-6 w-6" />
                <span className="hidden sm:inline">Zavrieť</span>
              </button>
            </div>
          </div>

          {/* Obsah príspevku (rolovateľný) */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {post.title && <h2 className="text-lg font-bold text-foreground">{post.title}</h2>}
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {post.content}
            </p>

            {/* Fotografia s možnosťou kliknutia na celú plochu */}
            {post.imageUrl && (
              <div
                className="relative group cursor-pointer overflow-hidden rounded-2xl border border-border bg-black/5"
                onClick={() => setFullImageOpen(true)}
              >
                <img
                  src={post.imageUrl}
                  alt=""
                  className="max-h-[50vh] w-full object-contain mx-auto"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white gap-2 text-xs font-semibold">
                  <Maximize2 className="h-5 w-5" /> Zväčšiť fotografiu
                </div>
              </div>
            )}

            {/* Lajky a akcie */}
            <div className="flex items-center gap-4 pt-4 border-t border-[color:var(--border-card)] text-sm">
              <button
                onClick={onLike}
                disabled={!canWrite}
                className={`flex items-center gap-2 font-medium transition px-3 py-1.5 rounded-full bg-muted/50 ${liked ? "text-rose-600 bg-rose-50 dark:bg-rose-950/30" : "text-muted-foreground hover:bg-muted"}`}
              >
                <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
                <span>{post.likes?.length || 0} Páči sa mi</span>
              </button>
              <span className="text-muted-foreground">💬 {replies.length} komentárov</span>
            </div>

            {/* Sekcia komentárov */}
            <div className="space-y-3 pt-4 border-t border-[color:var(--border-card)]">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Komentáre a odpovede
              </h4>
              {replies.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">
                  Zatiaľ žiadne komentáre. Buď prvý!
                </p>
              ) : (
                replies.map((reply) => (
                  <div key={reply.id} className="rounded-2xl bg-muted/40 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-foreground">
                      <span>{reply.userName}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {timeAgo(reply.createdAt)}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{reply.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Vstup pre komentár (Footer) */}
          {canWrite ? (
            <form
              onSubmit={handleSendReply}
              className="border-t border-[color:var(--border-card)] p-3 sm:p-4 flex gap-2 bg-card"
            >
              <input
                type="text"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Napíšte komentár alebo odpoveď..."
                className="flex-1 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs sm:text-sm text-foreground outline-none"
              />
              <button
                type="submit"
                disabled={busy || !replyContent.trim()}
                className="btn-primary-glow flex items-center justify-center rounded-2xl px-5 py-2.5 text-xs sm:text-sm font-semibold disabled:opacity-50 gap-1.5"
              >
                <span>Odoslať</span>
                <Send className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div className="border-t border-[color:var(--border-card)] p-3 text-center text-xs text-amber-800 bg-amber-50">
              Na pridávanie komentárov je potrebný aktívny pozývací kód.
            </div>
          )}
        </div>
      </div>

      {/* Samostatné zobrazenie fotografie na celú plochu (Lightbox pre obrázok, z-index vyšší, obsahuje tlačidlo X) */}
      {fullImageOpen && post.imageUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md">
          <button
            onClick={() => setFullImageOpen(false)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition flex items-center gap-1.5 text-sm font-semibold"
            title="Zavrieť obrázok"
          >
            <X className="h-6 w-6" />
            <span>Zavrieť</span>
          </button>
          <img
            src={post.imageUrl}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl"
          />
        </div>
      )}
    </>
  );
}

function CreatePostModal({
  mode,
  onClose,
  onCreated,
  userId,
}: {
  mode: "official" | "neighbor";
  onClose: () => void;
  onCreated: () => void;
  userId: string | null;
}) {
  const isOfficial = mode === "official";
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Category>(NEIGHBOR_CATEGORIES[0]);
  const [compressedImage, setCompressedImage] = useState<CompressedImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!title.trim() || !content.trim()) {
      setError("Vyplňte názov aj obsah.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let imageUrl: string | null = null;
      if (compressedImage) {
        const upload = await uploadCompressedImage(compressedImage, userId);
        imageUrl = upload.imageUrl;
      }

      const postType: PostType = isOfficial ? "hlasnik" : "susedsky_zivot";
      const postCategory = isOfficial ? "Hlasnik" : category;

      const { error: insertErr } = await supabase.from("posts").insert({
        user_id: userId,
        type: postType,
        category: postCategory,
        title: title.trim(),
        content: content.trim(),
        image_url: imageUrl,
      });

      if (insertErr) throw insertErr;

      onCreated();
    } catch (err) {
      console.error("Chyba pri vytváraní príspevku:", err);
      setError("Nepodarilo sa vytvoriť príspevok. Skúste to znova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-[color:var(--bg-surface)] p-6 shadow-2xl border border-[color:var(--border-card)]">
        <div className="flex items-center justify-between pb-3 border-b border-[color:var(--border-card)]">
          <h3 className="text-base font-semibold text-foreground">
            {isOfficial ? "📢 Pridať úradný oznam" : "✍️ Nový susedský príspevok"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted transition"
            title="Zavrieť"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          {error && <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

          {!isOfficial && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Kategória
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground outline-none"
              >
                {NEIGHBOR_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABEL[cat]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Názov</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Zadajte názov..."
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Obsah</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Napíšte podrobnosti..."
              rows={4}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground outline-none resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Obrázok (nepovinné)
            </label>
            <ImageInput value={compressedImage} onChange={setCompressedImage} />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-card)]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              Zrušiť
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary-glow flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Publikovať</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
