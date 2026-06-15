import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PresenceState = "online" | "idle" | "offline";

const ONLINE_MS = 2 * 60 * 1000; // < 2 min => online
const IDLE_LOGOUT_MS = 15 * 60 * 1000; // 15 min idle => auto sign-out / offline
const HEARTBEAT_MS = 30 * 1000;

export function presenceFromLastSeen(lastSeenAt: string | null | undefined): PresenceState {
  if (!lastSeenAt) return "offline";
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < ONLINE_MS) return "online";
  if (diff < IDLE_LOGOUT_MS) return "idle";
  return "offline";
}

export function PresenceDot({
  state,
  className = "",
  withRing = true,
}: {
  state: PresenceState;
  className?: string;
  withRing?: boolean;
}) {
  const color =
    state === "online"
      ? "bg-emerald-500"
      : state === "idle"
        ? "bg-amber-500"
        : "bg-red-500";
  const label =
    state === "online" ? "متصل" : state === "idle" ? "خامل" : "غير متصل";
  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-block size-2.5 rounded-full ${color} ${
        withRing ? "ring-2 ring-background" : ""
      } ${className}`}
    />
  );
}

export function presenceLabel(state: PresenceState) {
  return state === "online" ? "متصل" : state === "idle" ? "خامل" : "غير متصل";
}

/**
 * Tracks user activity, sends presence heartbeats every 30s while active,
 * and signs the user out after 15 minutes of inactivity.
 */
export function usePresenceHeartbeat() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lastActivityRef = useRef(Date.now());
  const signedOutRef = useRef(false);

  useEffect(() => {
    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };
    const events: (keyof DocumentEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "visibilitychange",
    ];
    events.forEach((e) => document.addEventListener(e, markActivity, { passive: true }));

    let cancelled = false;

    async function heartbeat() {
      if (cancelled || signedOutRef.current) return;
      const idleFor = Date.now() - lastActivityRef.current;

      if (idleFor >= IDLE_LOGOUT_MS) {
        signedOutRef.current = true;
        try {
          await queryClient.cancelQueries();
          queryClient.clear();
          await supabase.auth.signOut();
          toast.message("تم تسجيل الخروج تلقائياً بسبب عدم النشاط");
          navigate({ to: "/auth", replace: true });
        } catch {
          // ignore
        }
        return;
      }

      // Only beat if visible and recently active (< 2 min)
      if (document.visibilityState === "visible" && idleFor < ONLINE_MS) {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          await supabase
            .from("user_presence")
            .upsert(
              { user_id: u.user.id, last_seen_at: new Date().toISOString(), status: "online" },
              { onConflict: "user_id" },
            );
        }
      }
    }

    heartbeat();
    const interval = window.setInterval(heartbeat, HEARTBEAT_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      events.forEach((e) => document.removeEventListener(e, markActivity));
    };
  }, [navigate, queryClient]);
}
