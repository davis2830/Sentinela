import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuthStore } from "../../store/authStore";

export default function ScanFeedback() {
  const identity = useAuthStore((s) => s.user?.id);
  const [feedback, setFeedback] = useState({ identity, message: "" });
  const message = feedback.identity === identity ? feedback.message : "";
  useEffect(() => {
    setFeedback({ identity, message: "" });
    const show = (event: Event) => {
      const value = (event as CustomEvent<unknown>).detail;
      if (typeof value === "string")
        setFeedback({ identity, message: value.slice(0, 1000) });
    };
    window.addEventListener("sentinel:scan-feedback", show);
    return () => window.removeEventListener("sentinel:scan-feedback", show);
  }, [identity]);
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-5 right-5 left-5 sm:left-auto sm:max-w-lg z-[100] rounded-xl border border-amber-400/30 bg-bg-card px-4 py-3 shadow-xl text-sm text-text-main flex items-start gap-3"
    >
      <p className="flex-1">{message}</p>
      <button
        type="button"
        className="min-h-11 min-w-11 grid place-items-center"
        aria-label="Cerrar aviso de comprobación"
        onClick={() => setFeedback({ identity, message: "" })}
      >
        <X size={18} />
      </button>
    </div>
  );
}
