import { useEffect, useRef, useState } from "react";
import type { TextStreamBuffer } from "../../hooks/useAgentChat";
import { MarkdownBlock } from "../common/MarkdownBlock";

const MAX_CPS = 180;

interface StreamingTextProps {
  bufferRef: React.MutableRefObject<TextStreamBuffer>;
  onProgress?: () => void;
  onDrain?: () => void;
}

export function StreamingText({ bufferRef, onProgress, onDrain }: StreamingTextProps) {
  const [shownText, setShownText] = useState("");
  const shownLenRef = useRef(0);
  const drainedRef = useRef(false);
  const onProgressRef = useRef(onProgress);
  const onDrainRef = useRef(onDrain);
  onProgressRef.current = onProgress;
  onDrainRef.current = onDrain;

  useEffect(() => {
    shownLenRef.current = 0;
    drainedRef.current = false;
    setShownText("");

    let rafId = 0;
    let lastTick = performance.now();

    const tick = (now: number) => {
      const buf = bufferRef.current;
      const dt = Math.min(0.05, Math.max(0.008, (now - lastTick) / 1000));
      lastTick = now;

      const remaining = buf.target.length - shownLenRef.current;
      if (remaining > 0) {
        const rate = buf.finished ? Math.max(MAX_CPS, remaining * 6) : MAX_CPS;
        const step = Math.max(1, Math.round(rate * dt));
        const nextLen = Math.min(buf.target.length, shownLenRef.current + step);
        if (nextLen !== shownLenRef.current) {
          shownLenRef.current = nextLen;
          setShownText(buf.target.slice(0, nextLen));
          onProgressRef.current?.();
        }
      }

      if (buf.finished && shownLenRef.current >= buf.target.length) {
        if (!drainedRef.current) {
          drainedRef.current = true;
          onDrainRef.current?.();
        }
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [bufferRef]);

  if (!shownText) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-2.5">
      <MarkdownBlock content={`${shownText} ▌`} variant="message" />
    </div>
  );
}
