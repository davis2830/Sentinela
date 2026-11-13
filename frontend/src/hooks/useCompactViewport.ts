import { useEffect, useState } from "react";
export function useCompactViewport() {
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 767px)").matches,
  );
  useEffect(() => {
    const q = window.matchMedia("(max-width: 767px)");
    const update = () => setCompact(q.matches);
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  return compact;
}
