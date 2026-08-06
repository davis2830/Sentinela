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
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<{ success: boolean; data: AuthResponse }>('/auth/login/', {
            email,
            password,
          });
          const { access_token, refresh_token, user } = response.data.data;
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
        } catch (err: any) {
          const message = err.response?.data?.message || 'Error al iniciar sesion';
          set({ isLoading: false, error: message });
          return false;
        }
      },

      register: async (email, password, firstName, lastName) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<{ success: boolean; data: AuthResponse }>('/auth/register/', {
            email,
            password,
            first_name: firstName,
            last_name: lastName,
          });
          const { access_token, refresh_token, user } = response.data.data;
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
            await api.post('/auth/logout/', { refresh_token: refreshToken });
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