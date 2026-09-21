export type PostType = "susedsky_zivot" | "farsky_oznam" | "hlasnik" | "official_alert";

export type PostPriority =
  "oznam" | "prioritne" | "urgentne" | "vystraha" | "normal" | "high" | "urgent";

export type Post = {
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
  likes?: string[];
  isReported?: boolean;
};
