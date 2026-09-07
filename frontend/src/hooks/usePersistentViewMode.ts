import { useState, useEffect } from 'react';

/**
 * Custom hook to persist view mode ('grid' | 'table') in localStorage per module.
 *
 * @param moduleKey - Unique identifier for the module (e.g., 'ssl', 'monitoring', 'dns')
 * @param defaultMode - Default view mode if none is stored ('grid' | 'table', default: 'grid')
 * @returns [viewMode, setViewMode]
 */
export function usePersistentViewMode(
  moduleKey: string,
  defaultMode: 'grid' | 'table' = 'grid'
): ['grid' | 'table', (mode: 'grid' | 'table') => void] {
  const storageKey = `sentinel_view_mode_${moduleKey}`;

  const [viewMode, setViewModeState] = useState<'grid' | 'table'>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === 'grid' || saved === 'table') {
        return saved;
      }
    } catch {
      // Ignore localStorage access errors (e.g., private mode)
    }
    return defaultMode;
  });

  const setViewMode = (mode: 'grid' | 'table') => {
    setViewModeState(mode);
    try {
      localStorage.setItem(storageKey, mode);
    } catch {
      // Ignore localStorage write errors
    }
  };

  return [viewMode, setViewMode];
}

export default usePersistentViewMode;
