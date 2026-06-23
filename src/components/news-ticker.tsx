import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Plane, CalendarDays, ListChecks, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface NewsItem {
  id: string;
  text: string;
  icon: any;
  color: string;
}

export function NewsTicker() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    (async () => {
      const [{ data: trips }, { data: tasks }, { data: meetings }] = await Promise.all([
        supabase.from("trips").select("id, title").order("created_at", { ascending: false }).limit(2),
        supabase.from("tasks").select("id, title").order("created_at", { ascending: false }).limit(2),
        supabase.from("meetings").select("id, title").order("created_at", { ascending: false }).limit(2),
      ]);

      const news: NewsItem[] = [];

      (trips ?? []).forEach(t => news.push({
        id: `trip-${t.id}`,
        text: `وجهة جديدة: ${t.title}`,
        icon: Plane,
        color: "text-blue-400"
      }));

      (tasks ?? []).forEach(t => news.push({
        id: `task-${t.id}`,
        text: `مبادرة قيد العمل: ${t.title}`,
        icon: ListChecks,
        color: "text-rose-400"
      }));

      (meetings ?? []).forEach(m => news.push({
        id: `meeting-${m.id}`,
        text: `اجتماع مجدول: ${m.title}`,
        icon: CalendarDays,
        color: "text-amber-400"
      }));

      if (news.length === 0) {
        news.push({ id: 'welcome', text: 'أهلاً بك في فضاء عائلة آل سيف الرقمي', icon: Sparkles, color: 'text-gold-primary' });
      }

      setItems(news);
    })();

    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % (items.length || 1));
    }, 5000);

    return () => clearInterval(interval);
  }, [items.length]);

  if (items.length === 0) return null;

  const current = items[index];
  const Icon = current.icon;

  return (
    <div className="w-full bg-primary/5 border-y border-primary/10 overflow-hidden h-10 flex items-center px-4 md:px-8">
       <div className="flex items-center gap-3 shrink-0 border-l border-primary/10 pl-4 ml-4">
          <Megaphone className="size-4 text-gold-primary animate-bounce" />
          <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">آخر الأخبار</span>
       </div>

       <div className="relative flex-1 h-full overflow-hidden flex items-center">
          <AnimatePresence mode="wait">
             <motion.div
               key={current.id}
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ y: -20, opacity: 0 }}
               transition={{ duration: 0.5, ease: "circOut" }}
               className="flex items-center gap-3 w-full"
             >
                <Icon className={cn("size-3.5", current.color)} />
                <p className="text-xs font-bold text-primary/80 truncate">{current.text}</p>
             </motion.div>
          </AnimatePresence>
       </div>
    </div>
  );
}
