import axios from 'axios';
import { create } from 'zustand';

export type PlatformSession = {
  token: string;
  expiresAt: number;
  user: { id: string; email: string };
};

export const usePlatformSession = create<{
  session: PlatformSession | null;
  setSession: (session: PlatformSession | null) => void;
}>(set => ({ session: null, setSession: session => set({ session }) }));

const baseURL = import.meta.env.PROD ? '/api/v1'
  : import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const platformApi = axios.create({ baseURL: baseURL.replace(/\/+$/, '') + '/' });

platformApi.interceptors.request.use(config => {
  const { session } = usePlatformSession.getState();
  if (session && session.expiresAt > Date.now()) {
    config.headers.Authorization = `Bearer ${session.token}`;
  }
  return config;
});

platformApi.interceptors.response.use(response => response, error => {
  const { session, setSession } = usePlatformSession.getState();
  if (session && error.response?.status === 401
      && error.config?.headers?.Authorization === `Bearer ${session.token}`) {
    setSession(null);
  }
  return Promise.reject(error);
});
