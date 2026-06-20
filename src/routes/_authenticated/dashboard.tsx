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
  TrendingUp,
  MessageCircle,
  Plane,
  Sparkles,
  Plus,
  ArrowUpRight,
  Search,
  LayoutGrid
} from "lucide-react";
import tripImage from "@/assets/trip-alula.jpg";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
import { AnimatedCounter } from "@/components/dashboard/animated-counter";
import { FinanceChart } from "@/components/dashboard/finance-chart";
import { LiveClock } from "@/components/dashboard/live-clock";
import { ShortcutsGrid } from "@/components/dashboard/shortcuts-grid";

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

  const loadData = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    // Load Profile
    const { data: p } = await supabase.from("profiles").select("arabic_name, full_name").eq("id", u.user.id).maybeSingle();
    const name = p?.arabic_name || p?.full_name || "عضو العائلة";
    setProfile({ name, role: "مسؤول النظام", initial: name[0] || "س" });

    // Load Fund Balance
    const { data: txs } = await supabase.from("fund_transactions").select("amount, type");
    const bal = txs?.reduce((acc, t) => t.type === "contribution" ? acc + Number(t.amount) : acc - Number(t.amount), 0) || 0;
    setFundBalance(bal);

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
    const { data: meet } = await supabase.from("meetings").select("*").gte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(1).maybeSingle();
    setNextMeeting(meet);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const arabicGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "صباح الخير";
    if (h < 17) return "مساء النور";
    return "طاب مساؤك";
  };

  return (
    <AppShell title="لوحة العائلة" user={profile}>
      <div className="max-w-6xl mx-auto space-y-10 pb-20">

        {/* Welcome Section */}
        <section className="flex flex-col md:flex-row items-center justify-between gap-8 animate-fade-up">
           <div className="text-center md:text-right space-y-3">
             <div className="flex items-center justify-center md:justify-start gap-4">
               <span className="text-2xl font-bold text-primary opacity-80">{arabicGreeting()}،</span>
               <div className="px-4 py-1 bg-primary/5 rounded-full border border-primary/10 shadow-sm">
                 <LiveClock />
               </div>
             </div>
             <h2 className="text-5xl md:text-6xl font-black text-[#0A0A0B] tracking-tight leading-[1.1]">
               {profile.name}
             </h2>
             <p className="text-xl text-[#4A4A4A] font-medium max-w-[42ch]">
               أهلاً بك في فضاء عائلة آل سيف الرقمي. تواصل، نظّم، واحفظ الإرث.
             </p>
           </div>
           <div className="shrink-0 relative">
             <div className="absolute inset-0 bg-[#D4AF37]/20 blur-[100px] rounded-full" />
             <img src={alsaifMark.url} alt="Logo" className="size-40 md:size-52 object-contain relative z-10 drop-shadow-2xl" />
           </div>
        </section>

        {/* Stats Grid - High Contrast */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
           <StatCard label="رصيد الصندوق" value={fundBalance?.toLocaleString() || "0"} suffix="ر.س" icon={<Wallet />} color="bg-emerald-600" />
           <StatCard label="أفراد العائلة" value={membersCount} suffix="عضو" icon={<Users />} color="bg-primary" />
           <StatCard label="الرحلات المجدولة" value={tripsCount} suffix="رحلة" icon={<Plane />} color="bg-[#8E7745]" />
           <StatCard label="مهام قيد التنفيذ" value={tasksCount} suffix="مهمة" icon={<ListChecks />} color="bg-red-700" />
        </div>

        {/* Main Dashboard Bento */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

           {/* Next Meeting Spotlight */}
           <article className="lg:col-span-8 card-surface overflow-hidden flex flex-col md:flex-row border-none shadow-2xl">
              <div className="flex-1 p-10 space-y-8">
                 <div className="space-y-3">
                   <div className="flex items-center gap-2">
                     <div className="size-2 rounded-full bg-[#D4AF37] animate-pulse" />
                     <span className="text-xs font-black text-[#D4AF37] uppercase tracking-[0.2em]">الحدث القادم</span>
                   </div>
                   <h3 className="text-3xl font-black text-[#0A0A0B] leading-tight">
                     {nextMeeting?.title || "لا توجد اجتماعات معلنة حالياً"}
                   </h3>
                 </div>

                 <div className="flex flex-wrap gap-10">
                    <div className="flex items-center gap-4">
                       <div className="size-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-inner">
                          <CalendarDays size={24} />
                       </div>
                       <div>
                          <p className="text-[11px] font-bold text-muted-foreground uppercase">الموعد</p>
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
                          <p className="text-[11px] font-bold text-muted-foreground uppercase">الموقع</p>
                          <p className="text-base font-black text-foreground">{nextMeeting?.location || "يحدد لاحقاً"}</p>
                       </div>
                    </div>
                 </div>

                 <div className="pt-4 flex gap-4">
                    <Link to="/meetings" className="btn-gold px-10 py-4 text-base shadow-2xl shadow-[#B8972E]/30">
                       تأكيد الحضور
                    </Link>
                    <button className="px-6 py-4 rounded-2xl bg-[#F2F2F7] text-[#4A4A4A] font-bold hover:bg-[#E5E5EA] transition-all">
                       المزيد
                    </button>
                 </div>
              </div>
              <div className="md:w-1/3 bg-[#1B4332] p-10 flex flex-col items-center justify-center text-center text-white relative overflow-hidden">
                 <div className="absolute inset-0 opacity-10 scale-150 rotate-12">
                   <img src={alsaifMark.url} className="size-full object-contain brightness-0 invert" />
                 </div>
                 <div className="relative z-10">
                   <p className="text-[13px] font-bold uppercase tracking-widest opacity-60 mb-2">الوقت المتبقي</p>
                   <div className="text-5xl font-black tabular-nums">4</div>
                   <p className="text-xl font-bold">أيام</p>
                 </div>
              </div>
           </article>

           {/* Quick Access Sidebar */}
           <article className="lg:col-span-4 space-y-6">
              <div className="card-surface p-8">
                 <h3 className="text-lg font-black text-primary mb-6 border-b border-border/50 pb-4">إجراءات سريعة</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <QuickAction to="/chat" label="محادثة" icon={<MessageCircle size={20} />} />
                    <QuickAction to="/trips" label="رحلة" icon={<Plane size={20} />} />
                    <QuickAction to="/tasks" label="مهمة" icon={<ListChecks size={20} />} />
                    <QuickAction to="/majlis" label="إعلان" icon={<Megaphone size={20} />} />
                 </div>
              </div>

              <div className="card-surface p-8 bg-[#1B4332] border-none text-white relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform duration-500">
                    <Sparkles size={80} />
                 </div>
                 <h3 className="text-lg font-bold mb-2">أرشيف العائلة</h3>
                 <p className="text-sm opacity-70 mb-6 font-medium leading-relaxed">
                   استكشف صور ووثائق عائلة آل سيف التاريخية.
                 </p>
                 <Link to="/archive" className="inline-flex items-center gap-2 text-sm font-black text-[#D4AF37] hover:gap-4 transition-all">
                    فتح الأرشيف <ChevronLeft size={16} />
                 </Link>
              </div>
           </article>

        </div>
      </div>

      {/* Modern High-Contrast FAB */}
      <Link to="/majlis" className="fixed bottom-10 left-10 size-20 rounded-[32px] bg-[#1B4332] text-white flex items-center justify-center shadow-[0_25px_60px_-15px_rgba(27,67,50,0.5)] hover:-translate-y-2 hover:rotate-90 transition-all duration-500 active:scale-90 z-50 border-4 border-white/10">
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
          <div className="text-4xl font-black text-[#0A0A0B] tracking-tight">
            {value} <span className="text-base font-bold opacity-40 mr-1">{suffix}</span>
          </div>
       </div>
       <div className={cn("size-16 rounded-[24px] flex items-center justify-center text-white shadow-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-6", color)}>
          {icon}
       </div>
    </div>
  );
}

function QuickAction({ to, label, icon }: { to: string, label: string, icon: React.ReactNode }) {
  return (
    <Link to={to} className="flex flex-col items-center justify-center gap-3 p-5 rounded-[24px] bg-[#F2F2F7] border border-transparent hover:border-primary/20 hover:bg-white hover:shadow-xl transition-all group">
       <div className="text-[#8E7745] group-hover:text-primary group-hover:scale-110 transition-all duration-300">
          {icon}
       </div>
       <span className="text-xs font-black text-[#4A4A4A]">{label}</span>
    </Link>
  );
}
