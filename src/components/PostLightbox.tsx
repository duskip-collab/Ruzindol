import { X, Heart, Flag, MessageCircle, Loader2, Pencil, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Post } from "@/types";

type PostReply = {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
};

function timeAgo(iso: string) {
  if (!iso) return "pred chvíľou";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "pred chvíľou";
  if (s < 3600) return `pred ${Math.floor(s / 60)} min`;
  if (s < 86400) return `pred ${Math.floor(s / 3600)} h`;
  return `pred ${Math.floor(s / 86400)} dňami`;
}

export function PostLightbox({
  post,
  liked,
  onLike,
  onReport,
  canManage,
  onEdit,
  onDelete,
  replies,
  canReply,
  replyDraft,
  onReplyDraftChange,
  onReplySubmit,
  replyBusy,
  onClose,
}: {
  post: Post | null;
  liked?: boolean;
  onLike?: () => void;
  onReport?: () => void;
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  replies?: PostReply[];
  canReply?: boolean;
  replyDraft?: string;
  onReplyDraftChange?: (value: string) => void;
  onReplySubmit?: () => void;
  replyBusy?: boolean;
  onClose: () => void;
}) {
  const list = replies ?? [];

  return (
    <AnimatePresence>
      {post && (
        <motion.div
          key="lb-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.article
            key="lb-card"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 24, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[85%] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-neutral-900 md:max-w-xl lg:max-w-2xl"
          >
            <button
              onClick={onClose}
              aria-label="Zavrieť"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="overflow-y-auto p-6">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-700 dark:bg-white/10 dark:text-neutral-200">
                  {post.userName?.charAt(0) ?? "?"}
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {post.userName}
                  </p>
                  <p className="text-[11px] text-neutral-500">{post.category}</p>
                </div>
              </div>

              {post.title && (
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  {post.title}
                </h2>
              )}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                {post.content}
              </p>

              {post.imageUrl && (
                <img
                  src={post.imageUrl}
                  alt=""
                  className="mt-4 w-full rounded-2xl object-cover"
                />
              )}

              {(list.length > 0 || canReply) && (
                <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Odpovede
                  </p>

                  {list.length === 0 && !canReply && (
                    <p className="mt-2 text-xs text-neutral-500">Zatiaľ bez odpovedí.</p>
                  )}

                  {list.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {list.map((reply) => (
                        <div key={reply.id} className="rounded-xl bg-neutral-100/80 px-3 py-2 text-xs dark:bg-white/10">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-neutral-800 dark:text-neutral-100">{reply.userName}</span>
                            <span className="text-[10px] text-neutral-500">{timeAgo(reply.createdAt)}</span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {canReply && onReplyDraftChange && onReplySubmit && (
                    <div className="mt-2 flex items-end gap-2">
                      <textarea
                        value={replyDraft ?? ""}
                        onChange={(e) => onReplyDraftChange(e.target.value)}
                        rows={2}
                        maxLength={400}
                        placeholder="Napíš odpoveď..."
                        className="min-h-[56px] flex-1 resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs outline-none focus:border-neutral-400 dark:border-white/10 dark:bg-white/5"
                      />
                      <button
                        type="button"
                        onClick={onReplySubmit}
                        disabled={!!replyBusy || (replyDraft ?? "").trim().length === 0}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white transition hover:bg-neutral-800 disabled:opacity-50"
                        aria-label="Pridať odpoveď"
                      >
                        {replyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {(onLike || onReport || canManage) && (
              <div className="flex items-center gap-2 border-t border-neutral-200 bg-neutral-50/70 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                {onLike && (
                  <button
                    onClick={onLike}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                      liked
                        ? "bg-rose-100 text-rose-700"
                        : "bg-white text-neutral-600 hover:bg-neutral-100 dark:bg-white/10 dark:text-neutral-200"
                    }`}
                  >
                    <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
                    {post.likes?.length ?? 0}
                  </button>
                )}
                {canManage && onEdit && (
                  <button
                    onClick={onEdit}
                    className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:bg-white/10 dark:text-neutral-200"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Upraviť
                  </button>
                )}
                {canManage && onDelete && (
                  <button
                    onClick={onDelete}
                    className="flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Zmazať
                  </button>
                )}
                {onReport && (
                  <button
                    onClick={onReport}
                    disabled={post.isReported}
                    className="ml-auto flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 dark:bg-white/10 dark:text-neutral-200"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    {post.isReported ? "Nahlásené" : "Nahlásiť"}
                  </button>
                )}
              </div>
            )}
          </motion.article>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
