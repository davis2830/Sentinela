import { useState, useEffect, useCallback, useRef } from 'react';

interface UseAutoRefreshOptions {
  intervalSeconds?: number;
  initialEnabled?: boolean;
  onRefresh?: () => void;
  available?: boolean;
}

export function useAutoRefresh({
  intervalSeconds = 15,
  initialEnabled = true,
  onRefresh,
  available = true,
}: UseAutoRefreshOptions = {}) {
  const [requestedEnabled, setEnabled] = useState(initialEnabled);
  const enabled = requestedEnabled && available;
  const [countdown, setCountdown] = useState(intervalSeconds);
  const deadline = useRef(Date.now() + intervalSeconds * 1000);
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;

  const resetCountdown = useCallback(() => {
    deadline.current = Date.now() + intervalSeconds * 1000;
    setCountdown(intervalSeconds);
  }, [intervalSeconds]);

  useEffect(() => {
    resetCountdown();
    if (!enabled) return;

    const timer = setInterval(() => {
      const seconds = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      if (seconds === 0) {
        deadline.current = Date.now() + intervalSeconds * 1000;
        refresh.current?.();
        setCountdown(intervalSeconds);
      } else setCountdown(seconds);
    }, 1000);

    return () => clearInterval(timer);
  }, [enabled, intervalSeconds, resetCountdown]);

  const toggle = useCallback(() => setEnabled((prev) => !prev), []);

  const refetchInterval: number | false = enabled ? intervalSeconds * 1000 : false;

  return {
    enabled,
    setEnabled,
    toggle,
    countdown,
    resetCountdown,
    refetchInterval,
    intervalSeconds,
  };
}

export function formatRefreshCountdown(seconds: number) {
  return seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} min` : `${seconds} s`;
}
