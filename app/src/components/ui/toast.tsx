"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  add: (toast: Omit<Toast, "id">) => void;
  remove: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newToast = { ...toast, id, duration: toast.duration ?? 4000 };
      setToasts((prev) => [...prev, newToast]);
      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => remove(id), newToast.duration);
      }
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ toasts, add, remove }}>
      {children}
      <ToastViewport toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToastContext must be used within ToastProvider");
  return ctx;
}

function ToastViewport({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const icon = {
    success: <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />,
    error: <XCircle className="h-4 w-4 text-red-400 shrink-0" />,
    warning: <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />,
    info: <Info className="h-4 w-4 text-blue-400 shrink-0" />,
  }[toast.type];

  const borderColor = {
    success: "border-emerald-500/30",
    error: "border-red-500/30",
    warning: "border-amber-500/30",
    info: "border-blue-500/30",
  }[toast.type];

  return (
    <div
      className={`pointer-events-auto glass-strong rounded-xl border p-3.5 shadow-2xl flex items-start gap-3 transition-all duration-300 ${borderColor} ${
        visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
      }`}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-xs text-muted-foreground leading-snug">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-muted-foreground/60 hover:text-foreground transition-colors shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
