import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  MessageCircle, CalendarDays, Plane, Wallet, ListChecks,
  Sparkles, Megaphone, Archive, TreePine, Star, ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type Shortcut = {
  key: string;
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string; // gradient classes
  badge?: number | null;
  stat?: string | null;
  cta: string;
};

const STORAGE_KEY = "alsaif:favorite-shortcuts";

function loadFavs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function ShortcutsGrid({
  badges,
  stats,
}: {
  badges: Partial<Record<string, number | null>>;
  stats: Partial<Record<string, string | null>>;
}) {
  const [favs, setFavs] = useState<string[]>([]);
  useEffect(() => setFavs(loadFavs()), []);

  const toggleFav = (key: string) => {
    setFavs((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

  const baseShortcuts: Shortcut[] = useMemo(() => [
    { key: "chat", to: "/chat", title: "المحادثات", description: "تواصل مباشر مع العائلة", icon: MessageCircle, accent: "from-sky-500/25 to-transparent", cta: "افتح المحادثات", badge: badges.chat ?? null, stat: stats.chat ?? null },
    { key: "meetings", to: "/meetings", title: "الاجتماعات", description: "جدول الاجتماعات والحضور", icon: CalendarDays, accent: "from-blue-500/25 to-transparent", cta: "عرض الاجتماعات", badge: badges.meetings ?? null, stat: stats.meetings ?? null },
    { key: "trips", to: "/trips", title: "الرحلات", description: "رحلات العائلة القادمة", icon: Plane, accent: "from-cyan-500/25 to-transparent", cta: "تصفح الرحلات", badge: badges.trips ?? null, stat: stats.trips ?? null },
    { key: "finance", to: "/finance", title: "الصندوق المالي", description: "الرصيد والمساهمات", icon: Wallet, accent: "from-gold-primary/30 to-transparent", cta: "إدارة الصندوق", badge: badges.finance ?? null, stat: stats.finance ?? null },
    { key: "tasks", to: "/tasks", title: "المهام", description: "متابعة مهامك النشطة", icon: ListChecks, accent: "from-purple-500/25 to-transparent", cta: "عرض المهام", badge: badges.tasks ?? null, stat: stats.tasks ?? null },
    { key: "events", to: "/events", title: "المناسبات", description: "الأفراح والمناسبات الخاصة", icon: Sparkles, accent: "from-pink-500/20 to-transparent", cta: "تصفح المناسبات", badge: badges.events ?? null, stat: stats.events ?? null },
    { key: "majlis", to: "/majlis", title: "المجلس", description: "الإعلانات والنقاشات الرسمية", icon: Megaphone, accent: "from-amber-500/25 to-transparent", cta: "ادخل المجلس", badge: badges.majlis ?? null, stat: stats.majlis ?? null },
    { key: "archive", to: "/archive", title: "الأرشيف", description: "صور ووثائق العائلة", icon: Archive, accent: "from-slate-500/25 to-transparent", cta: "افتح الأرشيف", badge: badges.archive ?? null, stat: stats.archive ?? null },
    { key: "family-tree", to: "/family-tree", title: "شجرة العائلة", description: "نسب العائلة وفروعها", icon: TreePine, accent: "from-emerald-500/25 to-transparent", cta: "عرض الشجرة", badge: badges["family-tree"] ?? null, stat: stats["family-tree"] ?? null },
  ], [badges, stats]);

  const sorted = useMemo(() => {
    const favSet = new Set(favs);
    return [...baseShortcuts].sort((a, b) => {
      const fa = favSet.has(a.key) ? 1 : 0;
      const fb = favSet.has(b.key) ? 1 : 0;
      return fb - fa;
    });
  }, [baseShortcuts, favs]);

  return (
    <section className="space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-gold-primary" strokeWidth={1.5} />
          <h3 className="eyebrow">الوصول السريع</h3>
        </div>
        <span className="text-[11px] text-muted-foreground hidden sm:block">
          اضغط على ⭐ لتثبيت اختصاراتك المفضلة في الأعلى
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {sorted.map((s, i) => {
          const isFav = favs.includes(s.key);
          const Icon = s.icon;
          const hasBadge = typeof s.badge === "number" && s.badge > 0;
          return (
            <div
              key={s.key}
              className={cn(
                "group relative overflow-hidden rounded-2xl bg-card ring-1 ring-border p-4 sm:p-5",
                "transition-all duration-300 hover:-translate-y-1 hover:ring-gold-primary/40 hover:shadow-gold",
                "animate-fade-up flex flex-col",
              )}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-40 transition-opacity group-hover:opacity-80 pointer-events-none", s.accent)} />
              <div className="absolute -top-10 -left-10 size-24 rounded-full bg-gold-primary/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

              <button
                type="button"
                onClick={(e) => { e.preventDefault(); toggleFav(s.key); }}
                aria-label={isFav ? "إلغاء التثبيت" : "تثبيت كمفضل"}
                className={cn(
                  "absolute top-2 left-2 z-20 size-7 grid place-items-center rounded-full transition-all",
                  isFav
                    ? "bg-gold-primary/20 text-gold-primary ring-1 ring-gold-primary/40"
                    : "bg-card/40 text-muted-foreground hover:text-gold-primary opacity-0 group-hover:opacity-100",
                )}
              >
                <Star className={cn("size-3.5", isFav && "fill-gold-primary")} strokeWidth={1.5} />
              </button>

              <Link to={s.to} className="relative z-10 flex flex-col gap-3 flex-1">
                <div className="flex items-start justify-between">
                  <span className="size-11 grid place-items-center rounded-xl bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20 transition-transform group-hover:scale-110">
                    <Icon className="size-5" strokeWidth={1.5} />
                  </span>
                  {hasBadge && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-gold-primary text-navy-base text-[10px] font-bold grid place-items-center leading-none animate-pulse">
                      {s.badge! > 99 ? "99+" : s.badge}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm sm:text-base font-medium text-ivory group-hover:text-gold-primary transition">
                    {s.title}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {s.description}
                  </p>
                </div>

                {s.stat && (
                  <p className="text-[10px] text-gold-primary/80 truncate">{s.stat}</p>
                )}

                <div className="mt-auto pt-2 flex items-center justify-between text-[11px] text-gold-primary/80 group-hover:text-gold-primary transition">
                  <span>{s.cta}</span>
                  <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-1" strokeWidth={1.5} />
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
