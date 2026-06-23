import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, useRef } from "react";
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
  Timer,
  Compass,
  MapPinned,
  User,
  Trees
} from "lucide-react";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
import { AnimatedCounter } from "@/components/dashboard/animated-counter";
import { LiveClock } from "@/components/dashboard/live-clock";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { TripImage } from "@/components/trip-image";

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
  const [profile, setProfile] = useState<{ name: string; role: string; initial: string; avatarPath?: string | null; userId?: string }>({
    name: "تحميل...", role: "عضو", initial: "س",
  });

  const [fundBalance, setFundBalance] = useState<number>(0);
  const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([]);
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [tripsCount, setTripsCount] = useState(0);
  const [membersCount, setMembersCount] = useState(0);
  const [tasksCount, setTasksCount] = useState(0);
  const [statIndex, setStatIndex] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const u = authData.user;

      const { data: p } = await supabase.from("profiles").select("arabic_name, full_name, avatar_url").eq("id", u.id).maybeSingle();

      const name = p?.arabic_name || p?.full_name || u.email?.split('@')[0] || "عضو العائلة";

      setProfile({
        name,
        role: "عضو المجلس",
        initial: (name ? name[0] : "ع").toUpperCase(),
        avatarPath: p?.avatar_url ?? null,
        userId: u.id
      });

      // Fetch stats individually to avoid Promise.all crash
      supabase.from("trips").select("*", { count: "exact", head: true }).then(r => setTripsCount(r.count || 0));
      supabase.from("profiles").select("*", { count: "exact", head: true }).then(r => setMembersCount(r.count || 0));
      supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "done").then(r => setTasksCount(r.count || 0));

      const now = new Date().toISOString();
      supabase.from("meetings").select("*").gte("scheduled_at", now).order("scheduled_at").limit(2).then(r => setUpcomingMeetings(r.data || []));
      supabase.from("trips").select("*").gte("start_date", now).order("start_date").limit(2).then(r => setUpcomingTrips(r.data || []));

      supabase.from("fund_transactions").select("amount, type").then(r => {
        const bal = (r.data || []).reduce((acc, t) => {
          const val = Number(t.amount) || 0;
          return t.type === "contribution" ? acc + val : acc - val;
        }, 0);
        setFundBalance(bal);
      });
    } catch (err) {
      console.error("Dashboard error:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(() => setStatIndex(prev => (prev + 1) % 4), 6000);
    return () => clearInterval(timer);
  }, [loadData]);

  const stats = [
    { label: "رصيد الصندوق", value: fundBalance, suffix: "ر.س", color: "bg-gradient-to-br from-emerald-600 to-teal-900", icon: <Wallet className="size-16" />, link: "/finance" },
    { label: "أفراد العائلة", value: membersCount, suffix: "عضو", color: "bg-gradient-to-br from-primary to-emerald-950", icon: <Users className="size-16" />, link: "/members" },
    { label: "الرحلات المجدولة", value: tripsCount, suffix: "رحلة", color: "bg-gradient-to-br from-[#8E7745] to-[#453a22]", icon: <Plane className="size-16" />, link: "/trips" },
    { label: "مهام قيد التنفيذ", value: tasksCount, suffix: "مهمة", color: "bg-gradient-to-br from-rose-700 to-rose-950", icon: <ListChecks className="size-16" />, link: "/tasks" },
  ];

  const tripsPlugin = useRef(
    Autoplay({ delay: 5000, stopOnInteraction: true })
  );
  const meetingsPlugin = useRef(
    Autoplay({ delay: 6000, stopOnInteraction: true })
  );

  return (
    <AppShell title="لوحة العائلة" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-20">

        {/* Hero Section */}
        <section className="text-center space-y-6 animate-fade-up">
           <div className="inline-block px-6 py-2 bg-primary/5 rounded-full border border-primary/10 backdrop-blur-sm">
             <LiveClock />
           </div>

           <div className="relative inline-block group">
             <div className="absolute inset-0 bg-gold-primary/20 blur-[100px] rounded-full animate-pulse" />
             <div className="absolute -inset-4 bg-gradient-to-br from-gold-primary/20 to-transparent rounded-full blur-2xl" />
             <div
               className="size-40 md:size-56 relative z-10 logo-alsaif hover:scale-105 transition-transform duration-700"
               style={{ '--logo-url': `url(${alsaifMark?.url || ""})` } as any}
             />
           </div>

           <div className="space-y-2">
             <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-tight">
               {profile.name}
             </h2>
             <p className="text-xl text-muted-foreground font-bold opacity-60">نصل العائلة، نحفظ الإرث، ونبني المستقبل.</p>
           </div>
        </section>

        {/* Quick Actions */}
        <QuickActionsBanner />

        {/* Dynamic Event Banners - Carousels */}
        <section className="px-4 space-y-8 animate-fade-up" style={{ animationDelay: "200ms" }}>
           {/* Trips Carousel */}
           {upcomingTrips.length > 0 && (
             <div className="space-y-4">
               <div className="flex items-center gap-3 text-[#8E7745] font-black uppercase tracking-widest text-xs px-6">
                 <Plane className="size-4" /> الرحلات القادمة
               </div>
               <Carousel
                 plugins={[tripsPlugin.current]}
                 className="w-full"
                 orientation="vertical"
                 onMouseEnter={tripsPlugin.current.stop}
                 onMouseLeave={tripsPlugin.current.reset}
                 opts={{
                   loop: true,
                 }}
               >
                 <CarouselContent className="h-[400px]">
                   {upcomingTrips.map(trip => {
                     const daysLeft = trip.start_date
                       ? Math.ceil((new Date(trip.start_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                       : 0;

                     return (
                       <CarouselItem key={trip.id} className="h-full">
                         <div className="flex items-center gap-0 h-full w-full group/container">
                           {/* Trip Banner */}
                           <article className="flex-1 relative overflow-hidden rounded-[40px] rounded-l-none shadow-2xl border-2 border-gold-primary/20 border-l-0 text-white p-8 flex flex-col items-center justify-between h-full group">
                              {/* Background Destination Image */}
                              <div className="absolute inset-0 z-0">
                                 <TripImage
                                   path={trip.image_url}
                                   alt={trip.title}
                                   className="size-full object-cover object-center transition-transform duration-1000 group-hover:scale-110"
                                 />
                                 <div className="absolute inset-0 bg-gradient-to-t from-[#1a0f0a] via-[#1a0f0a]/70 to-transparent" />
                                 <div className="absolute inset-0 bg-black/30" />
                              </div>

                              {/* Decorative family mark - smaller and on the left */}
                              <div className="absolute left-6 top-1/2 -translate-y-1/2 opacity-15 pointer-events-none z-1 transition-transform duration-1000 group-hover:scale-110">
                                 <img src={alsaifMark?.url || ""} className="size-20 md:size-28 object-contain brightness-0 invert" alt="" />
                              </div>

                              {/* Top Section: Badge & Icon */}
                              <div className="relative z-10 w-full flex justify-between items-start">
                                 <div className="px-5 py-2 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md text-gold-primary text-[10px] font-black uppercase tracking-[0.2em]">
                                    رحلة مرتقبة
                                 </div>
                                 <div className="size-14 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md flex items-center justify-center text-gold-primary animate-pulse">
                                    <Plane size={24} />
                                 </div>
                              </div>

                              {/* Middle Section: Title & Location */}
                              <div className="relative z-10 space-y-4 text-center">
                                 <h3 className="text-4xl md:text-5xl font-black bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent leading-tight drop-shadow-2xl px-4">
                                    {trip.title}
                                 </h3>
                                 <div className="flex items-center justify-center gap-4 text-sm font-medium text-gold-primary">
                                    <span className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/5"><MapPin size={14} /> {trip.location || "وجهة عائلية"}</span>
                                 </div>
                              </div>

                              {/* Bottom Section: Date & CTA */}
                              <div className="relative z-10 w-full space-y-8 flex flex-col items-center">
                                 <div className="flex items-center gap-8">
                                    <div className="text-center">
                                       <p className="text-[10px] uppercase tracking-widest opacity-60 mb-1">التاريخ</p>
                                       <p className="text-xl font-black">{trip.start_date ? new Date(trip.start_date).toLocaleDateString("ar-SA", { day: 'numeric', month: 'short' }) : "—"}</p>
                                    </div>
                                    <div className="h-10 w-px bg-white/20" />
                                    <div className="text-center">
                                       <p className="text-[10px] uppercase tracking-widest opacity-60 mb-1">اليوم</p>
                                       <p className="text-xl font-black">{trip.start_date ? new Date(trip.start_date).toLocaleDateString("ar-SA", { weekday: 'long' }) : "—"}</p>
                                    </div>
                                 </div>

                                 <Link to="/trips" className="group/btn relative px-10 py-4 overflow-hidden rounded-full font-black text-black transition-all hover:scale-105 active:scale-95 shadow-xl">
                                    <div className="absolute inset-0 bg-gold-primary" />
                                    <span className="relative flex items-center gap-3">تفاصيل الرحلة <Compass size={18} /></span>
                                 </Link>
                              </div>
                           </article>

                           {/* External Countdown Card */}
                           <div className="flex flex-col items-center justify-center w-24 md:w-32 h-full rounded-[40px] rounded-r-none bg-gradient-to-b from-[#2C1810] to-[#1a0f0a] border-2 border-gold-primary/30 shadow-2xl p-4 md:p-6 text-center space-y-2 md:space-y-3 shrink-0 relative overflow-hidden">
                              <div className="absolute inset-0 bg-gold-primary/5 animate-pulse" />
                              <Timer className="size-5 md:size-6 text-gold-primary relative z-10" />
                              <div className="space-y-0 relative z-10">
                                 <span className="text-4xl md:text-5xl font-black text-gold-primary block tracking-tighter">
                                    {daysLeft > 0 ? daysLeft : 0}
                                 </span>
                                 <span className="text-[8px] md:text-[10px] font-black text-gold-primary/50 uppercase tracking-[0.2em]">أيام متبقية</span>
                              </div>
                              <div className="w-8 md:w-12 h-0.5 md:h-1 bg-gold-primary/20 rounded-full relative z-10" />
                              <p className="text-[8px] md:text-[10px] font-bold text-white/40 leading-relaxed relative z-10 line-clamp-2">تجهّز للمغامرة القادمة</p>
                           </div>
                         </div>
                       </CarouselItem>
                     );
                   })}
                 </CarouselContent>
               </Carousel>
             </div>
           )}

           {/* Meetings Carousel */}
           {upcomingMeetings.length > 0 && (
             <div className="space-y-4">
               <div className="flex items-center gap-3 text-primary font-black uppercase tracking-widest text-xs px-6">
                 <CalendarDays className="size-4" /> الاجتماعات المرتقبة
               </div>
               <Carousel
                 plugins={[meetingsPlugin.current]}
                 className="w-full"
                 onMouseEnter={meetingsPlugin.current.stop}
                 onMouseLeave={meetingsPlugin.current.reset}
                 opts={{
                   direction: 'rtl',
                   loop: true,
                 }}
               >
                 <CarouselContent>
                   {upcomingMeetings.map(meeting => {
                     const daysLeft = Math.ceil((new Date(meeting.scheduled_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                     return (
                       <CarouselItem key={meeting.id}>
                         <article className="relative overflow-hidden rounded-[48px] shadow-2xl border-4 border-white/5 bg-gradient-to-br from-primary via-[#1a2b3c] to-black text-white p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 h-full group">
                            <div className="absolute inset-0 opacity-10 pointer-events-none scale-150 group-hover:scale-110 transition-transform duration-1000">
                               <img src={alsaifMark?.url || ""} className="size-full object-contain brightness-0 invert" alt="" />
                            </div>
                            <div className="absolute top-0 right-0 size-64 bg-gold-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />

                            <div className="flex-1 space-y-6 relative z-10">
                               <div className="flex items-center gap-3">
                                  <div className="h-0.5 w-8 bg-gold-primary" />
                                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold-primary">حدث عائلي قريب</span>
                               </div>
                               <h3 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight drop-shadow-2xl">{meeting.title}</h3>
                               <div className="flex items-center gap-4 text-white/60 font-bold">
                                  <Clock className="size-5 text-gold-primary" />
                                  <span>{new Date(meeting.scheduled_at).toLocaleDateString("ar-SA", { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                               </div>
                               <Link to="/meetings" className="btn-gold px-12 py-4 rounded-full font-black inline-flex items-center gap-3 shadow-2xl shadow-gold-primary/20 hover:scale-105 active:scale-95 transition-all">
                                  تأكيد الحضور <ChevronLeft size={20} />
                               </Link>
                            </div>
                            <div className="flex flex-col items-center justify-center p-6 md:p-10 bg-white/5 backdrop-blur-md rounded-[32px] md:rounded-[40px] border border-white/10 relative z-10 min-w-[120px] md:min-w-[180px]">
                               <Timer className="size-6 md:size-10 mb-2 md:mb-3 text-gold-primary animate-pulse" />
                               <div className="text-center">
                                  <p className="text-3xl md:text-5xl font-black tracking-tighter text-white">{daysLeft > 0 ? daysLeft : 0}</p>
                                  <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-white/40 mt-1">أيام متبقية</p>
                               </div>
                            </div>
                         </article>
                       </CarouselItem>
                     );
                   })}
                 </CarouselContent>
               </Carousel>
             </div>
           )}
        </section>

        {/* Stats Slider */}
        <section className="px-4 animate-fade-up" style={{ animationDelay: "300ms" }}>
           <div className="relative overflow-hidden rounded-[48px] h-[280px] shadow-2xl border-4 border-white dark:border-border">
              {stats.map((stat, i) => (
                <div key={i} className={cn(
                  "absolute inset-0 w-full h-full transition-all duration-1000 flex items-center p-12 md:p-20",
                  stat.color,
                  statIndex === i ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"
                )}>
                   <div className="absolute inset-0 opacity-10 pointer-events-none scale-150"><img src={alsaifMark?.url || ""} className="size-full object-contain brightness-0 invert" alt="" /></div>
                   <div className="relative z-10 flex items-center justify-between w-full text-white">
                      <div className="space-y-6">
                         <div className="flex items-center gap-3 font-black uppercase tracking-[0.4em] text-xs opacity-70"><Sparkles className="size-5" /> {stat.label}</div>
                         <div className="text-6xl md:text-8xl font-black tracking-tighter flex items-baseline gap-4"><AnimatedCounter value={stat.value} /><span className="text-2xl opacity-50">{stat.suffix}</span></div>
                         <Link to={stat.link} className="inline-flex items-center gap-3 bg-white/20 px-8 py-3 rounded-full text-sm font-black transition-all">التفاصيل <ChevronLeft size={20} /></Link>
                      </div>
                      <div className="hidden lg:flex size-44 rounded-[50px] bg-white/10 items-center justify-center border border-white/20">{stat.icon}</div>
                   </div>
                </div>
              ))}
           </div>
        </section>

      </div>
      <Link to="/majlis" className="fixed bottom-10 left-10 size-20 rounded-[32px] bg-primary text-primary-foreground flex items-center justify-center shadow-2xl z-50 border-4 border-white/10"><Plus size={36} strokeWidth={3} /></Link>
    </AppShell>
  );
}

