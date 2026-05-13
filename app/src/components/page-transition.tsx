"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [stage, setStage] = useState<"in" | "out">("in");

  useEffect(() => {
    setStage("out");
    const t = setTimeout(() => {
      setDisplayChildren(children);
      setStage("in");
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Update display children when actual children change in same path
  useEffect(() => {
    if (stage === "in") setDisplayChildren(children);
  }, [children, stage]);

  return (
    <div
      className={`transition-all duration-200 ${
        stage === "in" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      {displayChildren}
    </div>
  );
}
