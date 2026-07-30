import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, Send, Heart, Flag, Search, AlertTriangle, Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

import { PostLightbox } from "@/components/PostLightbox";
import { ImageInput } from "@/components/ImageInput";
import { BanBanner } from "@/components/BanBanner";
import { uploadCompressedImage } from "@/lib/upload-image";
import type { CompressedImage } from "@/lib/compress-image";
import { supabase } from "@/integrations/supabase/client";
import type { Post, PostType } from "@/types";

const CATEGORIES = [
  "Otazka",
  "Straty_a_nalezy",
  "Info_pre_susedov",
  "Hlasnik",
] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABEL: Record<Category, string> = {
  Otazka: "❓ Otázka",
  Straty_a_nalezy: "🔎 Straty a nálezy",
  Info_pre_susedov: "📣 Info pre susedov",
  Hlasnik: "📢 Hlásnik",
};

const NEIGHBOR_CATEGORIES: Category[] = [
  "Otazka",
  "Straty_a_nalezy",
  "Info_pre_susedov",
];

const TRH_DISCLAIMER =
  "Prevádzkovateľ aplikácie nezodpovedá za legálnosť, kvalitu ani pôvod produktov. Používatelia sú povinní dodržiavať legislatívu SR (dane, hygiena).";
const OFFICIAL_NOTICE_MAX_DAYS = 5;

function timeAgo(iso: string) {
  if (!iso) return "pred chvíľou";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "pred chvíľou";
  if (s < 3600) return `pred ${Math.floor(s / 60)} min`;
  if (s < 86400) return `pred ${Math.floor(s / 3600)} h`;
  return `pred ${Math.floor(s / 86400)} dňami`;
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

function isOfficialNoticeExpired(post: {
  type: PostType;
  userRole?: string | null;
  createdAt: string;
  expiresAt?: string;
}) {
  if (post.type !== "hlasnik") return false;
  const role = (post.userRole ?? "").toLowerCase();
  if (role !== "starosta" && role !== "uradnik") return false;

  const fallbackExpiryTs =
    new Date(post.createdAt).getTime() + OFFICIAL_NOTICE_MAX_DAYS * 24 * 3600_000;
  const explicitExpiryTs = post.expiresAt ? new Date(post.expiresAt).getTime() : NaN;
  const expiryTs = Number.isFinite(explicitExpiryTs) ? explicitExpiryTs : fallbackExpiryTs;
  return expiryTs <= Date.now();
}

export function NastenkaScreen() {
  const { profile, userId } = useCurrentUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [likesByPost, setLikesByPost] = useState<Record<string, boolean>>({});
  const [likesCountByPost, setLikesCountByPost] = useState<Record<string, number>>({});
  const [reportedByPost, setReportedByPost] = useState<Record<string, boolean>>({});
  const isReadonly = !(profile?.is_active_neighbor ?? false);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalMode>(null);
  const [lightboxPost, setLightboxPost] = useState<Post | null>(null);

  const canCreateOfficialNotice =
    profile?.role === "Starosta" || profile?.role === "Uradnik";

  const loadPosts = useCallback(async () => {
    // Načítame príspevky bez toho, aby sme riskovali vyradenie kvôli chýbajúcemu profilu
    const { data, error } = await supabase
  .from("posts")
  .select("id, user_id, type, category, title, content, image_url, created_at, expires_at, profiles!user_id(name, role)")
  .order("created_at", { ascending: false });

    if (error) {
      console.error("Chyba pri načítaní príspevkov zo Supabase:", error);
      return;
    }

    const mapped: Post[] = ((data as any[] | null) ?? [])
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
      .filter((post, index) => {
        const row = (data as any[])[index];
        return !isOfficialNoticeExpired({
          type: post.type,
          userRole: row?.profiles?.role,
          createdAt: post.createdAt,
          expiresAt: post.expiresAt,
        });
      });

    setPosts(mapped);

    const postIds = mapped.map((post) => post.id);
    if (postIds.length === 0) {
      setLikesByPost({});
      setLikesCountByPost({});
      setReportedByPost({});
      return;
    }

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
      supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", userId)
        .in("post_id", postIds),
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
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    const channel = supabase
      .channel("nastenka-posts-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => {
          void loadPosts();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
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

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return posts;
    return posts.filter((p) =>
      [p.title, p.content, p.category, p.userName]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [posts, q]);

  const oznamy = filtered.filter(
    (p) => p.type === "hlasnik" || p.type === "official_alert",
  );

  const prispevky = filtered.filter((p) => {
    if (p.type !== "susedsky_zivot" && p.type !== "farsky_oznam") return false;
    // Povolíme iba kategórie priradené pre Nástenku
    if (!NEIGHBOR_CATEGORIES.includes(p.category as Category)) return false;
    // OSTRÁNENÝ FILTER expirácie na 4 dni, aby staršie testovacie príspevky nezmizli potichu
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
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Search */}
      <div className="sticky top-0 z-10 bg-white/80 px-5 pt-3 pb-2 backdrop-blur dark:bg-neutral-950/80">
        <div className="flex items-center gap-2 rounded-full border border-neutral-200/70 bg-white/70 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-white/5">
          <Search className="h-4 w-4 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hľadať v príspevkoch…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
          />
        </div>
      </div>

      {profile && (
        <div className="px-5 pt-3">
          <BanBanner profile={profile} />
        </div>
      )}

      {/* Hlásnik */}
      <section className="border-b border-neutral-200/70 pb-3 dark:border-white/10">
        <div className="flex items-center justify-between px-5 pb-2 pt-1">
          <div>
            <h2 className="text-base font-semibold tracking-tight">📢 Obecný hlásnik</h2>
            <p className="text-[11px] text-muted-foreground">Oficiálne oznamy obce</p>
          </div>
          {canCreateOfficialNotice && !isReadonly && (
            <button
              onClick={() => setModal({ kind: "official" })}
              className="flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-600"
            >
              <Plus className="h-3.5 w-3.5" /> Pridať úradný oznam
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <div className="flex gap-3 px-5 pb-2">
            {oznamy.length === 0 && (
              <div className="flex h-32 w-full items-center justify-center text-xs text-neutral-500">
                Zatiaľ žiadne oznamy.
              </div>
            )}
            {oznamy.map((o) => (
              <OfficialCard
                key={o.id}
                post={o}
                onOpen={() => setLightboxPost(o)}
                onReport={() => {
                  void reportPost(o.id);
                }}
                reported={o.isReported || !!reportedByPost[o.id]}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Susedský život */}
      <section className="flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            <h2 className="text-base font-semibold tracking-tight">🏘️ Susedský život</h2>
            <p className="text-[11px] text-muted-foreground">Príspevky od susedov</p>
          </div>
          {!isReadonly && (
            <button
              onClick={() => setModal({ kind: "neighbor" })}
              className="flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
            >
              <Plus className="h-3 w-3" /> Príspevok
            </button>
          )}
        </div>
        <div className="px-5 pb-4">
          <div className="flex flex-col gap-3">
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
                onOpen={() => setLightboxPost(p)}
                onLike={() => {
                  void toggleLike(p.id);
                }}
                onReport={() => {
                  void reportPost(p.id);
                }}
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

      <PostLightbox
        post={lightboxViewPost}
        liked={lightboxPost ? !!likesByPost[lightboxPost.id] : false}
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
    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700">
      {label}
    </span>
  );
}

function OfficialCard({
  post,
  onOpen,
  onReport,
  reported,
}: {
  post: Post;
  onOpen: () => void;
  onReport: () => void;
  reported: boolean;
}) {
  return (
    <article
      onClick={onOpen}
      className="flex h-full w-64 shrink-0 cursor-pointer flex-col rounded-2xl border-2 border-orange-400/80 bg-orange-50/60 p-3 shadow-sm transition hover:shadow-md"
    >
      <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-orange-600">
        <span>{timeAgo(post.createdAt)}</span>
        {reported && <span className="text-rose-600">nahlásené</span>}
      </div>
      <h3 className="text-sm font-semibold text-neutral-900">{post.title}</h3>
      <p className="mt-1 line-clamp-3 flex-1 text-xs leading-snug text-neutral-700">
        {post.content}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-neutral-500">{post.userName}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReport();
          }}
          disabled={reported}
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] text-neutral-500 hover:bg-white/70 disabled:opacity-40"
        >
          <Flag className="h-3 w-3" /> Nahlásiť
        </button>
      </div>
    </article>
  );
}

function NeighborCard({
  post,
  liked,
  likesCount,
  reported,
  onOpen,
  onLike,
  onReport,
}: {
  post: Post;
  liked: boolean;
  likesCount: number;
  reported: boolean;
  onOpen: () => void;
  onLike: () => void;
  onReport: () => void;
}) {
  const showTrhDisclaimer = post.category === "Susedsky_trh";
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  return (
    <article
      onClick={onOpen}
      className="cursor-pointer rounded-2xl border border-neutral-200/80 bg-white/80 p-3 shadow-sm backdrop-blur transition hover:shadow-md dark:border-white/10 dark:bg-white/5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700 dark:bg-white/10 dark:text-neutral-200">
            {post.userName.charAt(0)}
          </div>
          <div>
            <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              {post.userName}
            </div>
            <div className="text-[10px] text-muted-foreground">{timeAgo(post.createdAt)}</div>
          </div>
        </div>
        <CategoryBadge category={post.category} />
      </div>

      {post.title && (
        <p className="mt-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {post.title}
        </p>
      )}
      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
        {post.content}
      </p>
      {post.imageUrl && (
        <img
          src={post.imageUrl}
          alt=""
          className="mt-2 max-h-64 w-full rounded-xl object-cover"
        />
      )}

      {showTrhDisclaimer && (
        <div className="mt-2 flex gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 text-[10px] leading-snug text-amber-900">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{TRH_DISCLAIMER}</span>
        </div>
      )}

      <div className="mt-2 flex items-center gap-3 border-t border-neutral-100 pt-2 text-[11px] dark:border-white/10">
        <button
          onClick={stop(onLike)}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 transition ${
            liked ? "text-rose-600" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10"
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
          <span>{likesCount}</span>
        </button>
        <button
          onClick={stop(onReport)}
          disabled={reported}
          className="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-white/10"
        >
          <Flag className="h-3.5 w-3.5" />
          {reported ? "Nahlásené" : "Nahlásiť"}
        </button>
      </div>
    </article>
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
  const [category, setCategory] = useState<Category>(
    isOfficial ? "Hlasnik" : "Otazka",
  );
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
        imageUrl = await uploadCompressedImage(image, userId);
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
    } catch (err: any) {
      console.error("Užívateľská chyba:", err);
      setErr(err.message);
    } finally {
      setBusy(false);
    }
  }

  const options = isOfficial ? (["Hlasnik"] as Category[]) : NEIGHBOR_CATEGORIES;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100"
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
          <label className="text-sm font-medium text-neutral-700">Kategória</label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {options.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  category === c
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Nadpis</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isOfficial ? "Napr. Odstávka vody" : "Krátky nadpis (voliteľné)"}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700">Obsah</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={5}
            className="mt-1 w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
          />
        </div>

        {canAttachImage && (
          <ImageInput
            value={image}
            onChange={setImage}
            label="Fotka (1 obrázok, voliteľné)"
          />
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
            className="w-full rounded-xl border border-neutral-200 bg-white py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            Zrušiť
          </button>
        </div>
      </form>
    </div>
  );
}