// ---------------------------------------------------------------------------
// Push notification utilities
//
// Usage order on app start:
//   1. requestPermissions()              — ask the OS for permission
//   2. registerForPushNotifications()    — get Expo token, send to backend
//   3. setupNotificationHandlers()       — wire up foreground + tap handlers
//
// Local deadline reminders:
//   scheduleLocalNotification(title, body, data, triggerDate)
// ---------------------------------------------------------------------------

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";  // bundled with expo, no extra install
import { Platform } from "react-native";
import { api } from "./api";
import { useAuthStore } from "../store/auth";

// ---------------------------------------------------------------------------
// Notification channel (Android)
// ---------------------------------------------------------------------------

const ANDROID_CHANNEL_ID = "wello-default";

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "웰로 알림",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#5CB1A7",
    enableVibrate: true,
    showBadge: true,
  });
}

// ---------------------------------------------------------------------------
// Foreground presentation behaviour
// ---------------------------------------------------------------------------

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ---------------------------------------------------------------------------
// Exported: requestPermissions
// ---------------------------------------------------------------------------

/**
 * Requests the OS-level push notification permission.
 * Returns true when permission is granted (or was already granted).
 * Must be called from a user-gesture context on first run.
 */
export async function requestPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    // Simulators / emulators cannot receive push notifications.
    // Return false silently so the rest of the flow is skipped.
    return false;
  }

  await ensureAndroidChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();

  if (existing === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowProvisional: false,
    },
  });

  return status === "granted";
}

// ---------------------------------------------------------------------------
// Exported: registerForPushNotifications
// ---------------------------------------------------------------------------

/**
 * Retrieves the Expo push token and POSTs it to the backend.
 * Returns the token string on success, null on failure.
 *
 * The authenticated user's identity is derived from the JWT on the server —
 * no userId parameter is needed here.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      // projectId is read from app.json / EAS config automatically in SDK 52.
      // Pass it explicitly if you use a custom projectId:
      // projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });

    const token = tokenData.data;
    const platform = Platform.OS; // "ios" | "android"

    // Persist to backend — fire-and-forget; non-fatal if the request fails.
    api.registerPushToken(token, platform).catch((err) => {
      console.warn("[notifications] Failed to register push token:", err);
    });

    return token;
  } catch (err) {
    console.warn("[notifications] getExpoPushTokenAsync failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Exported: setupNotificationHandlers
// ---------------------------------------------------------------------------

/**
 * Attaches global listeners for:
 *  - Notifications received while the app is in the foreground.
 *  - Notification taps (background / killed state).
 *
 * Call this once in the root layout, **after** auth has been restored.
 * Returns a cleanup function — call it inside the useEffect teardown.
 *
 * @param onNotificationTap  Callback invoked with the raw notification
 *                           response when the user taps a notification.
 *                           Typically used to trigger deep-link navigation.
 */
export function setupNotificationHandlers(
  onNotificationTap: (response: Notifications.NotificationResponse) => void
): () => void {
  const receivedSub = Notifications.addNotificationReceivedListener(
    (notification) => {
      // Foreground notification received — update badge / state in the store
      // if needed.  The setNotificationHandler above already shows the banner.
      const { useNotificationStore } = require("../store/notifications");
      const data = notification.request.content.data as
        | NotificationPayload
        | undefined;

      if (data) {
        useNotificationStore.getState().addPending({
          id: notification.request.identifier,
          title: notification.request.content.title ?? "",
          body: notification.request.content.body ?? "",
          data,
          receivedAt: new Date().toISOString(),
        });
      }
    }
  );

  const responseSub = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      onNotificationTap(response);
    }
  );

  // Return cleanup function for useEffect
  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

// ---------------------------------------------------------------------------
// Exported: scheduleLocalNotification
// ---------------------------------------------------------------------------

/** Shape of the `data` payload embedded in every notification. */
export interface NotificationPayload {
  /** "program_deadline" | "new_match" | "custom" */
  type: string;
  /** UUID of the related program, if any. */
  programId?: string;
  /** Any extra key-value pairs forwarded from the backend. */
  [key: string]: unknown;
}

/**
 * Schedules a local notification at a specific date/time.
 * Ideal for deadline reminders set by the user.
 *
 * @param title        Notification title (e.g. "마감 D-3")
 * @param body         Notification body text
 * @param data         Structured payload — at minimum supply `type`
 * @param triggerDate  When the notification should fire (defaults to 1 hour
 *                     from now when omitted)
 * @returns            The notification identifier (use to cancel later)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data: NotificationPayload,
  triggerDate?: Date
): Promise<string> {
  const fireAt = triggerDate ?? new Date(Date.now() + 60 * 60 * 1000);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data as Record<string, unknown>,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });

  return id;
}

/**
 * Cancels a previously scheduled local notification by its identifier.
 */
export async function cancelLocalNotification(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}
