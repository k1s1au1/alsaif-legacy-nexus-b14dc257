import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckCircle2, Info, AlertCircle, Loader2, Calendar, Zap } from "lucide-react";

export type IslandStatus = "success" | "loading" | "info" | "error" | "event";

interface IslandState {
  message: string;
  status: IslandStatus;
  id: string;
  onClick?: () => void;
}

let islandTimer: ReturnType<typeof setTimeout>;

/**
 * Global trigger for the Dynamic Island
 */
export const showIsland = (
  message: string,
  status: IslandStatus = "info",
  duration = 4000,
  onClick?: () => void,
) => {
  const event = new CustomEvent("island:show", {
    detail: { message, status, id: Math.random().toString(36).substr(2, 9), onClick },
  });
  window.dispatchEvent(event);

  if (islandTimer) clearTimeout(islandTimer);
  if (status !== "loading") {
    islandTimer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent("island:hide"));
    }, duration);
  }
};

export const hideIsland = () => {
  window.dispatchEvent(new CustomEvent("island:hide"));
};

export function DynamicIsland() {
  const [state, setState] = useState<IslandState | null>(null);

  useEffect(() => {
    const handleShow = (e: any) => setState(e.detail);
    const handleHide = () => setState(null);

    window.addEventListener("island:show", handleShow);
    window.addEventListener("island:hide", handleHide);
    return () => {
      window.removeEventListener("island:show", handleShow);
      window.removeEventListener("island:hide", handleHide);
    };
  }, []);

  return (
    <div className="fixed top-4 inset-x-0 z-[200] flex justify-center pointer-events-none">
      <AnimatePresence mode="wait">
        {state && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={state.onClick}
            className={cn(
              "pointer-events-auto h-12 min-w-[120px] max-w-[90vw] bg-black text-white rounded-full flex items-center px-4 gap-3 shadow-2xl border border-white/10 backdrop-blur-xl",
              "ring-1 ring-gold-primary/20",
              state.onClick && "cursor-pointer",
            )}
          >
            <div className="shrink-0">
              {state.status === "loading" && (
                <Loader2 className="size-4 animate-spin text-gold-primary" />
              )}
              {state.status === "success" && <CheckCircle2 className="size-4 text-emerald-400" />}
              {state.status === "error" && <AlertCircle className="size-4 text-rose-400" />}
              {state.status === "info" && <Info className="size-4 text-blue-400" />}
              {state.status === "event" && <Calendar className="size-4 text-amber-400" />}
            </div>

            <motion.span
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-[11px] font-black tracking-tight whitespace-nowrap overflow-hidden text-ellipsis"
            >
              {state.message}
            </motion.span>

            {state.status === "loading" && (
              <div className="ml-auto size-1.5 rounded-full bg-gold-primary animate-pulse" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
