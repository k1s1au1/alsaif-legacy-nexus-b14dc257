import { useEffect, useRef, useSyncExternalStore } from "react";
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

/* -------------------------------------------------------------------------- */
/*  Shared presence store: one fetch + one realtime channel for the whole app */
/* -------------------------------------------------------------------------- */

type PresenceMap = Record<string, string>; // user_id -> last_seen_at ISO

const presenceStore: { map: PresenceMap; tick: number } = { map: {}, tick: 0 };
const presenceListeners = new Set<() => void>();
let presenceInitialized = false;
let presenceChannel: ReturnType<typeof supabase.channel> | null = null;
let presenceTickTimer: number | null = null;

function emitPresence() {
  presenceStore.tick++;
  for (const fn of presenceListeners) fn();
}

async function refreshPresenceAll() {
  const { data } = await supabase.from("user_presence").select("user_id, last_seen_at");
  if (data) {
    const next: PresenceMap = {};
    for (const r of data) next[r.user_id] = r.last_seen_at;
    presenceStore.map = next;
    emitPresence();
  }
}

function ensurePresenceSubscription() {
  if (presenceInitialized || typeof window === "undefined") return;
  presenceInitialized = true;
  refreshPresenceAll();
  presenceChannel = supabase
    .channel("global-user-presence")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_presence" },
      (payload) => {
        const row = (payload.new ?? payload.old) as
          | { user_id?: string; last_seen_at?: string }
          | null;
        if (row?.user_id && row.last_seen_at) {
          presenceStore.map = { ...presenceStore.map, [row.user_id]: row.last_seen_at };
          emitPresence();
        } else {
          refreshPresenceAll();
        }
      },
    )
    .subscribe();
  // Re-emit every 30s so dots transition online -> idle -> offline over time.
  presenceTickTimer = window.setInterval(emitPresence, 30_000);
}

function subscribePresence(cb: () => void) {
  ensurePresenceSubscription();
  presenceListeners.add(cb);
  return () => {
    presenceListeners.delete(cb);
  };
}

function getPresenceSnapshot() {
  return presenceStore.tick;
}

/** Get the presence state for a given user id (auto-refreshing). */
export function usePresenceFor(userId: string | null | undefined): PresenceState {
  useSyncExternalStore(subscribePresence, getPresenceSnapshot, () => 0);
  if (!userId) return "offline";
  return presenceFromLastSeen(presenceStore.map[userId]);
}

