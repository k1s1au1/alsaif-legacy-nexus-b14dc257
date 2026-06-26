import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle, CalendarDays, Plane, Wallet, ListChecks,
  Sparkles, Newspaper, Archive, TreePine, Star, ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSeenMap, writeBadge } from "@/hooks/use-shortcut-badges";

export type Shortcut = {
  key: string;
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
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

  const badgeKeys = useMemo(() => Object.keys(badges), [badges]);
  const seenMap = useSeenMap(badgeKeys);
  useEffect(() => {
    for (const k of badgeKeys) writeBadge(k, badges[k] ?? null);
  }, [badges, badgeKeys]);

  const toggleFav = (key: string) => {
    setFavs((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

  const baseShortcuts: Shortcut[] = useMemo(() => [
    { key: "chat", to: "/chat", title: "المحادثات", description: "تواصل مباشر مع العائلة", icon: MessageCircle, accent: "from-gold-primary/10 to-transparent", cta: "افتح المحادثات", badge: badges.chat ?? null, stat: stats.chat ?? null },
    { key: "meetings", to: "/meetings", title: "الاجتماعات", description: "جدول الاجتماعات والحضور", icon: CalendarDays, accent: "from-gold-primary/10 to-transparent", cta: "عرض الاجتماعات", badge: badges.meetings ?? null, stat: stats.meetings ?? null },
    { key: "trips", to: "/trips", title: "الترفيه", description: "ترفيه ووجهات عائلية", icon: Ticket, accent: "from-gold-primary/10 to-transparent", cta: "استكشاف الترفيه", badge: badges.trips ?? null, stat: stats.trips ?? null },
    { key: "finance", to: "/finance", title: "الصندوق المالي", description: "الرصيد والمساهمات", icon: Wallet, accent: "from-gold-primary/25 to-transparent", cta: "إدارة الصندوق", badge: badges.finance ?? null, stat: stats.finance ?? null },
    { key: "tasks", to: "/tasks", title: "المهام", description: "متابعة مهامك النشطة", icon: ListChecks, accent: "from-gold-primary/10 to-transparent", cta: "عرض المهام", badge: badges.tasks ?? null, stat: stats.tasks ?? null },
    { key: "events", to: "/events", title: "المناسبات", description: "الأفراح والمناسبات الخاصة", icon: Sparkles, accent: "from-gold-primary/10 to-transparent", cta: "تصفح المناسبات", badge: badges.events ?? null, stat: stats.events ?? null },
    { key: "majlis", to: "/majlis", title: "المجلس", description: "الإعلانات والنقاشات الرسمية", icon: Newspaper, accent: "from-gold-primary/10 to-transparent", cta: "ادخل المجلس", badge: badges.majlis ?? null, stat: stats.majlis ?? null },
    { key: "archive", to: "/archive", title: "الأرشيف", description: "صور ووثائق العائلة", icon: Archive, accent: "from-gold-primary/10 to-transparent", cta: "افتح الأرشيف", badge: badges.archive ?? null, stat: stats.archive ?? null },
    { key: "family-tree", to: "/family-tree", title: "شجرة العائلة", description: "نسب العائلة وفروعها", icon: TreePine, accent: "from-gold-primary/10 to-transparent", cta: "عرض الشجرة", badge: badges["family-tree"] ?? null, stat: stats["family-tree"] ?? null },
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

      <motion.div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.05 } },
        }}
      >
        {sorted.map((s) => {
          const isFav = favs.includes(s.key);
          const Icon = s.icon;
          const rawBadge = typeof s.badge === "number" ? s.badge : 0;
          const seen = seenMap[s.key] ?? 0;
          const displayBadge = Math.max(0, rawBadge - seen);
          const hasBadge = displayBadge > 0;
          return (
            <motion.div
              key={s.key}
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.19, 1, 0.22, 1] } },
              }}
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "group relative overflow-hidden rounded-[28px] bg-card p-5 sm:p-6",
                "border border-border hover:border-gold-primary/30 transition-all duration-300",
                "shadow-sm hover:shadow-xl hover:shadow-gold-primary/5",
                "flex flex-col gap-4",
              )}
            >
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-5 transition-opacity duration-500 group-hover:opacity-10 pointer-events-none", s.accent)} />

              <button
                type="button"
                onClick={(e) => { e.preventDefault(); toggleFav(s.key); }}
                aria-label={isFav ? "إلغاء التثبيت" : "تثبيت كمفضل"}
                className={cn(
                  "absolute top-4 left-4 z-20 size-8 grid place-items-center rounded-full transition-all duration-300",
                  isFav
                    ? "bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20"
                    : "bg-muted/30 text-muted-foreground hover:text-gold-primary opacity-0 group-hover:opacity-100",
                )}
              >
                <Star className={cn("size-4 transition-transform", isFav && "fill-gold-primary")} strokeWidth={2} />
              </button>

              <Link to={s.to} className="relative z-10 flex flex-col gap-4 flex-1">
                <div className="flex items-start justify-between">
                  <motion.span
                    className="size-14 grid place-items-center rounded-2xl bg-primary/5 text-primary ring-1 ring-primary/10 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    <Icon className="size-6" strokeWidth={1.5} />
                  </motion.span>
                  {hasBadge && (
                    <motion.span
                      key={displayBadge}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="size-6 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center shadow-lg shadow-primary/20"
                    >
                      {displayBadge > 99 ? "99+" : displayBadge}
                    </motion.span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-[17px] font-bold text-foreground group-hover:text-primary transition-colors duration-300">
                    {s.title}
                  </h4>
                  <p className="text-[12px] text-muted-foreground leading-relaxed font-medium">
                    {s.description}
                  </p>
                </div>

                {s.stat && (
                  <p className="text-[11px] font-bold text-primary/80 bg-primary/5 px-2 py-1 rounded-md self-start">
                    {s.stat}
                  </p>
                )}

                <div className="mt-auto pt-2 flex items-center justify-between text-[12px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span>{s.cta}</span>
                  <ArrowLeft className="size-4" strokeWidth={2.5} />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
