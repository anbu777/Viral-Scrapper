"use client";

import { Skeleton } from "@/components/ui/skeleton";

/** Video grid skeleton — shows 8 placeholder cards */
export function VideoGridSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="glass rounded-2xl overflow-hidden">
          <Skeleton className="aspect-[9/16] w-full bg-white/[0.04]" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-24 bg-white/[0.06]" />
            <Skeleton className="h-3 w-32 bg-white/[0.04]" />
            <Skeleton className="h-5 w-16 rounded-md bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Creator grid skeleton — shows 6 placeholder cards */
export function CreatorGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full bg-white/[0.06]" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28 bg-white/[0.06]" />
              <Skeleton className="h-3 w-16 rounded-md bg-white/[0.04]" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-16 rounded-xl bg-white/[0.04]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Config list skeleton — shows 3 placeholder cards */
export function ConfigListSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-xl bg-white/[0.06]" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40 bg-white/[0.06]" />
              <Skeleton className="h-3 w-24 rounded-md bg-white/[0.04]" />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-20 rounded-xl bg-white/[0.04]" />
            <Skeleton className="h-20 rounded-xl bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Generic page loading with centered spinner */
export function PageLoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="relative">
        <div className="h-10 w-10 rounded-full border-2 border-white/[0.08]" />
        <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-transparent border-t-neon animate-spin" />
      </div>
    </div>
  );
}

/** Inline loading bar for TopBar */
export function TopBarLoadingBar({ loading }: { loading: boolean }) {
  if (!loading) return null;
  return (
    <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden">
      <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-neon to-transparent animate-[slide_1.5s_ease-in-out_infinite]" />
    </div>
  );
}
