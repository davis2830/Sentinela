import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';

interface UseAutoRefreshOptions {
  intervalSeconds?: number;
  initialEnabled?: boolean;
  onRefresh?: () => void;
  available?: boolean;
  scopeKey?: string;
}
interface Schedule { nextAt: number; interval: number; requestedEnabled: boolean }

// Tab-local, scoped to user, tenant and workspace. No telemetry or credentials.
function loadSchedule(key: string, interval: number, initialEnabled: boolean): Schedule {
  try {
    const saved: Schedule = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (saved && Number.isFinite(saved.nextAt) && Number.isFinite(saved.interval) && saved.interval > 0 && typeof saved.requestedEnabled === 'boolean') {
      // Plan changes replace the cadence without discarding the cycle's anchor.
      return { ...saved, nextAt: saved.nextAt - saved.interval + interval, interval };
    }
  } catch { /* Storage may be unavailable; the mounted workspace still works. */ }
  return { nextAt: Date.now() + interval, interval, requestedEnabled: initialEnabled };
}
function saveSchedule(key: string, schedule: Schedule) {
  try { sessionStorage.setItem(key, JSON.stringify(schedule)); } catch { /* In-memory fallback. */ }
}
function nextSlot(nextAt: number, interval: number, now: number) {
  return nextAt > now ? nextAt : nextAt + (Math.floor((now - nextAt) / interval) + 1) * interval;
}

export function useAutoRefresh({ intervalSeconds = 30, initialEnabled = true, onRefresh, available = true, scopeKey }: UseAutoRefreshOptions = {}) {
  const { pathname } = useLocation();
  const client = useQueryClient();
  const user = useAuthStore(s => s.user);
  const area = scopeKey ?? pathname;
  const scope = `sentinel:refresh:${user?.id ?? 'anonymous'}:${user?.organization?.id ?? 'none'}:${area}`;
  const interval = Math.max(1, intervalSeconds) * 1000;
  const [initialSchedule] = useState(() => ({ key: scope, ...loadSchedule(scope, interval, initialEnabled) }));
  const schedule = useRef(initialSchedule);
  const queries = useRef(new Set<string>());
  if (schedule.current.key !== scope || schedule.current.interval !== interval) {
    if (schedule.current.key !== scope) queries.current.clear();
    schedule.current = { key: scope, ...loadSchedule(scope, interval, initialEnabled) };
  }
  const [, render] = useState(0);
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;
  const enabled = schedule.current.requestedEnabled && available;
  const now = Date.now();
  const countdown = Math.max(0, Math.ceil((nextSlot(schedule.current.nextAt, interval, now) - now) / 1000));

  const setEnabled = useCallback((value: boolean | ((previous: boolean) => boolean)) => {
    const previous = schedule.current.requestedEnabled;
    schedule.current.requestedEnabled = typeof value === 'function' ? value(previous) : value;
    saveSchedule(scope, schedule.current);
    render(count => count + 1);
  }, [scope]);
  const toggle = useCallback(() => setEnabled(value => !value), [setEnabled]);

  useEffect(() => {
    saveSchedule(scope, schedule.current);
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      const timestamp = Date.now();
      if (schedule.current.nextAt <= timestamp) {
        // Skip missed slots: no catch-up bursts and no new cycle on navigation.
        schedule.current.nextAt = nextSlot(schedule.current.nextAt, interval, timestamp);
        saveSchedule(scope, schedule.current);
        // Only the active queries that opted into this workspace's live clock.
        void client.refetchQueries({ type: 'active', predicate: query => queries.current.has(JSON.stringify(query.queryKey)) });
        refresh.current?.();
      }
      render(value => value + 1);
    };
    // The initial GET handles stale data when returning to a workspace.
    schedule.current.nextAt = nextSlot(schedule.current.nextAt, interval, Date.now());
    saveSchedule(scope, schedule.current);
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [enabled, scope, interval, client]);

  // Opt into the shared clock instead of creating independent React Query timers.
  // Registering keys here performs no request; only the deadline tick reads data.
  const refetchInterval = useCallback((query: { queryKey: readonly unknown[] }): false => {
    queries.current.add(JSON.stringify(query.queryKey));
    return false;
  }, [scope]);

  return { enabled, setEnabled, toggle, countdown, refetchInterval, intervalSeconds };
}

export function formatRefreshCountdown(seconds: number) {
  return seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} min` : `${seconds} s`;
}
