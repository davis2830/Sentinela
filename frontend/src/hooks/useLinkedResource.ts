import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';

// Deep links open once. Refetches update an open drawer without reopening a dismissed one.
export function useLinkedResource<T extends { id: string }>(items: T[] | undefined, selected: T | null, setSelected: Dispatch<SetStateAction<T | null>>) {
  const [params] = useSearchParams(); const linkedId = params.get('resource'); const opened = useRef<string | null>(null);
  useEffect(() => { if (!linkedId) opened.current = null;
    if (linkedId && opened.current !== linkedId) { const item = items?.find(i=>i.id===linkedId); if (item) { opened.current = linkedId; setSelected(item); return; } }
    if (selected) { const fresh = items?.find(i=>i.id===selected.id); if (fresh && fresh !== selected) setSelected(fresh); }
  }, [items, linkedId, selected, setSelected]);
}
