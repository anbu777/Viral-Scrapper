"use client";

import { useToastContext, type Toast } from "@/components/ui/toast";

export function useToast() {
  const { add, remove } = useToastContext();

  return {
    toast: {
      success: (title: string, description?: string) =>
        add({ type: "success", title, description }),
      error: (title: string, description?: string) =>
        add({ type: "error", title, description }),
      warning: (title: string, description?: string) =>
        add({ type: "warning", title, description }),
      info: (title: string, description?: string) =>
        add({ type: "info", title, description }),
      custom: (toast: Omit<Toast, "id">) => add(toast),
    },
    dismiss: remove,
  };
}
