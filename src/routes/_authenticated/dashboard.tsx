import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  Timer
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

  const [fundBalance, setFundBalance] = useState<number | null>(null);
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
    }, 0) ?? 0;
    setFundBalance(bal);
  }, []);

  useEffect(() => {
    loadData();
    fetchBalance();

    // REAL-TIME SYNC for Balance
    const channel = supabase.channel("dashboard-balance")
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_transactions" }, () => {
        fetchBalance();
      })
      .subscribe();

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
      <div className="max-w-6xl mx-auto space-y-10 pb-20">

        {/* Welcome Section */}
        <section className="flex flex-col md:flex-row items-center justify-between gap-8 animate-fade-up">
           <div className="text-center md:text-right space-y-3">
             <div className="flex items-center justify-center md:justify-start gap-4">
               <span className="text-2xl font-black text-primary opacity-80">{arabicGreeting()}،</span>
               <div className="px-4 py-1 bg-primary/5 rounded-full border border-primary/10 shadow-sm backdrop-blur-sm">
                 <LiveClock />
               </div>
             </div>
             <h2 className="text-5xl md:text-6xl font-black text-foreground tracking-tight leading-[1.1]">
               {profile.name}
             </h2>
             <p className="text-xl text-muted-foreground font-medium max-w-[42ch]">
               أهلاً بك في فضاء عائلة آل سيف الرقمي. تواصل، نظّم، واحفظ الإرث.
             </p>
           </div>
           <div className="shrink-0 relative group">
             <div className="absolute inset-0 bg-gold-primary/20 blur-[100px] rounded-full group-hover:bg-gold-primary/40 transition-all duration-1000" />
             <img src={alsaifMark.url} alt="Logo" className="size-40 md:size-52 object-contain relative z-10 drop-shadow-2xl transition-transform duration-700 group-hover:scale-105" />
           </div>
        </section>

        {/* Quick Actions Carousel */}
        <section className="space-y-4 animate-fade-up" style={{ animationDelay: "100ms" }}>
           <div className="flex items-center justify-between px-2">
             <h3 className="text-sm font-black text-primary uppercase tracking-[0.2em] opacity-60">إجراءات سريعة</h3>
             <div className="flex gap-1.5">
                <div className="size-1.5 rounded-full bg-primary/20" />
                <div className="size-1.5 rounded-full bg-primary/40 animate-pulse" />
             </div>
           </div>

           <div className="flex overflow-x-auto gap-4 pb-6 pt-2 no-scrollbar snap-x snap-mandatory">
              {quickActions.map((action, i) => (
                <Link key={action.to} to={action.to} className="flex-none w-[110px] snap-center group">
                  <div className="flex flex-col items-center gap-3">
                    <div className={cn(
                      "size-20 rounded-[32px] flex items-center justify-center text-white shadow-xl transition-all duration-500",
                      "group-hover:scale-110 group-hover:-translate-y-2 group-active:scale-95",
                      action.color
                    )}>
                      {action.icon}
                    </div>
                    <span className="text-[13px] font-black text-foreground/80 group-hover:text-primary transition-colors">{action.label}</span>
                  </div>
                </Link>
              ))}
           </div>
        </section>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-up" style={{ animationDelay: "200ms" }}>
           <StatCard label="رصيد الصندوق" value={fundBalance?.toLocaleString() || "0"} suffix="ر.س" icon={<Wallet />} color="bg-emerald-600" />
           <StatCard label="أفراد العائلة" value={membersCount} suffix="عضو" icon={<Users />} color="bg-primary" />
           <StatCard label="الرحلات المجدولة" value={tripsCount} suffix="رحلة" icon={<Plane />} color="bg-[#8E7745]" />
           <StatCard label="مهام قيد التنفيذ" value={tasksCount} suffix="مهمة" icon={<ListChecks />} color="bg-rose-700" />
        </div>

        {/* Main Bento */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-up" style={{ animationDelay: "300ms" }}>

           {/* Meeting Spotlight */}
           <article className="lg:col-span-12 card-surface overflow-hidden flex flex-col md:flex-row border-none shadow-2xl">
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
                    <div className="flex items-center gap-4">
                       <div className="size-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-inner">
                          <MapPin size={24} />
                       </div>
                       <div>
                          <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">الموقع</p>
                          <p className="text-base font-black text-foreground truncate max-w-[150px]">{nextMeeting?.location || "يحدد لاحقاً"}</p>
                       </div>
                    </div>
                 </div>

                 <div className="pt-4 flex gap-4">
                    <Link to="/meetings" className="btn-gold px-10 py-4 text-base shadow-2xl shadow-gold-primary/20">
                       تأكيد الحضور
                    </Link>
                    <button className="px-6 py-4 rounded-2xl bg-secondary text-foreground font-black hover:bg-muted transition-all">
                       المزيد
                    </button>
                 </div>
              </div>

              {/* Dynamic Countdown */}
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

           {/* Archive spotlight */}
           <article className="lg:col-span-12 card-surface p-10 bg-primary border-none text-primary-foreground relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform duration-1000 scale-150">
                 <Sparkles size={150} />
              </div>
              <div className="relative z-10 max-w-2xl">
                <h3 className="text-3xl font-black mb-4 tracking-tight">أرشيف العائلة التاريخي</h3>
                <p className="text-lg opacity-80 mb-8 font-medium leading-relaxed">
                  استكشف كنزاً من الصور والوثائق النادرة التي تروي قصة عائلة آل سيف عبر الأجيال.
                </p>
                <Link to="/archive" className="btn-gold px-12 py-4 text-base inline-flex items-center gap-3">
                   دخول الأرشيف <ChevronLeft size={20} />
                </Link>
              </div>
           </article>

        </div>
      </div>

      {/* FAB */}
      <Link to="/majlis" className="fixed bottom-10 left-10 size-20 rounded-[32px] bg-primary text-primary-foreground flex items-center justify-center shadow-[0_25px_60px_-15px_rgba(27,67,50,0.5)] hover:-translate-y-2 hover:rotate-90 transition-all duration-500 active:scale-90 z-50 border-4 border-white/10">
        <Plus size={36} strokeWidth={3} />
      </Link>
    </AppShell>
  );
}

function StatCard({ label, value, suffix, icon, color }: { label: string, value: any, suffix: string, icon: React.ReactNode, color: string }) {
  return (
    <div className="card-surface p-8 flex items-center justify-between group hover:border-primary/40 transition-all duration-500">
       <div className="space-y-2">
          <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">{label}</p>
          <div className="text-4xl font-black text-foreground tracking-tight">
            <AnimatedCounter value={value} /> <span className="text-base font-bold opacity-40 mr-1">{suffix}</span>
          </div>
       </div>
       <div className={cn("size-16 rounded-[24px] flex items-center justify-center text-white shadow-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-6", color)}>
          {icon}
       </div>
    </div>
  );
}
