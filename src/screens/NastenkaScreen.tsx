import { useMemo, useState } from "react";
import { Plus, X, Send, Heart, Flag, Search, AlertTriangle } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { SharedCalendar } from "@/components/SharedCalendar";
import { PostLightbox } from "@/components/PostLightbox";
import type { Post, PostType } from "@/types";


const CATEGORIES = [
  "Pomoc",
  "Predaj",
  "Darovanie",
  "Susedsky_trh",
  "Udalost",
  "Otazka",
  "Vseobecne",
  "Hlasnik",
] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABEL: Record<Category, string> = {
  Pomoc: "🙋 Pomoc",
  Predaj: "🏷️ Predaj",
  Darovanie: "🎁 Darovanie",
  Susedsky_trh: "🛒 Susedský trh",
  Udalost: "📅 Udalosť",
  Otazka: "❓ Otázka",
  Vseobecne: "💬 Všeobecné",
  Hlasnik: "📢 Hlásnik",
};

const NEIGHBOR_CATEGORIES: Category[] = [
  "Pomoc",
  "Predaj",
  "Darovanie",
  "Susedsky_trh",
  "Udalost",
  "Otazka",
  "Vseobecne",
];

const TRH_DISCLAIMER =
  "Prevádzkovateľ aplikácie nezodpovedá za legálnosť, kvalitu ani pôvod produktov. Používatelia sú povinní dodržiavať legislatívu SR (dane, hygiena).";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "pred chvíľou";
  if (s < 3600) return `pred ${Math.floor(s / 60)} min`;
  if (s < 86400) return `pred ${Math.floor(s / 3600)} h`;
  return `pred ${Math.floor(s / 86400)} dňami`;
}

type ModalMode = null | { kind: "official" } | { kind: "neighbor" };

export function NastenkaScreen() {
  const { posts, currentUser, toggleLike, reportPost } = useApp();
  const { profile } = useCurrentUser();
  const isReadonly = !(profile?.is_active_neighbor ?? false);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalMode>(null);
  const [lightboxPost, setLightboxPost] = useState<Post | null>(null);

  const isStarosta = currentUser.role === "Starosta";

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
  const prispevky = filtered.filter(
    (p) => p.type === "susedsky_zivot" || p.type === "farsky_oznam",
  );

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

      {/* Hlásnik */}
      <section className="border-b border-neutral-200/70 pb-3 dark:border-white/10">
        <div className="flex items-center justify-between px-5 pb-2 pt-1">
          <div>
            <h2 className="text-base font-semibold tracking-tight">📢 Obecný hlásnik</h2>
            <p className="text-[11px] text-muted-foreground">Oficiálne oznamy obce</p>
          </div>
          {isStarosta && !isReadonly && (
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
                onReport={() => reportPost(o.id)}
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
                liked={p.likes.includes(currentUser.id)}
                onOpen={() => setLightboxPost(p)}
                onLike={() => toggleLike(p.id)}
                onReport={() => reportPost(p.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Kalendár obce */}
      <section className="px-5 pb-6">
        <SharedCalendar />
      </section>

      {modal && (
        <NewPostModal mode={modal.kind} onClose={() => setModal(null)} />
      )}

      <PostLightbox
        post={lightboxPost}
        liked={lightboxPost ? lightboxPost.likes.includes(currentUser.id) : false}
        onLike={
          lightboxPost
            ? () => {
                toggleLike(lightboxPost.id);
              }
            : undefined
        }
        onReport={
          lightboxPost
            ? () => {
                reportPost(lightboxPost.id);
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
}: {
  post: Post;
  onOpen: () => void;
  onReport: () => void;
}) {
  return (
    <article
      onClick={onOpen}
      className="flex h-full w-64 shrink-0 cursor-pointer flex-col rounded-2xl border-2 border-orange-400/80 bg-orange-50/60 p-3 shadow-sm transition hover:shadow-md"
    >
      <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-orange-600">
        <span>{timeAgo(post.createdAt)}</span>
        {post.isReported && <span className="text-rose-600">nahlásené</span>}
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
          disabled={post.isReported}
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
  onOpen,
  onLike,
  onReport,
}: {
  post: Post;
  liked: boolean;
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
          <span>{post.likes.length}</span>
        </button>
        <button
          onClick={stop(onReport)}
          disabled={post.isReported}
          className="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-white/10"
        >
          <Flag className="h-3.5 w-3.5" />
          {post.isReported ? "Nahlásené" : "Nahlásiť"}
        </button>
      </div>
    </article>
  );
}


function NewPostModal({
  mode,
  onClose,
}: {
  mode: "official" | "neighbor";
  onClose: () => void;
}) {
  const { addPost, currentUser } = useApp();
  const isOfficial = mode === "official";
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Category>(
    isOfficial ? "Hlasnik" : "Vseobecne",
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    const type: PostType = isOfficial ? "hlasnik" : "susedsky_zivot";
    addPost({
      userId: currentUser.id,
      userName: currentUser.name,
      type,
      category,
      title: title.trim() || (isOfficial ? "Oznam" : "Príspevok"),
      content: content.trim(),
    });
    onClose();
  }

  const options = isOfficial ? (["Hlasnik"] as Category[]) : NEIGHBOR_CATEGORIES;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white dark:bg-neutral-950">
      <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label="Zavrieť"
        >
          <X className="h-5 w-5 text-neutral-900 dark:text-neutral-100" />
        </button>
        <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
          {isOfficial ? "📢 Nový úradný oznam" : "🏘️ Nový príspevok"}
        </h2>
      </div>

      <form onSubmit={submit} className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Kategória</label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {options.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  category === c
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-200 dark:hover:bg-white/10"
                }`}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Nadpis</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isOfficial ? "Napr. Odstávka vody" : "Krátky nadpis (voliteľné)"}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Obsah</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={5}
            className="mt-1 w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500"
          />
        </div>

        {category === "Susedsky_trh" && (
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] leading-snug text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{TRH_DISCLAIMER}</span>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <button
            type="submit"
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-md active:scale-[0.99] ${
              isOfficial ? "bg-orange-500" : "bg-neutral-900"
            }`}
          >
            <Send className="h-4 w-4" /> Zverejniť
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-neutral-200 bg-white py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            Zrušiť
          </button>
        </div>
      </form>
    </div>
  );
}
