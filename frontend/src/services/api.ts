import axios from "axios";
import {
  advanceSession,
  sessionGeneration,
  sessionSignal,
  sessionIdentity,
  storedIdentity,
} from "./sessionScope";
declare module "axios" {
  interface InternalAxiosRequestConfig {
    sessionGeneration?: number;
    sessionIdentity?: string;
    _retry?: boolean;
  }
}
const privateRequest = (url: string) =>
  !isAnonymousAuth(url) && !/(?:^|\/)auth\/logout\//.test(url);

const rawBaseUrl =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "/api/v1" : "http://localhost:8000/api/v1");
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");
const isAnonymousAuth = (url: string) =>
  /(?:^|\/)organizations\/invitations\/(?:validate|accept)\//.test(url) ||
  /(?:^|\/)auth\/password\/(?:recovery|reset)\//.test(url) ||
  /(?:^|\/)auth\/(?:login|register|refresh)\//.test(url) ||
  /(?:^|\/)auth\/beta\/(?:config|status|verify|resend|invitation)\//.test(url);

export const api = axios.create({
  baseURL: `${API_BASE_URL}/`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: add JWT token
api.interceptors.request.use(
  (config) => {
    if (privateRequest(config.url || "")) {
      if (sessionIdentity() !== storedIdentity())
        throw new axios.CanceledError("Session changed in another tab");
      config.sessionIdentity = sessionIdentity();
      if (
        config.sessionGeneration !== undefined &&
        config.sessionGeneration !== sessionGeneration()
      )
        throw new axios.CanceledError("Session changed");
      config.sessionGeneration = sessionGeneration();
      config.signal = config.signal
        ? AbortSignal.any([config.signal as AbortSignal, sessionSignal()])
        : sessionSignal();
    }
    const token = localStorage.getItem("access_token");
    if (
      usableToken(token) &&
      (!config.headers.Authorization || privateRequest(config.url || "")) &&
      !isAnonymousAuth(config.url || "")
    ) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Share a rotating refresh token across concurrent failed requests.
let refreshInFlight: { generation: number; promise: Promise<string> } | null =
  null;
let redirectingToLogin = false;
const usableToken = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value !== "undefined" &&
  value !== "null";

function expireSession() {
  advanceSession();
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("auth-storage");
  window.dispatchEvent(new Event("sentinel:session-expired"));
  if (!redirectingToLogin && window.location.pathname !== "/login") {
    redirectingToLogin = true;
    sessionStorage.setItem("sentinel:session-expired", "1");
    window.location.replace("/login");
  }
}

// Response interceptor: auto refresh on 401
api.interceptors.response.use(
  (response) => {
    if (
      response.config.sessionGeneration !== undefined &&
      (response.config.sessionGeneration !== sessionGeneration() ||
        response.config.sessionIdentity !== storedIdentity())
    )
      throw new axios.CanceledError("Session changed");
    if (
      response.data?.data?.queued_count !== undefined &&
      response.data.data.message
    ) {
      window.dispatchEvent(
        new CustomEvent("sentinel:scan-feedback", {
          detail: response.data.data.message,
        }),
      );
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (
      originalRequest?.sessionGeneration !== undefined &&
      (originalRequest.sessionGeneration !== sessionGeneration() ||
        originalRequest.sessionIdentity !== storedIdentity())
    )
      throw new axios.CanceledError("Session changed");
    if (
      error.response?.status === 429 &&
      error.response.data?.message &&
      !String(error.response.data?.errors?.code || "").startsWith("DIAGNOSTIC_")
    ) {
      window.dispatchEvent(
        new CustomEvent("sentinel:scan-feedback", {
          detail: error.response.data.message,
        }),
      );
    }

    const isPublicAuth =
      isAnonymousAuth(originalRequest?.url || "") ||
      /(?:^|\/)auth\/logout\//.test(originalRequest?.url || "");
    if (error.response?.status !== 401 || !originalRequest || isPublicAuth)
      return Promise.reject(error);
    if (originalRequest._retry) {
      expireSession();
      return Promise.reject(error);
    }
    {
      originalRequest._retry = true;
      const currentAccess = localStorage.getItem("access_token");
      // A concurrent request may already have renewed this access token.
      if (
        usableToken(currentAccess) &&
        originalRequest.headers?.Authorization !== `Bearer ${currentAccess}`
      ) {
        originalRequest.headers.Authorization = `Bearer ${currentAccess}`;
        return api(originalRequest);
      }
      const refreshToken = localStorage.getItem("refresh_token");
      if (usableToken(refreshToken)) {
        try {
          const generation = sessionGeneration();
          if (!refreshInFlight || refreshInFlight.generation !== generation) {
            const promise = axios
              .post(
                `${API_BASE_URL}/auth/refresh/`,
                { refresh_token: refreshToken },
                { signal: sessionSignal() },
              )
              .then((response) => {
                const { access_token, refresh_token: rotatedRefresh } =
                  response.data?.data || {};
                if (
                  generation !== sessionGeneration() ||
                  originalRequest.sessionIdentity !== storedIdentity() ||
                  localStorage.getItem("refresh_token") !== refreshToken
                )
                  throw new axios.CanceledError(
                    "Session changed during refresh",
                  );
                if (!usableToken(access_token))
                  throw new Error("Invalid refresh response");
                localStorage.setItem("access_token", access_token);
                localStorage.setItem(
                  "refresh_token",
                  usableToken(rotatedRefresh) ? rotatedRefresh : refreshToken,
                );
                window.dispatchEvent(new Event("sentinel:session-refreshed"));
                return access_token;
              })
              .finally(() => {
                if (refreshInFlight?.generation === generation)
                  refreshInFlight = null;
              });
            refreshInFlight = { generation, promise };
          }
          const access_token = await refreshInFlight.promise;
          if (generation !== sessionGeneration())
            throw new axios.CanceledError("Session changed");
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (refreshError) {
          if (
            originalRequest.sessionGeneration !== sessionGeneration() ||
            originalRequest.sessionIdentity !== storedIdentity()
          )
            throw new axios.CanceledError("Session changed");
          // A temporary network/server failure is not a revoked session.
          if (
            !axios.isAxiosError(refreshError) ||
            [400, 401, 403].includes(refreshError.response?.status || 0)
          )
            expireSession();
          return Promise.reject(refreshError);
        }
      } else expireSession();
    }

    return Promise.reject(error);
  },
);
