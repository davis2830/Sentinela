import { useSearchParams } from 'react-router-dom';

export function useUrlFilter<T extends string>(key: string, allowed: readonly T[], fallback: T = 'all' as T): [T, (value: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(key);
  return [value && allowed.includes(value as T) ? value as T : value ? 'all' as T : fallback, (next: string) => setParams(current => {
    const copy = new URLSearchParams(current); if (next === 'all' && fallback === 'all') copy.delete(key); else copy.set(key, allowed.includes(next as T) ? next : 'all'); return copy;
  }, { replace: true })];
}
