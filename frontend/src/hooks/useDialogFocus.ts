import { useEffect, useRef } from 'react';
export function useDialogFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(()=> {
    if (!open || !ref.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const controls = () => Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')).filter(el=>el.getClientRects().length>0);
    controls()[0]?.focus();
    const trap = (event: KeyboardEvent) => { if (event.key !== 'Tab') return;
      const list = controls(); const first = list[0], last = list[list.length-1];
      if (!first) { event.preventDefault(); root.focus(); return; }
      if (event.shiftKey && (document.activeElement===first || !root.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement===last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    root.addEventListener('keydown',trap);
    return ()=>{root.removeEventListener('keydown',trap); if (previous?.isConnected) previous.focus();};
  },[open]);
  return ref;
}
