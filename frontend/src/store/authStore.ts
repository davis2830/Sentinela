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
  login: (email: string, password: string) => Promise<{ success: boolean; requires2FA?: boolean; requiresEmailVerification?: boolean }>;
  login2FA: (code: string) => Promise<boolean>;
  cancel2FA: () => void;
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    organizationName?: string,
    invitationToken?: string,
    turnstileToken?: string
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
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
          const response = await api.post<{ success: boolean; data: AuthResponse & { requires_email_verification?: boolean; registration_session?: string } }>('auth/login/', {
            email,
            password,
          });
          const data = response.data.data;
          if (data.requires_email_verification && data.registration_session) {
            sessionStorage.setItem('sentinel:registration-session', data.registration_session);
            set({ isLoading: false, error: null });
            return { success: false, requiresEmailVerification: true };
          }
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

      register: async (email, password, firstName, lastName, organizationName, invitationToken, turnstileToken) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('auth/register/', {
            email, password, first_name: firstName, last_name: lastName,
            organization_name: organizationName, invitation_token: invitationToken,
            turnstile_token: turnstileToken,
          });
          const session = response.data?.data?.registration_session;
          if (!session) throw new Error('No se pudo iniciar la verificación.');
          sessionStorage.setItem('sentinel:registration-session', session);
          set({ isLoading: false });
          return true;
        } catch (err: any) {
          const message = err.response?.data?.message || 'No se pudo iniciar la verificación.';
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

      fetchCurrentUser: async () => {
        if (!get().isAuthenticated && !localStorage.getItem('access_token')) return;
        try {
          const res = await api.get('auth/me/');
          const userData = res.data?.data;
          if (userData) {
            set((state) => ({
              user: state.user ? { ...state.user, ...userData } : userData,
              isAuthenticated: true,
            }));
          }
        } catch {
          // Silent fallback if session expired
        }
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

// Keep the persisted UI session consistent with the HTTP client's token lifecycle.
window.addEventListener('sentinel:session-expired', () => {
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, requires2FA: false, preAuthToken: null });
});
window.addEventListener('sentinel:session-refreshed', () => {
  useAuthStore.setState({ accessToken: localStorage.getItem('access_token'), refreshToken: localStorage.getItem('refresh_token') });
});
