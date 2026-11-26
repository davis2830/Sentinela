import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import type {
  ScanFeedbackPayload,
  ScanFeedbackTone,
} from "../../utils/scanPolling";

interface ActiveFeedback {
  identity: string | undefined;
  message: string;
  tone: ScanFeedbackTone;
  actionLabel?: string;
  onAction?: () => void;
  durationMs: number;
  seq: number;
}

const EMPTY_FEEDBACK = (identity: string | undefined): ActiveFeedback => ({
  identity,
  message: "",
  tone: "info",
  durationMs: 4500,
  seq: 0,
});

const TONE_DOT: Record<ScanFeedbackTone, string> = {
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  danger: "bg-rose-400",
  info: "bg-sky-400",
};

const TONE_BORDER: Record<ScanFeedbackTone, string> = {
  success: "border-emerald-500/35",
  warning: "border-amber-400/35",
  danger: "border-rose-500/40",
  info: "border-border-accent/80",
};

/**
 * Compact 1-line scan feedback toast (~360px):
 * - Auto-dismisses after 4.5s (pauses on hover).
 * - Clears immediately on route navigation ("sentinel:screen-left") so it never travels across modules.
 * - Supports concise contextual summaries ("gctorque.com · 83 ms · Propagando") + optional "Ver" button.
 */
export default function ScanFeedback() {
  const identity = useAuthStore((s) => s.user?.id);
  const [feedback, setFeedback] = useState<ActiveFeedback>(() =>
    EMPTY_FEEDBACK(identity),
  );
  const [hovered, setHovered] = useState(false);
  const seqRef = useRef(0);

  const visible = feedback.identity === identity && Boolean(feedback.message);

  useEffect(() => {
    setFeedback(EMPTY_FEEDBACK(identity));

    const handleShow = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      seqRef.current += 1;
      if (typeof detail === "string" && detail.trim()) {
        setFeedback({
          identity,
          message: detail.slice(0, 240),
          tone: "info",
          durationMs: 4500,
          seq: seqRef.current,
        });
      } else if (
        detail &&
        typeof detail === "object" &&
        "message" in detail &&
        typeof (detail as ScanFeedbackPayload).message === "string"
      ) {
        const p = detail as ScanFeedbackPayload;
        setFeedback({
          identity,
          message: p.message.slice(0, 240),
          tone: p.tone || "info",
          actionLabel: p.actionLabel,
          onAction: p.onAction,
          durationMs: p.durationMs ?? 4500,
          seq: seqRef.current,
        });
      }
    };

    const handleLeave = () => {
      setFeedback(EMPTY_FEEDBACK(identity));
    };

    window.addEventListener("sentinel:scan-feedback", handleShow);
    window.addEventListener("sentinel:screen-left", handleLeave);
    return () => {
      window.removeEventListener("sentinel:scan-feedback", handleShow);
      window.removeEventListener("sentinel:screen-left", handleLeave);
    };
  }, [identity]);

  // Auto-dismiss after durationMs (paused while hovered)
  useEffect(() => {
    if (!visible || hovered || feedback.durationMs <= 0) return;
    const timer = window.setTimeout(() => {
      setFeedback(EMPTY_FEEDBACK(identity));
    }, feedback.durationMs);
    return () => window.clearTimeout(timer);
  }, [visible, hovered, feedback.seq, feedback.durationMs, identity]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:w-auto sm:max-w-[380px] z-[100] rounded-xl border ${TONE_BORDER[feedback.tone]} bg-bg-card px-3 py-2 shadow-2xl text-xs text-text-main flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full shrink-0 ${TONE_DOT[feedback.tone]}`}
      />
      <p className="flex-1 min-w-0 truncate" title={feedback.message}>
        {feedback.message}
      </p>
      {feedback.actionLabel && feedback.onAction && (
        <button
          type="button"
          onClick={() => {
            const cb = feedback.onAction;
            setFeedback(EMPTY_FEEDBACK(identity));
            cb?.();
          }}
          className="shrink-0 font-semibold text-accent-green hover:underline cursor-pointer px-1 !min-h-0 !min-w-0"
        >
          {feedback.actionLabel}
        </button>
      )}
      <button
        type="button"
        className="h-6 w-6 grid shrink-0 place-items-center rounded-md text-text-dim hover:text-text-main hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
        aria-label="Cerrar aviso"
        onClick={() => setFeedback(EMPTY_FEEDBACK(identity))}
      >
        <X size={14} />
      </button>
    </div>
  );
}
