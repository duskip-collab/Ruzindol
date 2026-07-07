import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AppNotification,
  Chat,
  EventItem,
  Message,
  Post,
  Role,
  User,
  WarehouseItem,
} from "@/types";

// ---------------- Mock data ----------------

const now = Date.now();
const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Demo/mock listings & messages odstránené — všetky reálne dáta idú cez Supabase.
// Ponechávame len prázdny "currentUser" fallback, aby staré komponenty (RolePanels
// atď.) nespadli, kým sa dorefaktoruje ich data-flow.
const mockUsers: User[] = [
  {
    id: "local",
    name: "Ja",
    email: "",
    street: "",
    role: "Sused",
    karmaScore: 0,
    inviteCodesGenerated: 0,
  },
];

const mockPosts: Post[] = [];
const mockItems: WarehouseItem[] = [];
const mockChats: Chat[] = [];
const mockEvents: EventItem[] = [];
const mockNotifications: AppNotification[] = [];

// ---------------- Context shape ----------------

type ChatId = string;

interface AppContextValue {
  currentUser: User;
  users: User[];
  posts: Post[];
  items: WarehouseItem[];
  chats: Chat[];
  events: EventItem[];
  notifications: AppNotification[];

  changeRole: (role: Role) => void;
  activateCommunityCode: (code: string) => boolean;

  addPost: (p: Omit<Post, "id" | "createdAt" | "likes" | "isReported">) => Post;
  updatePost: (id: string, patch: Partial<Post>) => void;
  deletePost: (id: string) => void;
  toggleLike: (postId: string) => void;
  reportPost: (postId: string) => void;

  addItem: (
    i: Omit<WarehouseItem, "id" | "createdAt" | "isReported">,
  ) => WarehouseItem;
  updateItem: (id: string, patch: Partial<WarehouseItem>) => void;
  deleteItem: (id: string) => void;

  addEvent: (e: Omit<EventItem, "id" | "createdAt">) => EventItem;
  updateEvent: (id: string, patch: Partial<EventItem>) => void;
  deleteEvent: (id: string) => void;

  getOrCreateChat: (itemId: string, buyerId: string, sellerId: string) => Chat;
  sendMessage: (chatId: ChatId, text: string) => Message | null;

  markNotificationRead: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

// Message count under which chat stays anonymous.
const ANONYMITY_THRESHOLD = 2;

export function AppProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [currentUserId, setCurrentUserId] = useState<string>("local");
  const [posts, setPosts] = useState<Post[]>(mockPosts);
  const [items, setItems] = useState<WarehouseItem[]>(mockItems);
  const [chats, setChats] = useState<Chat[]>(mockChats);
  const [events, setEvents] = useState<EventItem[]>(mockEvents);
  const [notifications, setNotifications] =
    useState<AppNotification[]>(mockNotifications);

  const currentUser =
    users.find((u) => u.id === currentUserId) ?? users[0];

  // ---- Role / community ----
  const changeRole = useCallback(
    (role: Role) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === currentUserId ? { ...u, role } : u)),
      );
    },
    [currentUserId],
  );

  const activateCommunityCode = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return false;
      setUsers((prev) =>
        prev.map((u) =>
          u.id === currentUserId ? { ...u, communityCode: trimmed } : u,
        ),
      );
      return true;
    },
    [currentUserId],
  );

  // ---- Posts CRUD ----
  const addPost: AppContextValue["addPost"] = useCallback((p) => {
    const post: Post = {
      ...p,
      id: uid(),
      createdAt: new Date().toISOString(),
      likes: [],
      isReported: false,
    };
    setPosts((prev) => [post, ...prev]);
    return post;
  }, []);

  const updatePost = useCallback((id: string, patch: Partial<Post>) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const deletePost = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const toggleLike = useCallback(
    (postId: string) => {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const has = p.likes.includes(currentUserId);
          return {
            ...p,
            likes: has
              ? p.likes.filter((x) => x !== currentUserId)
              : [...p.likes, currentUserId],
          };
        }),
      );
    },
    [currentUserId],
  );

  const reportPost = useCallback((postId: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, isReported: true } : p)),
    );
  }, []);

  // ---- Items CRUD ----
  const addItem: AppContextValue["addItem"] = useCallback((i) => {
    const item: WarehouseItem = {
      ...i,
      id: uid(),
      createdAt: new Date().toISOString(),
      isReported: false,
    };
    setItems((prev) => [item, ...prev]);
    return item;
  }, []);

  const updateItem = useCallback(
    (id: string, patch: Partial<WarehouseItem>) => {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      );
    },
    [],
  );

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // ---- Events CRUD ----
  const addEvent: AppContextValue["addEvent"] = useCallback((e) => {
    const ev: EventItem = {
      ...e,
      id: uid(),
      createdAt: new Date().toISOString(),
    };
    setEvents((prev) => [ev, ...prev]);
    return ev;
  }, []);

  const updateEvent = useCallback((id: string, patch: Partial<EventItem>) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ---- Chats / Messages ----
  const getOrCreateChat = useCallback(
    (itemId: string, buyerId: string, sellerId: string): Chat => {
      const existing = chats.find(
        (c) =>
          c.itemId === itemId &&
          c.buyerId === buyerId &&
          c.sellerId === sellerId,
      );
      if (existing) return existing;
      const chat: Chat = {
        id: uid(),
        itemId,
        buyerId,
        sellerId,
        messages: [],
        isAnonymous: true,
      };
      setChats((prev) => [...prev, chat]);
      return chat;
    },
    [chats],
  );

  const sendMessage = useCallback(
    (chatId: string, text: string): Message | null => {
      const clean = text.trim();
      if (!clean) return null;
      let created: Message | null = null;
      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== chatId) return c;
          if (c.messages.length >= 4) return c; // hard cap
          const msg: Message = {
            id: uid(),
            chatId,
            senderId: currentUserId,
            senderName: c.isAnonymous ? undefined : currentUser?.name,
            text: clean,
            createdAt: new Date().toISOString(),
          };
          created = msg;
          const nextMessages = [...c.messages, msg];
          // Reveal identity once threshold crossed.
          const isAnonymous = nextMessages.length < ANONYMITY_THRESHOLD;
          return { ...c, messages: nextMessages, isAnonymous };
        }),
      );
      return created;
    },
    [currentUserId, currentUser?.name],
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  }, []);

  // ---- Cleanup expired content ----
  useEffect(() => {
    const sweep = () => {
      const t = Date.now();
      setPosts((prev) =>
        prev.filter((p) => {
          const age = t - new Date(p.createdAt).getTime();
          // Official alerts expire after 2 days.
          if (p.type === "official_alert" && age > 2 * DAY) return false;
          // Regular posts expire after 3 days.
          if (
            (p.type === "susedsky_zivot" ||
              p.type === "hlasnik" ||
              p.type === "farsky_oznam") &&
            age > 3 * DAY
          )
            return false;
          // Explicit expiresAt wins if present.
          if (p.expiresAt && new Date(p.expiresAt).getTime() < t) return false;
          return true;
        }),
      );
    };
    sweep();
    const id = setInterval(sweep, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      currentUser,
      users,
      posts,
      items,
      chats,
      events,
      notifications,
      changeRole,
      activateCommunityCode,
      addPost,
      updatePost,
      deletePost,
      toggleLike,
      reportPost,
      addItem,
      updateItem,
      deleteItem,
      addEvent,
      updateEvent,
      deleteEvent,
      getOrCreateChat,
      sendMessage,
      markNotificationRead,
    }),
    [
      currentUser,
      users,
      posts,
      items,
      chats,
      events,
      notifications,
      changeRole,
      activateCommunityCode,
      addPost,
      updatePost,
      deletePost,
      toggleLike,
      reportPost,
      addItem,
      updateItem,
      deleteItem,
      addEvent,
      updateEvent,
      deleteEvent,
      getOrCreateChat,
      sendMessage,
      markNotificationRead,
    ],
  );

  // expose setter only if needed later
  void setCurrentUserId;

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
