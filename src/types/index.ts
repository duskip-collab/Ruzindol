export type Role = "Sused" | "VIP_Firma" | "Starosta" | "Uradnik" | "Farar";

export interface User {
  id: string;
  name: string;
  email: string;
  street: string;
  role: Role;
  karmaScore: number;
  inviteCodesGenerated: number;
  communityCode?: string;
}

export type PostType =
  | "hlasnik"
  | "susedsky_zivot"
  | "official_alert"
  | "farsky_oznam";

export type PostPriority = "low" | "normal" | "high" | "urgent";

export interface Post {
  id: string;
  userId: string;
  userName: string;
  type: PostType;
  category: string;
  title: string;
  content: string;
  imageUrl?: string;
  createdAt: string; // ISO
  expiresAt?: string; // ISO
  likes: string[]; // userIds
  isReported: boolean;
  priority?: PostPriority;
}

export type WarehouseType =
  | "trh"
  | "darovanie"
  | "sklad_ponuka"
  | "sklad_dopyt";

export interface WarehouseItem {
  id: string;
  userId: string;
  userName: string;
  type: WarehouseType;
  title: string;
  description: string;
  price: number;
  imageUrl?: string;
  createdAt: string;
  expiresAt?: string;
  isReported: boolean;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  text: string;
  createdAt: string;
}

export interface Chat {
  id: string;
  itemId: string;
  buyerId: string;
  sellerId: string;
  messages: Message[];
  isAnonymous: boolean;
}

export type EventCategory = "Samosprava" | "Kostol";

export interface EventItem {
  id: string;
  userId: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt?: string;
  imageUrl?: string;
  createdAt: string;
  type?: EventCategory;
}

export type NotificationType =
  | "new_message"
  | "new_post"
  | "new_alert"
  | "like"
  | "system";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  isRead: boolean;
  createdAt: string;
  refId?: string;
}
