import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  Megaphone,
  Clock,
  MapPin,
  ChevronLeft,
  Wallet,
  Users,
  CalendarDays,
  ListChecks,
  MessageCircle,
  Plane,
  Sparkles,
  Plus,
  History,
  Timer,
  ArrowUpRight
} from "lucide-react";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
import { AnimatedCounter } from "@/components/dashboard/animated-counter";
import { LiveClock } from "@/components/dashboard/live-clock";

import { useAppBackground } from "@/hooks/use-app-background";
import { paletteToCssVars } from "@/lib/bg-palette";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "لوحة العائلة — السيف" },
      { name: "description", content: "مركز إدارة عائلة آل سيف." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [profile, setProfile] = useState<{ name: string; role: string; initial: string }>({
    name: "تحميل...", role: "عضو", initial: "س",
  });

  const [fundBalance, setFundBalance] = useState<number>(0);
  const [nextMeeting, setNextMeeting] = useState<any>(null);
  const [tripsCount, setTripsCount] = useState(0);
  const [membersCount, setMembersCount] = useState(0);
  const [tasksCount, setTasksCount] = useState(0);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0 });

  const loadData = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    // Load Profile
    const { data: p } = await supabase.from("profiles").select("arabic_name, full_name").eq("id", u.user.id).maybeSingle();
    const name = p?.arabic_name || p?.full_name || "عضو العائلة";
    setProfile({ name, role: "مسؤول النظام", initial: name[0] || "س" });

    // Load Counts
    const [ { count: tc }, { count: mc }, { count: tskc } ] = await Promise.all([
      supabase.from("trips").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "done"),
    ]);
    setTripsCount(tc || 0);
    setMembersCount(mc || 0);
    setTasksCount(tskc || 0);

    // Load Next Meeting
    const { data: meet } = await supabase.from("meetings")
      .select("*")
      .gte("scheduled_at", new Date().toISOString())
      .eq("status", "scheduled")
      .order("scheduled_at")
      .limit(1)
      .maybeSingle();

    setNextMeeting(meet);

    if (meet) {
      const target = new Date(meet.scheduled_at).getTime();
      const now = new Date().getTime();
      const diff = target - now;
      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      });
    }
  }, []);

  const fetchBalance = useCallback(async () => {
    const { data: txs } = await supabase.from("fund_transactions").select("amount, type");
    const bal = txs?.reduce((acc, t) => {
      const amt = Number(t.amount);
      if (isNaN(amt)) return acc;
      return t.type === "contribution" ? acc + amt : acc - amt;
    }, 0) || 0;
    setFundBalance(bal);
  }, []);

  useEffect(() => {
    loadData();
    fetchBalance();
    const channel = supabase.channel("realtime-dashboard").on("postgres_changes", { event: "*", schema: "public" }, () => {
      loadData();
      fetchBalance();
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData, fetchBalance]);

  const arabicGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "صباح الخير";
    if (h < 17) return "مساء النور";
    return "طاب مساؤك";
  };

  const quickActions = [
    { to: "/chat", label: "محادثة", icon: <MessageCircle size={22} />, color: "bg-blue-500" },
    { to: "/trips", label: "رحلات", icon: <Plane size={22} />, color: "bg-indigo-500" },
    { to: "/meetings", label: "اجتماعات", icon: <CalendarDays size={22} />, color: "bg-amber-500" },
    { to: "/tasks", label: "مهام", icon: <ListChecks size={22} />, color: "bg-rose-500" },
    { to: "/majlis", label: "إعلان", icon: <Megaphone size={22} />, color: "bg-emerald-500" },
    { to: "/family-tree", label: "الشجرة", icon: <Users size={22} />, color: "bg-teal-500" },
    { to: "/finance", label: "الصندوق", icon: <Wallet size={22} />, color: "bg-green-600" },
    { to: "/archive", label: "الأرشيف", icon: <History size={22} />, color: "bg-stone-600" },
  ];

  return (
    <AppShell title="لوحة العائلة" user={profile}>
      <div className="max-w-6xl mx-auto space-y-8 pb-20 px-2 md:px-0">

        {/* Welcome Section */}
        <section className="flex flex-col md:flex-row items-center justify-between gap-8 animate-fade-up">
           <div className="text-center md:text-right space-y-3">
             <div className="flex items-center justify-center md:justify-start gap-4">
               <span className="text-2xl font-black text-primary opacity-80">{arabicGreeting()}،</span>
               <div className="px-4 py-1 bg-primary/5 rounded-full border border-primary/10 shadow-sm backdrop-blur-sm">
                 <LiveClock />
               </div>
             </div>
             <h2 className="text-4xl md:text-6xl font-black text-foreground tracking-tight leading-[1.1]">
               {profile.name}
             </h2>
           </div>
           <div className="shrink-0 relative">
             <div className="absolute inset-0 bg-gold-primary/20 blur-[80px] rounded-full" />
             <img src={alsaifMark.url} alt="Logo" className="size-32 md:size-44 object-contain relative z-10" />
           </div>
        </section>

        {/* Quick Actions Carousel */}
        <section className="space-y-4 animate-fade-up" style={{ animationDelay: "100ms" }}>
           <div className="flex items-center justify-between px-2">
             <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] opacity-60">إجراءات سريعة</h3>
             <div className="flex gap-1.5">
                <div className="size-1 rounded-full bg-primary/20" />
                <div className="size-1 rounded-full bg-primary/40 animate-pulse" />
             </div>
           </div>

           <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar snap-x snap-mandatory">
              {quickActions.map((action) => (
                <Link key={action.to} to={action.to} className="flex-none w-[90px] snap-center group">
                  <div className="flex flex-col items-center gap-2">
                    <div className={cn(
                      "size-16 rounded-[24px] flex items-center justify-center text-white shadow-lg transition-all duration-300",
                      "group-hover:scale-110 group-hover:-translate-y-1",
                      action.color
                    )}>
                      {action.icon}
                    </div>
                    <span className="text-[11px] font-black text-foreground/70 group-hover:text-primary transition-colors">{action.label}</span>
                  </div>
                </Link>
              ))}
           </div>
        </section>

        {/* NEW: Unified Bento Stats Hub (The "One Square" Hub) */}
        <section className="animate-fade-up" style={{ animationDelay: "200ms" }}>
           <div className="card-surface p-8 relative overflow-hidden group">
              <div className="absolute top-0 left-0 p-8 opacity-[0.03] grayscale transition-opacity group-hover:opacity-5">
                 <img src={alsaifMark.url} className="size-40 rotate-[-15deg]" />
              </div>

              <div className="grid grid-cols-2 gap-8 md:gap-12 relative z-10">
                 <div className="space-y-1">
                    <div className="flex items-center gap-2 text-emerald-500 mb-2">
                       <Wallet size={16} />
                       <p className="text-[10px] font-black uppercase tracking-widest">رصيد الصندوق</p>
                    </div>
                    <div className="text-3xl font-black text-foreground tabular-nums">
                       <AnimatedCounter value={fundBalance} /> <span className="text-xs opacity-30">ر.س</span>
                    </div>
                 </div>

                 <div className="space-y-1">
                    <div className="flex items-center gap-2 text-primary mb-2">
                       <Users size={16} />
                       <p className="text-[10px] font-black uppercase tracking-widest">أفراد العائلة</p>
                    </div>
                    <div className="text-3xl font-black text-foreground tabular-nums">
                       <AnimatedCounter value={membersCount} /> <span className="text-xs opacity-30">عضو</span>
                    </div>
                 </div>

                 <div className="space-y-1">
                    <div className="flex items-center gap-2 text-amber-600 mb-2">
                       <Plane size={16} />
                       <p className="text-[10px] font-black uppercase tracking-widest">رحلات مجدولة</p>
                    </div>
                    <div className="text-3xl font-black text-foreground tabular-nums">
                       <AnimatedCounter value={tripsCount} /> <span className="text-xs opacity-30">رحلة</span>
                    </div>
                 </div>

                 <div className="space-y-1">
                    <div className="flex items-center gap-2 text-rose-600 mb-2">
                       <ListChecks size={16} />
                       <p className="text-[10px] font-black uppercase tracking-widest">مهام جارية</p>
                    </div>
                    <div className="text-3xl font-black text-foreground tabular-nums">
                       <AnimatedCounter value={tasksCount} /> <span className="text-xs opacity-30">مهمة</span>
                    </div>
                 </div>
              </div>

              <div className="mt-8 pt-6 border-t border-border/40 flex justify-between items-center">
                 <p className="text-[10px] font-bold text-muted-foreground italic">تحديث مباشر من قاعدة بيانات آل سيف</p>
                 <Link to="/finance" className="size-8 rounded-full bg-primary/5 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all">
                    <ArrowUpRight size={16} />
                 </Link>
              </div>
           </div>
        </section>

        {/* Meeting Spotlight */}
        <article className="card-surface overflow-hidden flex flex-col md:flex-row border-none shadow-2xl animate-fade-up" style={{ animationDelay: "300ms" }}>
           <div className="flex-1 p-10 space-y-8">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-gold-primary animate-pulse" />
                  <span className="text-xs font-black text-gold-primary uppercase tracking-[0.2em]">الحدث القادم</span>
                </div>
                <h3 className="text-3xl font-black text-foreground leading-tight">
                  {nextMeeting?.title || "لا توجد اجتماعات معلنة حالياً"}
                </h3>
              </div>

              <div className="flex flex-wrap gap-10">
                 <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-inner">
                       <CalendarDays size={24} />
                    </div>
                    <div>
                       <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">الموعد</p>
                       <p className="text-base font-black text-foreground">
                         {nextMeeting ? new Date(nextMeeting.scheduled_at).toLocaleDateString("ar-SA", { weekday: 'long', day: 'numeric', month: 'long' }) : "—"}
                       </p>
                    </div>
                 </div>
              </div>

              <div className="pt-4">
                 <Link to="/meetings" className="btn-gold px-12 py-4 text-base shadow-2xl shadow-gold-primary/20 inline-block">
                    تأكيد الحضور
                 </Link>
              </div>
           </div>

           <div className="md:w-1/3 bg-primary p-10 flex flex-col items-center justify-center text-center text-primary-foreground relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 scale-150 rotate-12">
                <img src={alsaifMark.url} className="size-full object-contain brightness-0 invert" />
              </div>
              <div className="relative z-10 space-y-6">
                <div className="size-16 rounded-full bg-white/10 flex items-center justify-center mx-auto border border-white/20">
                   <Timer className="size-8 animate-pulse" />
                </div>
                <div>
                  <p className="text-[13px] font-black uppercase tracking-widest opacity-60 mb-2">الوقت المتبقي</p>
                  <div className="text-6xl font-black tabular-nums tracking-tighter">
                     {nextMeeting ? (countdown.days > 0 ? countdown.days : countdown.hours) : "—"}
                  </div>
                  <p className="text-xl font-black uppercase opacity-80">
                     {nextMeeting ? (countdown.days > 0 ? "أيام" : "ساعات") : "لا يوجد"}
                  </p>
                </div>
              </div>
           </div>
        </article>

      </div>

      <Link to="/majlis" className="fixed bottom-10 left-10 size-16 rounded-[24px] bg-primary text-primary-foreground flex items-center justify-center shadow-2xl hover:-translate-y-1 transition-all z-50 border-2 border-white/10">
        <Plus size={30} strokeWidth={3} />
      </Link>
    </AppShell>
  );
}
