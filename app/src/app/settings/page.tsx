"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeartPulse, RefreshCw } from "lucide-react";

type Health = Record<string, { ok?: boolean; message?: string; [key: string]: unknown }>;

export default function SettingsPage() {
  const [health, setHealth] = useState<Health>({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/providers/health");
      setHealth(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Provider Health</h1>
          <p className="mt-1 text-sm text-muted-foreground">Check local-first providers, paid keys, and runtime tools.</p>
        </div>
        <Button onClick={load} disabled={loading} className="rounded-xl gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(health).map(([name, item]) => (
          <div key={name} className="glass rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartPulse className={item.ok === false ? "h-4 w-4 text-red-400" : "h-4 w-4 text-emerald-400"} />
                <h2 className="font-semibold capitalize">{name}</h2>
              </div>
              <Badge className={item.ok === false ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}>
                {item.ok === false ? "Needs attention" : "Ready"}
              </Badge>
            </div>
            {item.message && <p className="text-sm text-muted-foreground">{item.message}</p>}
            {name === "env" && (
              <pre className="overflow-auto rounded-xl bg-black/30 p-3 text-[11px] text-muted-foreground">
                {JSON.stringify(item, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
