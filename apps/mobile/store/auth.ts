import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const SECURE_STORE_TOKEN_KEY = "majimi_auth_token";
const SECURE_STORE_REFRESH_KEY = "majimi_refresh_token";

export interface AuthUser {
  id: string;
  nickname: string;
  image: string | null;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isLoading: boolean;

  login: (kakaoAccessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  _setToken: (token: string | null) => void;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  isLoading: false,

  login: async (kakaoAccessToken: string) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/kakao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: kakaoAccessToken }),
      });

      if (!res.ok) {
        throw new Error(`Auth error: ${res.status}`);
      }

      const data: { token: string; refresh_token: string; user: AuthUser } =
        await res.json();

      await SecureStore.setItemAsync(SECURE_STORE_TOKEN_KEY, data.token);
      await SecureStore.setItemAsync(
        SECURE_STORE_REFRESH_KEY,
        data.refresh_token
      );
      set({
        token: data.token,
        refreshToken: data.refresh_token,
        user: data.user,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(SECURE_STORE_TOKEN_KEY);
    await SecureStore.deleteItemAsync(SECURE_STORE_REFRESH_KEY);
    set({ token: null, refreshToken: null, user: null });
  },

  refreshAccessToken: async () => {
    const { refreshToken } = get();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) return false;

      const data: { token: string; refresh_token: string } = await res.json();

      await SecureStore.setItemAsync(SECURE_STORE_TOKEN_KEY, data.token);
      await SecureStore.setItemAsync(
        SECURE_STORE_REFRESH_KEY,
        data.refresh_token
      );
      set({ token: data.token, refreshToken: data.refresh_token });
      return true;
    } catch {
      return false;
    }
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const storedToken = await SecureStore.getItemAsync(SECURE_STORE_TOKEN_KEY);
      const storedRefresh = await SecureStore.getItemAsync(
        SECURE_STORE_REFRESH_KEY
      );

      if (storedToken) {
        // Try with existing access token first
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (res.ok) {
          const user: AuthUser = await res.json();
          set({
            token: storedToken,
            refreshToken: storedRefresh,
            user,
            isLoading: false,
          });
          return;
        }

        // Access token expired — try refresh
        if (storedRefresh) {
          set({ refreshToken: storedRefresh });
          const refreshed = await get().refreshAccessToken();
          if (refreshed) {
            const retryRes = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
              headers: { Authorization: `Bearer ${get().token}` },
            });
            if (retryRes.ok) {
              const user: AuthUser = await retryRes.json();
              set({ user, isLoading: false });
              return;
            }
          }
        }

        // Both tokens invalid — clear
        await SecureStore.deleteItemAsync(SECURE_STORE_TOKEN_KEY);
        await SecureStore.deleteItemAsync(SECURE_STORE_REFRESH_KEY);
        set({ token: null, refreshToken: null, user: null, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  _setToken: (token) => set({ token }),
}));
