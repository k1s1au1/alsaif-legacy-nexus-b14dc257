import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle, CalendarDays, Plane, Wallet, ListChecks,
  Sparkles, Megaphone, Archive, TreePine, Star, ArrowLeft,
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
    { key: "trips", to: "/trips", title: "الرحلات", description: "رحلات العائلة القادمة", icon: Plane, accent: "from-gold-primary/10 to-transparent", cta: "تصفح الرحلات", badge: badges.trips ?? null, stat: stats.trips ?? null },
    { key: "finance", to: "/finance", title: "الصندوق المالي", description: "الرصيد والمساهمات", icon: Wallet, accent: "from-gold-primary/25 to-transparent", cta: "إدارة الصندوق", badge: badges.finance ?? null, stat: stats.finance ?? null },
    { key: "tasks", to: "/tasks", title: "المهام", description: "متابعة مهامك النشطة", icon: ListChecks, accent: "from-gold-primary/10 to-transparent", cta: "عرض المهام", badge: badges.tasks ?? null, stat: stats.tasks ?? null },
    { key: "events", to: "/events", title: "المناسبات", description: "الأفراح والمناسبات الخاصة", icon: Sparkles, accent: "from-gold-primary/10 to-transparent", cta: "تصفح المناسبات", badge: badges.events ?? null, stat: stats.events ?? null },
    { key: "majlis", to: "/majlis", title: "المجلس", description: "الإعلانات والنقاشات الرسمية", icon: Megaphone, accent: "from-gold-primary/10 to-transparent", cta: "ادخل المجلس", badge: badges.majlis ?? null, stat: stats.majlis ?? null },
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
          const hasBadge = typeof s.badge === "number" && s.badge > 0;
          return (
            <motion.div
              key={s.key}
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.19, 1, 0.22, 1] } },
              }}
              whileHover={{ y: -6, scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className={cn(
                "group relative overflow-hidden rounded-2xl bg-card ring-1 ring-border p-4 sm:p-5",
                "shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_45px_-15px_color-mix(in_oklab,var(--gold-primary)_35%,transparent)]",
                "hover:ring-gold-primary/40 transition-[box-shadow,border-color] duration-300 flex flex-col",
              )}
            >
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30 transition-opacity duration-300 group-hover:opacity-90 pointer-events-none", s.accent)} />
              <motion.div
                aria-hidden
                className="absolute -inset-px rounded-2xl pointer-events-none"
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                style={{
                  background:
                    "radial-gradient(120px circle at 50% 0%, color-mix(in oklab, var(--gold-primary) 22%, transparent), transparent 70%)",
                }}
              />

              <button
                type="button"
                onClick={(e) => { e.preventDefault(); toggleFav(s.key); }}
                aria-label={isFav ? "إلغاء التثبيت" : "تثبيت كمفضل"}
                className={cn(
                  "absolute top-2 left-2 z-20 size-7 grid place-items-center rounded-full transition-all duration-300",
                  isFav
                    ? "bg-gold-primary/15 text-gold-primary ring-1 ring-gold-primary/40"
                    : "bg-background/60 text-muted-foreground hover:text-gold-primary opacity-0 group-hover:opacity-100",
                )}
              >
                <Star className={cn("size-3.5 transition-transform", isFav && "fill-gold-primary")} strokeWidth={1.5} />
              </button>

              <Link to={s.to} className="relative z-10 flex flex-col gap-3 flex-1">
                <div className="flex items-start justify-between">
                  <motion.span
                    className="size-11 grid place-items-center rounded-xl bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20"
                    whileHover={{ rotate: [0, -8, 8, -4, 0], scale: 1.1 }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                  >
                    <Icon className="size-5" strokeWidth={1.5} />
                  </motion.span>
                  {hasBadge && (
                    <motion.span
                      key={s.badge}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 18 }}
                      className="relative min-w-[20px] h-5 px-1.5 rounded-full bg-gold-primary text-primary-foreground text-[10px] font-bold grid place-items-center leading-none"
                    >
                      <motion.span
                        aria-hidden
                        className="absolute inset-0 rounded-full bg-gold-primary"
                        animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                      />
                      <span className="relative">{s.badge! > 99 ? "99+" : s.badge}</span>
                    </motion.span>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm sm:text-base font-medium text-foreground group-hover:text-gold-primary transition-colors duration-300">
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
                  <motion.span
                    className="inline-block"
                    initial={{ x: 0 }}
                    whileHover={{ x: -4 }}
                  >
                    <ArrowLeft className="size-3.5" strokeWidth={1.5} />
                  </motion.span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
