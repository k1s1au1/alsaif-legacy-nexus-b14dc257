import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { initialOf } from "@/lib/chat";

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
}: {
  path?: string | null;
  name?: string;
  initial?: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const ini = (initial ?? initialOf(name ?? "")).toUpperCase();

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

  if (src) {
    return (
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
    );
  }

  return <span className={fallbackClassName}>{ini}</span>;
}
