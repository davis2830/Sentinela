import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';
import type { User, AuthResponse } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  requires2FA: boolean;
  preAuthToken: string | null;
  loginEmail: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; requires2FA?: boolean }>;
  login2FA: (code: string) => Promise<boolean>;
  cancel2FA: () => void;
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    organizationName?: string
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      requires2FA: false,
      preAuthToken: null,
      loginEmail: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<{ success: boolean; data: AuthResponse }>('auth/login/', {
            email,
            password,
          });
          const data = response.data.data;
          if (data.requires_2fa && data.pre_auth_token) {
            set({
              requires2FA: true,
              preAuthToken: data.pre_auth_token,
              loginEmail: email,
              isLoading: false,
              error: null,
            });
            return { success: false, requires2FA: true };
          }

          const { access_token, refresh_token, user } = data;
          if (access_token && refresh_token && user) {
            localStorage.setItem('access_token', access_token);
            localStorage.setItem('refresh_token', refresh_token);
            set({
              user,
              accessToken: access_token,
              refreshToken: refresh_token,
              isAuthenticated: true,
              requires2FA: false,
              preAuthToken: null,
              loginEmail: null,
              isLoading: false,
            });
            return { success: true };
          }
          return { success: false };
        } catch (err: any) {
          const message = err.response?.data?.message || 'Error al iniciar sesión';
          set({ isLoading: false, error: message });
          return { success: false };
        }
      },

      login2FA: async (code: string) => {
        const preAuthToken = get().preAuthToken;
        if (!preAuthToken) {
          set({ error: 'La sesión de 2FA ha expirado. Inicia sesión nuevamente.' });
          return false;
        }
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<{ success: boolean; data: AuthResponse }>('auth/login/2fa/', {
            pre_auth_token: preAuthToken,
            code,
          });
          const data = response.data.data;
          const { access_token, refresh_token, user } = data;
          if (access_token && refresh_token && user) {
            localStorage.setItem('access_token', access_token);
            localStorage.setItem('refresh_token', refresh_token);
            set({
              user,
              accessToken: access_token,
              refreshToken: refresh_token,
              isAuthenticated: true,
              requires2FA: false,
              preAuthToken: null,
              loginEmail: null,
              isLoading: false,
            });
            return true;
          }
          return false;
        } catch (err: any) {
          const message = err.response?.data?.message || 'Código 2FA incorrecto o expirado.';
          set({ isLoading: false, error: message });
          return false;
        }
      },

      cancel2FA: () => {
        set({ requires2FA: false, preAuthToken: null, loginEmail: null, error: null, isLoading: false });
      },

      register: async (email, password, firstName, lastName, organizationName) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<{ success: boolean; data: AuthResponse }>('auth/register/', {
            email,
            password,
            first_name: firstName,
            last_name: lastName,
            organization_name: organizationName,
          });
          const { access_token, refresh_token, user } = response.data.data;
          if (access_token && refresh_token && user) {
            localStorage.setItem('access_token', access_token);
            localStorage.setItem('refresh_token', refresh_token);
            set({
              user,
              accessToken: access_token,
              refreshToken: refresh_token,
              isAuthenticated: true,
              isLoading: false,
            });
            return true;
          }
          return false;
        } catch (err: any) {
          const message = err.response?.data?.message || 'Error al registrar usuario';
          set({ isLoading: false, error: message });
          return false;
        }
      },

      logout: async () => {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          try {
            await api.post('auth/logout/', { refresh_token: refreshToken });
          } catch {
            // Ignore errors on logout
          }
        }
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      updateUser: (updatedUser) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updatedUser } : null,
        })),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);