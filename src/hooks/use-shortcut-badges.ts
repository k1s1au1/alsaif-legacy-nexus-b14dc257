import { useEffect, useState } from "react";

const BADGE_NS = "alsaif:badge:";
const SEEN_NS = "alsaif:seen:";
const EVT = "alsaif:badges-changed";

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVT));
}

export function writeBadge(key: string, value: number | null | undefined) {
  if (typeof window === "undefined") return;
  if (value == null) window.localStorage.removeItem(BADGE_NS + key);
  else window.localStorage.setItem(BADGE_NS + key, String(value));
  emit();
}

export function markSeen(key: string) {
  if (typeof window === "undefined") return;
  const cur = window.localStorage.getItem(BADGE_NS + key) ?? "0";
  window.localStorage.setItem(SEEN_NS + key, cur);
  emit();
}

export function useMarkSeenOnMount(key: string) {
  useEffect(() => {
    markSeen(key);
    // re-mark shortly after, in case dashboard wrote the badge value
    // just after this page mounted (race on first navigation)
    const t = setTimeout(() => markSeen(key), 1500);
    return () => clearTimeout(t);
  }, [key]);
}

export function useSeenMap(keys: string[]): Record<string, number> {
  const joined = keys.join("|");
  const [map, setMap] = useState<Record<string, number>>({});
  useEffect(() => {
    const update = () => {
      if (typeof window === "undefined") return;
      const m: Record<string, number> = {};
      for (const k of keys) {
        m[k] = Number(window.localStorage.getItem(SEEN_NS + k) || 0);
      }
      setMap(m);
    };
    update();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith(SEEN_NS) || e.key.startsWith(BADGE_NS)) update();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVT, update);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVT, update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);
  return map;
}
