"use client";

import { useEffect, useRef } from "react";

const TRIGGER_INTERVAL_MS = 60_000; // 1 minute
const LAST_TRIGGER_KEY = "vs_last_scheduler_tick";

/**
 * Background scheduler trigger.
 * Pings /api/scheduler/tick every minute to process due jobs.
 * Uses localStorage to ensure only one tab triggers at a time.
 */
export function SchedulerTrigger() {
  const lastTriggered = useRef<number>(0);

  useEffect(() => {
    const tick = () => {
      try {
        // Check if another tab triggered recently
        const lastStr = localStorage.getItem(LAST_TRIGGER_KEY);
        const last = lastStr ? Number(lastStr) : 0;
        const now = Date.now();
        if (now - last < TRIGGER_INTERVAL_MS - 5000) return;

        localStorage.setItem(LAST_TRIGGER_KEY, String(now));
        lastTriggered.current = now;

        // Fire-and-forget — failures are not critical
        fetch("/api/scheduler/tick", { method: "POST" }).catch(() => {});
      } catch {
        // localStorage may not be available — fire anyway
        fetch("/api/scheduler/tick", { method: "POST" }).catch(() => {});
      }
    };

    // Initial tick (delay 5s to let app initialize)
    const initial = setTimeout(tick, 5000);
    const interval = setInterval(tick, TRIGGER_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  return null;
}
