import { useEffect, useState } from "react";

interface ElapsedTimerProps {
  startedAt: number;
  finalDurationS?: number | null;
}

export function ElapsedTimer({ startedAt, finalDurationS }: ElapsedTimerProps) {
  const [elapsedS, setElapsedS] = useState(() =>
    finalDurationS != null ? Math.round(finalDurationS) : Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
  );

  useEffect(() => {
    if (finalDurationS != null) {
      setElapsedS(Math.round(finalDurationS));
      return;
    }

    const update = () => {
      setElapsedS(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    };
    update();

    const firstDelay = 1000 - ((Date.now() - startedAt) % 1000);
    let intervalId = 0;
    const timeoutId = window.setTimeout(() => {
      update();
      intervalId = window.setInterval(update, 1000);
    }, Math.max(50, firstDelay));

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [startedAt, finalDurationS]);

  return <span className="tabular-nums">{elapsedS}s</span>;
}
