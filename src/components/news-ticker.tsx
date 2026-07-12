import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Plane, CalendarDays, ListChecks, Sparkles, History } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface NewsItem {
  id: string;
  text: string;
  icon: any;
  color: string;
  bg: string;
}

export function NewsTicker() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    (async () => {
      const [{ data: trips }, { data: tasks }, { data: meetings }, { data: heritage }] =
        await Promise.all([
          supabase
            .from("trips")
            .select("id, title")
            .order("created_at", { ascending: false })
            .limit(2),
          supabase
            .from("tasks")
            .select("id, title")
            .order("created_at", { ascending: false })
            .limit(2),
          supabase
            .from("meetings")
            .select("id, title")
            .order("created_at", { ascending: false })
            .limit(2),
          supabase
            .from("majlis_posts")
            .select("id, title")
            .eq("kind", "discussion")
            .ilike("title", "[إرث]%")
            .order("created_at", { ascending: false })
            .limit(2),
        ]);

      const news: NewsItem[] = [];

      (trips ?? []).forEach((t) =>
        news.push({
          id: `trip-${t.id}`,
          text: `وجهة جديدة: ${t.title}`,
          icon: Plane,
          color: "text-blue-500",
          bg: "bg-blue-500/5",
        }),
      );

      (tasks ?? []).forEach((t) =>
        news.push({
          id: `task-${t.id}`,
          text: `مبادرة قيد العمل: ${t.title}`,
          icon: ListChecks,
          color: "text-rose-500",
          bg: "bg-rose-500/5",
        }),
      );

      (meetings ?? []).forEach((m) =>
        news.push({
          id: `meeting-${m.id}`,
          text: `اجتماع مجدول: ${m.title}`,
          icon: CalendarDays,
          color: "text-amber-500",
          bg: "bg-amber-500/5",
        }),
      );

      (heritage ?? []).forEach((h) =>
        news.push({
          id: `heritage-${h.id}`,
          text: `إضافة في الإرث: ${h.title.replace("[إرث]", "").trim()}`,
          icon: History,
          color: "text-indigo-500",
          bg: "bg-indigo-500/5",
        }),
      );

      if (news.length === 0) {
        news.push({
          id: "welcome",
          text: "مجلس عائلة السيف الرقمي",
          icon: Sparkles,
          color: "text-gold-primary",
          bg: "bg-gold-primary/5",
        });
      }

      setItems(news);
    })();

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % (items.length || 1));
    }, 6000);

    return () => clearInterval(interval);
  }, [items.length]);

  if (items.length === 0) return null;

  const current = items[index];
  const Icon = current.icon;

  return (
    <div className="w-full overflow-hidden h-10 sm:h-12 flex items-center px-2 sm:px-4 md:px-12 relative z-40 bg-white/40 dark:bg-card/30 backdrop-blur-xl border-b border-white/30 dark:border-white/5 shadow-[0_4px_24px_-12px_rgba(0,0,0,0.1)]">
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 sm:border-l sm:border-border/40 sm:pl-4 sm:ml-4">
        <div className="size-6 sm:size-8 rounded-lg sm:rounded-xl bg-gold-primary/15 backdrop-blur-md flex items-center justify-center border border-gold-primary/20">
          <Megaphone className="size-3 sm:size-4 text-gold-primary" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/50 hidden md:block">
          نبض السيف
        </span>
      </div>

      <div className="relative flex-1 h-full overflow-hidden flex items-center min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl w-full backdrop-blur-md border border-white/30 dark:border-white/5",
              current.bg,
            )}
          >
            <div
              className={cn(
                "size-5 sm:size-6 rounded-md sm:rounded-lg flex items-center justify-center shrink-0 shadow-sm bg-white/70 dark:bg-card/70 backdrop-blur-sm",
                current.color,
              )}
            >
              <Icon size={12} className="sm:size-3.5" />
            </div>
            <p
              className="text-[11px] sm:text-sm font-black text-primary/80 truncate leading-none pt-0.5"
              style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}
            >
              {current.text}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="hidden sm:flex items-center gap-1.5 mr-4 pr-4 border-r border-border/40">
        {items.map((_, i) => (
          <div
            key={i}
            className={cn(
              "size-1 rounded-full transition-all duration-500",
              i === index ? "w-4 bg-gold-primary" : "bg-border/60",
            )}
          />
        ))}
      </div>
    </div>
  );
}
