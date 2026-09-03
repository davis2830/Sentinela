import { useState, useEffect, useCallback } from 'react';

interface UseAutoRefreshOptions {
  intervalSeconds?: number;
  initialEnabled?: boolean;
  onRefresh?: () => void;
}

export function useAutoRefresh({
  intervalSeconds = 15,
  initialEnabled = true,
  onRefresh,
}: UseAutoRefreshOptions = {}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [countdown, setCountdown] = useState(intervalSeconds);

  const resetCountdown = useCallback(() => {
    setCountdown(intervalSeconds);
  }, [intervalSeconds]);

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (onRefresh) {
            onRefresh();
          }
          return intervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [enabled, intervalSeconds, onRefresh]);

  const toggle = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  const refetchInterval: number | false = enabled ? intervalSeconds * 1000 : false;

  return {
    enabled,
    setEnabled,
    toggle,
    countdown,
    resetCountdown,
    refetchInterval,
  };
}
