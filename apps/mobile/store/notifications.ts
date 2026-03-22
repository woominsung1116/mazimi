// ---------------------------------------------------------------------------
// Notification Zustand store
//
// Tracks the Expo push token, OS permission status, and an in-app list of
// pending (unread) notifications received while the app is running.
//
// Call initialize() once after the auth session is restored.
// ---------------------------------------------------------------------------

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  requestPermissions,
  registerForPushNotifications,
  type NotificationPayload,
} from "../lib/notifications";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingNotification {
  id: string;
  title: string;
  body: string;
  data: NotificationPayload;
  receivedAt: string;
  read: boolean;
}

interface NotificationState {
  pushToken: string | null;
  permissionGranted: boolean;
  pendingNotifications: PendingNotification[];

  // Actions
  initialize: () => Promise<void>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addPending: (item: Omit<PendingNotification, "read">) => void;
  clearAll: () => void;
}

// ---------------------------------------------------------------------------
// Persistence key
// ---------------------------------------------------------------------------

const STORAGE_KEY = "wello_pending_notifications";

async function loadPersistedNotifications(): Promise<PendingNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingNotification[];
  } catch {
    return [];
  }
}

async function persistNotifications(
  items: PendingNotification[]
): Promise<void> {
  try {
    // Keep at most 50 items to bound storage growth.
    const trimmed = items.slice(0, 50);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Non-fatal — best effort persistence.
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useNotificationStore = create<NotificationState>((set, get) => ({
  pushToken: null,
  permissionGranted: false,
  pendingNotifications: [],

  initialize: async () => {
    // 1. Restore previously persisted notifications.
    const persisted = await loadPersistedNotifications();
    set({ pendingNotifications: persisted });

    // 2. Request OS permission.
    const granted = await requestPermissions();
    set({ permissionGranted: granted });

    if (!granted) return;

    // 3. Register with backend — user identity comes from the JWT, no userId needed.
    const token = await registerForPushNotifications();
    if (token) {
      set({ pushToken: token });
    }
  },

  addPending: (item) => {
    const notification: PendingNotification = { ...item, read: false };
    const updated = [notification, ...get().pendingNotifications];
    set({ pendingNotifications: updated });
    persistNotifications(updated);
  },

  markAsRead: (id) => {
    const updated = get().pendingNotifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    set({ pendingNotifications: updated });
    persistNotifications(updated);
  },

  markAllAsRead: () => {
    const updated = get().pendingNotifications.map((n) => ({
      ...n,
      read: true,
    }));
    set({ pendingNotifications: updated });
    persistNotifications(updated);
  },

  clearAll: () => {
    set({ pendingNotifications: [] });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));

// ---------------------------------------------------------------------------
// Selector helpers (call inside React components)
// ---------------------------------------------------------------------------

/** Returns the count of unread pending notifications. */
export function selectUnreadCount(state: NotificationState): number {
  return state.pendingNotifications.filter((n) => !n.read).length;
}
