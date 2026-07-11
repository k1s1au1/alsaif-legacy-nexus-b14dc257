import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  CalendarDays,
  MapPin,
  Clock,
  X,
  Trash2,
  Pencil,
  Plus,
  ChevronLeft,
  UserCheck,
  UserX,
  Loader2,
  HelpCircle,
  Timer,
  Navigation,
  Bell,
  Share2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { UserAvatar } from "@/components/user-avatar";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useUserRole, roleLabel } from "@/hooks/use-user-role";

import { MeetingPresentations } from "@/components/meeting-presentations";
import { addToCalendar } from "@/lib/calendar";

export const Route = createFileRoute("/_authenticated/meetings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الاجتماعات العائلية — السيف" },
      { name: "description", content: "جدول اجتماعات وفعاليات عائلة السيف." },
    ],
  }),
  component: MeetingsPage,
});

type Rsvp = "going" | "not_going" | "maybe";
type Meeting = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  location_url: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  status: "scheduled" | "cancelled" | "completed";
  created_by: string;
};
type Attendee = { meeting_id: string; user_id: string; rsvp: Rsvp; companions_count?: number };
type ProfileLite = { id: string; arabic_name: string | null; full_name: string | null; avatar_url: string | null };

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    day: d.getDate(),
    month: d.toLocaleString("ar-SA", { month: "long" }),
    weekday: d.toLocaleString("ar-SA", { weekday: "long" }),
    time: d.toLocaleString("ar-SA", { hour: "numeric", minute: "2-digit" }),
    year: d.getFullYear()
  };
}

function MeetingsPage() {
  const [profile, setProfile] = useState({ name: "عضو العائلة", role: "عضو", initial: "ص", avatarPath: null as string | null });
  const { userId, isLoading: rolesLoading, canManage: canManageSection, primaryRole, isAdmin, isChairman } = useUserRole();
  const dynamicLogo = useSiteLogo();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [savingRsvp, setSavingRsvp] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // form fields
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [fLocationUrl, setFLocationUrl] = useState("");
  const [fWhen, setFWhen] = useState("");
  const [fDuration, setFDuration] = useState("");

  const canManage = canManageSection("meetings");
  const plugin = useRef(Autoplay({ delay: 5000, stopOnInteraction: true }));

  const resetForm = useCallback(() => {
    setFTitle("");
    setFDesc("");
    setFLocation("");
    setFLocationUrl("");
    setFWhen("");
    setFDuration("");
    setEditing(null);
  }, []);

  const loadAll = useCallback(async () => {
    const [{ data: m }, { data: a }, { data: pr }] = await Promise.all([
      supabase.from("meetings").select("*").order("scheduled_at", { ascending: true }),
      supabase.from("meeting_attendees").select("*"),
      supabase.from("profiles").select("id, arabic_name, full_name, avatar_url"),
    ]);

    setMeetings((m ?? []) as Meeting[]);
    setAttendees((a ?? []) as Attendee[]);
    const map: Record<string, ProfileLite> = {};
    (pr ?? []).forEach((p: any) => { map[p.id] = p; });
    setProfiles(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      if (userId) {
        const [{ data: p }, { data: r }] = await Promise.all([
          supabase.from("profiles").select("arabic_name, full_name, avatar_url").eq("id", userId).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", userId)
        ]);
        const rs = (r ?? []).map(x => x.role);
        setProfile({
          name: p?.arabic_name || p?.full_name || "عضو العائلة",
          role: rs.includes("admin") ? "مسؤول النظام" : rs.includes("chairman") ? "رئيس المجلس" : "عضو",
          initial: "ع",
          avatarPath: p?.avatar_url || null
        });
      }
      await loadAll();
    })();

    const channel = supabase
      .channel("meetings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_attendees" }, () => loadAll())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAll, userId, primaryRole]);

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (m: Meeting) => {
    setEditing(m);
    setFTitle(m.title);
    setFDesc(m.description ?? "");
    setFLocation(m.location ?? "");
    setFLocationUrl(m.location_url ?? "");
    const d = new Date(m.scheduled_at);
    const pad = (n: number) => String(n).padStart(2, "0");
    setFWhen(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setFDuration(m.duration_minutes ? String(m.duration_minutes) : "");
    setShowForm(true);
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!fTitle.trim() || !fWhen) {
      toast.error("العنوان والموعد مطلوبان");
      return;
    }
    setSubmitting(true);
    const payload = {
      title: fTitle.trim(),
      description: fDesc.trim() || null,
      location: fLocation.trim() || null,
      location_url: fLocationUrl.trim() || null,
      scheduled_at: new Date(fWhen).toISOString(),
      duration_minutes: fDuration ? Number(fDuration) : null,
    };
    if (editing) {
      const { error } = await supabase.from("meetings").update(payload).eq("id", editing.id);
      if (error) toast.error("تعذر التحديث");
      else {
        toast.success("تم التحديث");
        setShowForm(false);
        resetForm();
        loadAll();
      }
    } else {
      const { error } = await supabase.from("meetings").insert({ ...payload, created_by: userId });
      if (error) toast.error("تعذر الإنشاء");
      else {
        toast.success("تم الإنشاء");
        setShowForm(false);
        resetForm();
        loadAll();
      }
    }
    setSubmitting(false);
  };

  const deleteMeeting = async (id: string) => {
    if (!confirm("هل تريد حذف هذا الاجتماع؟")) return;
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    if (error) toast.error("تعذر الحذف");
    else {
      toast.success("تم الحذف");
      loadAll();
    }
  };

  const setRsvp = async (meetingId: string, rsvp: Rsvp, companionsCount: number = 0) => {
    if (!userId || savingRsvp === meetingId) return;

    const prevAttendees = attendees;
    const current = attendees.find(a => a.meeting_id === meetingId && a.user_id === userId);
    const isRemoving = current?.rsvp === rsvp && current?.companions_count === companionsCount;

    setSavingRsvp(meetingId);

    // Optimistic update
    setAttendees(prev => {
      const without = prev.filter(a => !(a.meeting_id === meetingId && a.user_id === userId));
      return isRemoving ? without : [...without, { meeting_id: meetingId, user_id: userId, rsvp, companions_count: companionsCount }];
    });

    try {
      if (isRemoving) {
        const { error } = await supabase
          .from("meeting_attendees")
          .delete()
          .eq("meeting_id", meetingId)
          .eq("user_id", userId);
        if (error) throw error;
        toast.success("تم إلغاء الرد");
      } else {
        const payload: any = { meeting_id: meetingId, user_id: userId, rsvp };
        if (companionsCount > 0) payload.companions_count = companionsCount;

        const { error } = await supabase
          .from("meeting_attendees")
          .upsert(payload, { onConflict: "meeting_id,user_id" });

        if (error) {
          const { error: retryError } = await supabase
            .from("meeting_attendees")
            .upsert({ meeting_id: meetingId, user_id: userId, rsvp }, { onConflict: "meeting_id,user_id" });
          if (retryError) throw retryError;
        }

        toast.success(rsvp === "going" ? "ننتظر تشريفك!" : "تم تسجيل اعتذارك");
      }
    } catch (error) {
      console.error("Meeting RSVP error:", error);
      toast.error("تعذر تحديث حالة الحضور");
      setAttendees(prevAttendees);
    } finally {
      setSavingRsvp(null);
    }
  };

  const handleRemindAll = async (m: Meeting) => {
    try {
      toast.loading("جاري إرسال التذكيرات...");
      const { sendPushNotification } = await import("@/lib/api/push.functions");
      await sendPushNotification({
        data: {
          title: `تذكير: ${m.title}`,
          body: `نذكركم بموعدنا القريب في: ${formatDate(m.scheduled_at).weekday} الساعة ${formatDate(m.scheduled_at).time}`,
          type: "meetings",
          route: "/meetings",
        },
      });
      toast.dismiss();
      toast.success("تم إرسال التذكير لجميع أفراد العائلة بنجاح ✨");
    } catch (err) {
      toast.dismiss();
      toast.error("فشل إرسال التذكير");
    }
  };

  const upcoming = meetings.filter(m => new Date(m.scheduled_at) >= new Date());
  const past = meetings.filter(m => new Date(m.scheduled_at) < new Date());

  const countsFor = (meetingId: string) => {
    const list = attendees.filter((a) => a.meeting_id === meetingId);
    return {
      going: list.filter((a) => a.rsvp === "going").length,
      not_going: list.filter((a) => a.rsvp === "not_going").length,
      maybe: list.filter((a) => a.rsvp === "maybe").length,
    };
  };

  const myRsvp = (meetingId: string): Rsvp | null => {
    if (!userId) return null;
    return attendees.find((a) => a.meeting_id === meetingId && a.user_id === userId)?.rsvp ?? null;
  };

  const myCompanions = (meetingId: string): number => {
    if (!userId) return 0;
    return attendees.find((a) => a.meeting_id === meetingId && a.user_id === userId)?.companions_count ?? 0;
  };

  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const tabs: { key: typeof tab; label: string; count?: number; icon: any }[] = [
    { key: "upcoming", label: "القادمة", count: upcoming.length, icon: Timer },
    { key: "past", label: "الأرشيف", count: past.length, icon: Clock },
  ];

  return (
    <AppShell title="الاجتماعات" user={profile}>
      <div className="max-w-6xl mx-auto space-y-8 pb-24 px-4 md:px-0" dir="rtl">
        <QuickActionsBanner />

        {/* Compact Header */}
        <section className="animate-fade-up">
          <div className="relative overflow-hidden rounded-[28px] md:rounded-[36px] bg-gradient-to-br from-primary via-[#1a2b3c] to-black p-6 md:p-8 text-white shadow-xl border border-white/5">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-15 pointer-events-none hidden md:block">
              <div className="size-24 md:size-40 logo-alsaif-banner" style={{ "--logo-url": dynamicLogo ? `url(${dynamicLogo})` : "none" } as any} />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2 text-center md:text-right">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <div className="h-0.5 w-8 bg-gold-primary" />
                  <CalendarDays className="size-3 text-gold-primary md:hidden" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold-primary">ملتقى العائلة</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black tracking-tight">الاجتماعات</h2>
                <p className="text-white/60 font-bold text-xs md:text-sm max-w-md">جدول اللقاءات العائلية والنقاشات.</p>
              </div>
              {canManage && (
                <button onClick={openCreate} className="btn-gold px-6 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-xl text-sm font-black self-center md:self-auto shrink-0 active:scale-95 transition-all">
                  <Plus size={18} strokeWidth={3} />
                  <span>إضافة اجتماع</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-muted/40 rounded-2xl border border-border/40">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "min-w-0 px-2 sm:px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm font-black transition-all",
                  active ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={14} className="shrink-0" />
                <span className="truncate">{t.label}</span>
                {typeof t.count === "number" && t.count > 0 && (
                  <span className={cn("hidden sm:inline text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0", active ? "bg-white/20" : "bg-muted-foreground/10")}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>


        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-40">
            <div className="size-12 rounded-full border-4 border-primary/20 border-t-gold-primary animate-spin" />
            <p className="font-black text-primary uppercase tracking-widest text-xs">جاري التحميل...</p>
          </div>
        ) : (
          <div key={tab} className="animate-fade-up">
            {tab === "upcoming" && (
              upcoming.length === 0 ? (
                <div className="card-surface p-16 flex flex-col items-center text-center gap-4 border-dashed border-2 opacity-60 rounded-[32px] bg-muted/20">
                  <CalendarDays size={48} className="text-muted-foreground opacity-40" />
                  <p className="text-lg font-black text-primary">لا توجد اجتماعات مجدولة</p>
                </div>
              ) : (
                <Carousel
                  plugins={[plugin.current]}
                  className="w-full touch-pan-y"
                  onMouseEnter={plugin.current.stop}
                  onMouseLeave={plugin.current.reset}
                  opts={{ direction: 'rtl', loop: upcoming.length > 1, watchDrag: true }}
                >
                  <CarouselContent className="touch-pan-y">
                    {upcoming.map((m) => (
                      <CarouselItem key={m.id}>
                        <MeetingInteractiveCard
                          meeting={m}
                          counts={countsFor(m.id)}
                          attendeesList={attendees.filter((a) => a.meeting_id === m.id)}
                          profiles={profiles}
                          myRsvp={myRsvp(m.id)}
                          myCompanions={myCompanions(m.id)}
                          onRsvp={setRsvp}
                          canManage={canManage}
                          onEdit={openEdit}
                          onDelete={deleteMeeting}
                          onRemind={handleRemindAll}
                          saving={savingRsvp === m.id}
                          ready={!rolesLoading && !!userId}
                          dynamicLogo={dynamicLogo}
                          userId={userId}
                        />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {upcoming.length > 1 && (
                    <div className="hidden md:block">
                      <CarouselPrevious className="right-4 bg-white/20 border-white/40 text-white hover:bg-gold-primary hover:text-black transition-all" />
                      <CarouselNext className="left-4 bg-white/20 border-white/40 text-white hover:bg-gold-primary hover:text-black transition-all" />
                    </div>
                  )}
                </Carousel>
              )
            )}

            {tab === "past" && (
              past.length === 0 ? (
                <div className="card-surface p-16 flex flex-col items-center text-center gap-4 border-dashed border-2 opacity-60 rounded-[32px] bg-muted/20">
                  <Clock size={48} className="text-muted-foreground opacity-40" />
                  <p className="text-lg font-black text-primary">لا توجد اجتماعات سابقة</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {past.map((m) => (
                    <div key={m.id} className="card-surface p-5 flex items-center justify-between hover:bg-muted/40 transition-all group rounded-[24px]">
                      <div className="flex items-center gap-4">
                        <div className="size-14 rounded-2xl bg-muted flex flex-col items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                          <span className="text-[10px] font-black uppercase tracking-tighter">{formatDate(m.scheduled_at).month}</span>
                          <span className="text-2xl font-black tracking-tighter leading-none">{formatDate(m.scheduled_at).day}</span>
                        </div>
                        <div>
                          <h4 className="font-black text-base text-foreground">{m.title}</h4>
                          <p className="text-xs font-bold text-muted-foreground">{formatDate(m.scheduled_at).year}</p>
                        </div>
                      </div>
                      <ChevronLeft className="opacity-20 group-hover:opacity-100 group-hover:-translate-x-2 transition-all" />
                    </div>
                  ))}
                </div>
              )
            )}

          </div>
        )}
      </div>




      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-card border border-border rounded-[48px] w-full max-w-2xl overflow-hidden shadow-2xl p-8 md:p-12 space-y-8"
              dir="rtl"
            >
              <div className="flex items-center justify-between">
                 <div className="space-y-1">
                    <h3 className="text-3xl font-black tracking-tight text-primary">{editing ? "تعديل اللقاء" : "جدولة لقاء عائلي"}</h3>
                 </div>
                 <button onClick={() => setShowForm(false)} className="size-12 rounded-full bg-muted/50 flex items-center justify-center hover:bg-primary hover:text-white transition-all"><X size={24} /></button>
              </div>

              <form onSubmit={submitForm} className="space-y-6">
                  <div className="grid gap-6">
                    <div className="space-y-2">
                       <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">عنوان الاجتماع</label>
                       <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} required placeholder="مثال: اجتماع العائلة السنوي" className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">وصف موجز</label>
                       <textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={3} placeholder="ماذا سنناقش في هذا اللقاء؟" className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm resize-none" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">موعد اللقاء</label>
                         <input type="datetime-local" value={fWhen} onChange={(e) => setFWhen(e.target.value)} required className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">المدة التقريبية (دقيقة)</label>
                         <input type="number" min="0" value={fDuration} onChange={(e) => setFDuration(e.target.value)} placeholder="60" className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm" />
                      </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">مكان الاجتماع / الرابط</label>
                       <input value={fLocation} onChange={(e) => setFLocation(e.target.value)} placeholder="مثال: مجلس العائلة" className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm mb-3" />
                       <input type="url" value={fLocationUrl} onChange={(e) => setFLocationUrl(e.target.value)} placeholder="رابط الموقع على الخريطة" className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm" />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button type="submit" disabled={submitting} className="flex-1 btn-gold py-5 rounded-[28px] text-lg font-black shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-3 disabled:opacity-50">
                      {submitting ? <div className="size-5 rounded-full border-2 border-white/20 border-t-white animate-spin" /> : <span>{editing ? "حفظ التعديلات" : "تأكيد الجدولة"}</span>}
                    </button>
                    <button type="button" onClick={() => setShowForm(false)} className="px-10 py-5 rounded-[28px] bg-muted/50 font-black text-muted-foreground hover:bg-muted transition-all">إلغاء</button>
                  </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function MeetingInteractiveCard({ meeting, counts, attendeesList, profiles, myRsvp, myCompanions, onRsvp, canManage, onEdit, onDelete, saving, ready, dynamicLogo, userId, onRemind }: any) {
  const date = formatDate(meeting.scheduled_at);
  const going = attendeesList.filter((a: any) => a.rsvp === 'going').map((a: any) => profiles[a.user_id]).filter(Boolean);
  const [compCount, setCompCount] = useState(myCompanions || 0);

  useEffect(() => {
    setCompCount(myCompanions || 0);
  }, [myCompanions]);

  const totalGoingCount = attendeesList
    .filter((a: any) => a.rsvp === 'going')
    .reduce((acc: number, cur: any) => acc + 1 + (cur.companions_count || 0), 0);

  return (
    <article className={cn(
      "relative min-h-[420px] md:min-h-[520px] lg:min-h-[580px] overflow-hidden rounded-[32px] md:rounded-[48px] lg:rounded-[64px] text-white p-6 md:p-12 lg:p-20 flex flex-col justify-between gap-6 md:gap-10 group cursor-grab active:cursor-grabbing border border-white/10 shadow-2xl mx-1 md:mx-0 transition-all duration-700",
      myRsvp === 'going' ? "bg-emerald-950" : myRsvp === 'not_going' ? "bg-rose-950" : "bg-primary"
    )}>
       <div className={cn(
         "absolute inset-0 transition-opacity duration-700 z-0",
         myRsvp === 'going' ? "bg-gradient-to-br from-emerald-900 via-emerald-950 to-black" :
         myRsvp === 'not_going' ? "bg-gradient-to-br from-rose-900 via-rose-950 to-black" :
         "bg-gradient-to-br from-primary via-[#1a2b3c] to-black"
       )} />
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none scale-[1.5] md:scale-[2.5] logo-alsaif-banner z-1" style={{ '--logo-url': dynamicLogo ? `url(${dynamicLogo})` : 'none' } as any} />
       <div className="absolute -top-40 -right-40 size-[300px] md:size-[500px] bg-gold-primary/10 rounded-full blur-[100px] pointer-events-none" />

       {/* Top: title + date stack */}
       <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-6 md:gap-10 w-full">
          <div className="min-w-0 space-y-4 md:space-y-6 flex-1">
             <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <span className="px-3 py-1 md:px-5 md:py-2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] md:text-xs font-black uppercase tracking-widest backdrop-blur-md">قادم</span>
                <span className="px-3 py-1 md:px-5 md:py-2 rounded-full bg-white/5 text-white/60 border border-white/10 text-[9px] md:text-xs font-black uppercase tracking-widest backdrop-blur-md flex items-center gap-1.5">
                   <Clock className="size-3 md:size-4 shrink-0" /> {meeting.duration_minutes || "—"} دقيقة
                </span>
                <button
                  onClick={() => addToCalendar({
                    title: meeting.title,
                    description: meeting.description || "",
                    location: meeting.location || "",
                    startTime: meeting.scheduled_at,
                    durationMinutes: meeting.duration_minutes || 60
                  })}
                  className="px-3 py-1 md:px-5 md:py-2 rounded-full bg-gold-primary/20 text-gold-primary border border-gold-primary/30 text-[9px] md:text-xs font-black uppercase tracking-widest backdrop-blur-md flex items-center gap-1.5 hover:bg-gold-primary hover:text-black transition-all shadow-lg"
                >
                   <CalendarDays className="size-3 md:size-4 shrink-0" /> تقويم الجوال
                </button>
             </div>
             <h3 className="text-2xl sm:text-3xl md:text-5xl lg:text-7xl font-black tracking-tighter leading-[1.1] drop-shadow-2xl break-words line-clamp-3 md:line-clamp-none">{meeting.title}</h3>
          </div>

          <div className="shrink-0 flex flex-row md:flex-col items-center md:items-end gap-4 md:gap-4 w-full md:w-auto justify-between md:justify-start border-t border-white/10 pt-4 md:border-none md:pt-0">
             <div className="text-right">
                <span className="text-gold-primary font-black uppercase tracking-[0.3em] text-[10px] md:text-sm block">{date.weekday}</span>
                <div className="flex items-baseline md:block">
                   <span className="text-4xl sm:text-5xl md:text-8xl lg:text-9xl font-black tracking-tighter text-white leading-none block">{date.day}</span>
                   <span className="text-sm sm:text-base md:text-2xl lg:text-4xl font-black text-white/40 uppercase tracking-widest block mr-2 md:mr-0">{date.month}</span>
                </div>
             </div>

             {new Date(meeting.scheduled_at).getTime() > new Date().getTime() && (
               <div className="flex items-center gap-2 md:gap-3 px-4 py-2 md:px-6 md:py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl md:rounded-[24px] shadow-xl">
                  <Timer className="size-4 md:size-7 text-gold-primary animate-pulse shrink-0" />
                  <div className="leading-tight text-center md:text-right">
                    <span className="text-xl md:text-4xl font-black text-white block leading-none">
                      {Math.ceil((new Date(meeting.scheduled_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}
                    </span>
                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-white/40 block">يوم متبقي</span>
                  </div>
               </div>
             )}
          </div>
       </div>

       {/* Middle: description + meta */}
       <div className="relative z-10 space-y-6 md:space-y-10">
          <p className="text-base md:text-xl lg:text-2xl font-bold text-white/70 leading-relaxed border-r-4 border-gold-primary/30 pr-4 md:pr-10 line-clamp-3 md:line-clamp-none">{meeting.description || "لا يوجد وصف لهذه المناسبة العائلية."}</p>

          <div className="flex flex-col md:flex-row flex-wrap items-start md:items-center gap-6 md:gap-12 lg:gap-20">
             {meeting.location && (
               <div className="flex items-center gap-3 md:gap-5 min-w-0 max-w-full group/loc">
                  <div className="size-11 md:size-16 shrink-0 rounded-[18px] md:rounded-[28px] bg-white/5 flex items-center justify-center text-gold-primary border border-white/10 shadow-xl transition-transform group-hover/loc:scale-110">
                     <MapPin className="size-5 md:size-8" />
                  </div>
                  <div className="min-w-0 space-y-1">
                     <p className="text-[9px] md:text-[11px] font-black uppercase tracking-widest text-white/30">المكان والموقع</p>
                     {meeting.location_url ? (
                        <a href={meeting.location_url} target="_blank" rel="noreferrer" className="text-sm md:text-xl lg:text-2xl font-black hover:text-gold-primary transition-all flex items-center gap-2 truncate">
                          <span className="truncate">{meeting.location}</span>
                          <Navigation size={14} className="opacity-40 shrink-0" />
                        </a>
                     ) : (
                        <p className="text-sm md:text-xl lg:text-2xl font-black truncate">{meeting.location}</p>
                     )}
                  </div>
               </div>
             )}

             <div className="flex items-center gap-3 md:gap-5 shrink-0">
                <div className="flex -space-x-3 md:-space-x-5 space-x-reverse">
                   {going.slice(0, 4).map((p: any) => {
                     const attendee = attendeesList.find((a: any) => a.user_id === p.id);
                     const cCount = attendee?.companions_count || 0;
                     return (
                        <div key={p.id} className="relative group/avatar">
                          <div className="size-9 md:size-16 rounded-xl md:rounded-[24px] border-2 md:border-4 border-primary/50 overflow-hidden shadow-2xl transition-transform hover:scale-110 duration-500">
                             <UserAvatar path={p.avatar_url} name={p.arabic_name} className="size-full" userId={p.id} />
                          </div>
                          {cCount > 0 && (
                            <div className="absolute -top-1.5 -right-1.5 size-4 md:size-7 bg-gold-primary text-black text-[8px] md:text-[12px] font-black rounded-full flex items-center justify-center border-2 border-primary shadow-xl z-10 tabular-nums">
                               +{cCount}
                            </div>
                          )}
                        </div>
                     );
                   })}
                   {going.length > 4 && (
                     <div className="size-9 md:size-16 rounded-xl md:rounded-[24px] bg-gold-primary text-black text-[10px] md:text-sm font-black flex items-center justify-center border-2 md:border-4 border-primary shadow-2xl">+{going.length - 4}</div>
                   )}
                </div>
                <div className="min-w-0 space-y-1">
                   <p className="text-[9px] md:text-[11px] font-black uppercase tracking-widest text-white/30">إجمالي الحضور</p>
                   <p className="text-sm md:text-xl font-black text-white tabular-nums">{totalGoingCount} حاضر</p>
                </div>
             </div>
          </div>
       </div>


        {/* Bottom: actions */}
        <div className="relative z-10 flex flex-col gap-3 md:gap-4 w-full">
           {myRsvp === 'going' && (
             <div className="flex flex-col gap-2 bg-white/5 p-4 rounded-[22px] border border-white/10 animate-fade-up">
                <div className="flex items-center justify-between px-1">
                   <p className="text-[10px] font-black text-gold-primary uppercase tracking-widest">عدد المرافقين معك؟</p>
                   <div className="text-center bg-gold-primary/20 px-3 py-1 rounded-lg border border-gold-primary/20">
                      <span className="text-[14px] font-black leading-none text-gold-primary">{1 + compCount} حاضرين</span>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                   <input
                     type="tel"
                     value={compCount === 0 ? "" : compCount}
                     onFocus={(e) => e.target.select()}
                     onChange={(e) => {
                       const val = e.target.value.replace(/[^0-9]/g, '');
                       setCompCount(val === '' ? 0 : parseInt(val));
                     }}
                     onBlur={() => onRsvp(meeting.id, 'going', compCount)}
                     className="flex-1 h-14 md:h-20 bg-white/10 border-2 border-white/20 rounded-2xl md:rounded-[24px] px-6 font-black text-center text-2xl md:text-4xl focus:outline-none focus:border-gold-primary transition-all shadow-inner text-white"
                     placeholder="٠"
                   />
                </div>
             </div>
           )}

           <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 p-1.5 rounded-[28px] grid grid-cols-2 gap-1.5 shadow-2xl overflow-hidden h-[70px]">
              {/* Animated Background Selector */}
              <div
                className={cn(
                  "absolute inset-y-1.5 w-[calc(50%-6px)] rounded-[22px] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-lg",
                  myRsvp === 'going' ? "right-1.5 bg-emerald-500 shadow-emerald-500/40" :
                  myRsvp === 'not_going' ? "right-[calc(50%+1.5px)] bg-rose-500 shadow-rose-500/40" :
                  "opacity-0"
                )}
              />

              <button
                onClick={() => onRsvp(meeting.id, 'going', compCount)}
                disabled={!ready || saving}
                className={cn(
                  "relative z-10 flex items-center justify-center gap-3 font-black text-sm md:text-base transition-colors duration-500",
                  myRsvp === 'going' ? "text-white" : "text-white/40 hover:text-white/60"
                )}
              >
                {saving && myRsvp === 'going' ? <Loader2 className="size-5 animate-spin" /> : <UserCheck size={22} />}
                <span>سأحضر</span>
              </button>

              <button
                onClick={() => onRsvp(meeting.id, 'not_going')}
                disabled={!ready || saving}
                className={cn(
                  "relative z-10 flex items-center justify-center gap-3 font-black text-sm md:text-base transition-colors duration-500",
                  myRsvp === 'not_going' ? "text-white" : "text-white/40 hover:text-white/60"
                )}
              >
                {saving && myRsvp === 'not_going' ? <Loader2 className="size-5 animate-spin" /> : <UserX size={22} />}
                <span>أعتذر</span>
              </button>
           </div>

           <MeetingPresentations meetingId={meeting.id} canManage={canManage} userId={userId} />

           {canManage && (
              <div className="flex flex-wrap items-center gap-2">
                 <button
                   onClick={() => onRemind(meeting)}
                   className="flex-[2] py-2.5 rounded-xl bg-gold-primary text-black hover:bg-gold-primary/90 transition-all text-[10px] font-black flex items-center justify-center gap-1.5 shadow-lg uppercase tracking-widest"
                 >
                    <Bell size={12} /> إرسال تذكير للجميع
                 </button>
                 <button onClick={() => onEdit(meeting)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-[10px] font-black flex items-center justify-center gap-1.5 border border-white/5 uppercase tracking-widest"><Pencil size={12} /> تعديل</button>
                 <button onClick={() => onDelete(meeting.id)} className="flex-1 py-2.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all text-[10px] font-black flex items-center justify-center gap-1.5 border border-rose-500/10 uppercase tracking-widest"><Trash2 size={12} /> حذف</button>
              </div>
           )}
        </div>
     </article>

  );
}
