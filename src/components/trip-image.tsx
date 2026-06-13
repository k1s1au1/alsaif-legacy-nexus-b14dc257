import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import tripImage from "@/assets/trip-alula.jpg";

// Cache signed URLs per path for the session.
const cache = new Map<string, { url: string; exp: number }>();

export async function getTripImageUrl(path: string | null): Promise<string> {
  if (!path) return tripImage;
  if (/^https?:\/\//i.test(path)) return path;
  const cached = cache.get(path);
  if (cached && cached.exp > Date.now()) return cached.url;
  const { data } = await supabase.storage.from("trip-images").createSignedUrl(path, 60 * 60);
  if (!data?.signedUrl) return tripImage;
  cache.set(path, { url: data.signedUrl, exp: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}

export function TripImage({
  path,
  alt,
  className,
}: {
  path: string | null;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string>(tripImage);
  useEffect(() => {
    let active = true;
    getTripImageUrl(path).then((u) => {
      if (active) setSrc(u);
    });
    return () => {
      active = false;
    };
  }, [path]);
  return <img src={src} alt={alt} loading="lazy" className={className} />;
}
