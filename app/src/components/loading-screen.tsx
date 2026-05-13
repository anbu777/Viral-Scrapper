"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

const SHOWN_KEY = "vs_loading_shown";

export function LoadingScreen() {
  const [show, setShow] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const alreadyShown = sessionStorage.getItem(SHOWN_KEY);
    if (alreadyShown) return;

    setShow(true);
    sessionStorage.setItem(SHOWN_KEY, "1");

    const fadeTimer = setTimeout(() => setFadeOut(true), 1200);
    const hideTimer = setTimeout(() => setShow(false), 1700);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-background transition-opacity duration-500 ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Logo with pulsing rings */}
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-neon/20 blur-2xl animate-pulse" />
          <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-neon to-emerald-500 flex items-center justify-center shadow-2xl">
            <Zap className="h-10 w-10 text-black fill-black" strokeWidth={2.5} />
          </div>
        </div>

        {/* Brand name */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight gradient-text">Virality System</h1>
          <p className="mt-1 text-xs text-muted-foreground">Social Media Intelligence</p>
        </div>

        {/* Progress bar */}
        <div className="w-48 h-0.5 bg-white/[0.08] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-neon to-emerald-400 animate-[loading-bar_1.2s_ease-out_forwards]" />
        </div>
      </div>
    </div>
  );
}
