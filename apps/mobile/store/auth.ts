import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const SECURE_STORE_TOKEN_KEY = "majimi_auth_token";

export interface AuthUser {
  id: string;
  nickname: string;
  image: string | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;

  login: (kakaoAccessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  _setToken: (token: string | null) => void;
}

const API_BASE_URL = "http://localhost:8080";

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
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

      const data: { token: string; user: AuthUser } = await res.json();

      await SecureStore.setItemAsync(SECURE_STORE_TOKEN_KEY, data.token);
      set({ token: data.token, user: data.user, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(SECURE_STORE_TOKEN_KEY);
    set({ token: null, user: null });
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const stored = await SecureStore.getItemAsync(SECURE_STORE_TOKEN_KEY);
      if (stored) {
        // Verify the token is still valid by fetching the user profile
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${stored}` },
        });

        if (res.ok) {
          const user: AuthUser = await res.json();
          set({ token: stored, user, isLoading: false });
        } else {
          // Token is expired or invalid — clear it silently
          await SecureStore.deleteItemAsync(SECURE_STORE_TOKEN_KEY);
          set({ token: null, user: null, isLoading: false });
        }
      } else {
        set({ isLoading: false });
      }
    } catch {
      // Network error on restore is non-fatal; treat as logged-out
      set({ isLoading: false });
    }
  },

  _setToken: (token) => set({ token }),
}));
