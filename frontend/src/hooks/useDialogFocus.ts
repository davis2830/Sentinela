import { useEffect, useRef } from "react";
export function useDialogFocus(open: boolean, focusKey?: string | number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !ref.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const background = Array.from(document.body.children)
      .filter(
        (node): node is HTMLElement =>
          node instanceof HTMLElement && !node.contains(root),
      )
      .map((node) => ({ node, inert: node.inert }));
    background.forEach(({ node }) => {
      node.inert = true;
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), summary, a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ),
      ).filter((el) => {
        if (!el.getClientRects().length) return false;
        // Closed native disclosures can retain layout boxes for their hidden children.
        return !Array.from(root.querySelectorAll("details:not([open])")).some(
          (details) =>
            details.contains(el) && details.querySelector("summary") !== el,
        );
      });
    (
      root.querySelector<HTMLElement>(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      ) ||
      controls()[0] ||
      root
    ).focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const list = controls();
      const first = list[0],
        last = list[list.length - 1];
      if (!first) {
        event.preventDefault();
        root.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !root.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !root.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    root.addEventListener("keydown", trap);
    return () => {
      root.removeEventListener("keydown", trap);
      background.forEach(({ node, inert }) => {
        node.inert = inert;
      });
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [open, focusKey]);
  return ref;
}
