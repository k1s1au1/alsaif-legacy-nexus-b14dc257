import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { initialOf } from "@/lib/chat";
import { PresenceDot, usePresenceFor } from "@/lib/presence";
import { cn } from "@/lib/utils";

// Module-level cache of signed URLs for avatar storage paths.
// key = storage object path, value = { url, expiresAt }
type CacheEntry = { url: string; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<string | null>>();

const SIGN_TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_BEFORE_MS = 5 * 60 * 1000; // refresh 5 min before expiry

const AVATAR_EVENT = "avatar:updated";

/** Invalidate a single avatar path so all <UserAvatar> instances refetch. */
export function invalidateAvatar(path: string | null | undefined) {
  if (!path) return;
  cache.delete(path);
  pending.delete(path);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: { path } }));
  }
}

async function resolveAvatar(path: string): Promise<string | null> {
  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.expiresAt - REFRESH_BEFORE_MS > now) return cached.url;

  const existing = pending.get(path);
  if (existing) return existing;

  const p = (async () => {
    const { data, error } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, SIGN_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      pending.delete(path);
      return null;
    }
    cache.set(path, { url: data.signedUrl, expiresAt: now + SIGN_TTL_SECONDS * 1000 });
    pending.delete(path);
    return data.signedUrl;
  })();

  pending.set(path, p);
  return p;
}

export function UserAvatar({
  path,
  name,
  initial,
  className = "",
  fallbackClassName = "",
  userId,
  presenceDotClassName = "absolute -bottom-0.5 -left-0.5 z-10",
}: {
  path?: string | null;
  name?: string;
  initial?: string;
  className?: string;
  fallbackClassName?: string;
  /** When provided, an online/idle/offline dot is overlaid on the avatar. */
  userId?: string | null;
  presenceDotClassName?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const ini = (initial ?? initialOf(name ?? "")).toUpperCase();
  const presenceState = usePresenceFor(userId);
  const showDot = !!userId;

  useEffect(() => {
    let active = true;
    if (!path) {
      setSrc(null);
      return;
    }
    resolveAvatar(path).then((url) => {
      if (active) setSrc(url);
    });

    const onInvalidate = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string }>).detail;
      if (!detail || detail.path !== path) return;
      resolveAvatar(path).then((url) => {
        if (active) setSrc(url);
      });
    };
    window.addEventListener(AVATAR_EVENT, onInvalidate as EventListener);
    return () => {
      active = false;
      window.removeEventListener(AVATAR_EVENT, onInvalidate as EventListener);
    };
  }, [path]);

  const inner = src ? (
    <img
      src={src}
      alt={name ?? "avatar"}
      className={`object-cover ${className}`}
      loading="lazy"
      onError={() => {
        if (path) {
          cache.delete(path);
          setSrc(null);
        }
      }}
    />
  ) : (
    <span className={cn("text-foreground", fallbackClassName)}>{ini}</span>
  );

  if (!showDot) return inner;

  return (
    <span className="relative inline-flex w-full h-full items-center justify-center">
      {inner}
      <PresenceDot state={presenceState} className={presenceDotClassName} />
    </span>
  );
}
