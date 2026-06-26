import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  CalendarDays,
  MapPin,
  Clock,
  Users,
  X,
  Trash2,
  Pencil,
  Plus,
  ChevronLeft,
  UserCheck,
  UserX,
  HelpCircle,
  Timer,
  Navigation,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
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

import { sendFcmNotification } from "@/lib/fcm";

export const Route = createFileRoute("/_authenticated/meetings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "المناسبات العائلية — السيف" },
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
type Attendee = { meeting_id: string; user_id: string; rsvp: Rsvp };
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
  const { userId, isLoading: rolesLoading, canManage: canManageSection, primaryRole } = useUserRole();
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

        sendFcmNotification({
          data: {
            title: "📅 اجتماع عائلي جديد",
            body: fTitle.trim(),
          }
        }).catch(err => console.warn("FCM error:", err));

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

  const setRsvp = async (meetingId: string, rsvp: Rsvp) => {
    if (!userId || savingRsvp === meetingId) return;

    const prevAttendees = [...attendees];
    const current = attendees.find(a => a.meeting_id === meetingId && a.user_id === userId);
    const isRemoving = current?.rsvp === rsvp;

    setSavingRsvp(meetingId);

    // Optimistic Update: Update UI immediately to prevent flickering
    if (isRemoving) {
      setAttendees(prev => prev.filter(a => !(a.meeting_id === meetingId && a.user_id === userId)));
    } else {
      const newEntry = { meeting_id: meetingId, user_id: userId, rsvp };
      setAttendees(prev => [...prev.filter(a => !(a.meeting_id === meetingId && a.user_id === userId)), newEntry]);
    }

    try {
      // Step 1: Always clear existing attendance for this meeting
      await supabase.from("meeting_attendees").delete().eq("meeting_id", meetingId).eq("user_id", userId);

      if (!isRemoving) {
        // Step 2: Insert new RSVP status
        const { error } = await supabase.from("meeting_attendees").insert({ meeting_id: meetingId, user_id: userId, rsvp });
        if (error) throw error;
        toast.success(rsvp === 'going' ? "ننتظر تشريفك!" : "تم التحديث");
      } else {
        toast.success("تم الإلغاء");
      }
    } catch (error) {
      console.error("Meeting RSVP error:", error);
      toast.error("تعذر تحديث حالة الحضور");
      setAttendees(prevAttendees); // Rollback on failure
    } finally {
      setSavingRsvp(null);
      // Realtime subscription will sync any other background changes
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

  return (
    <AppShell title="الاجتماعات" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-24 px-4 md:px-0" dir="rtl">
        <QuickActionsBanner />

        {/* Alsaif Meetings Header — Banner Style */}
        <section className="animate-fade-up">
          <div className="relative overflow-hidden rounded-[32px] md:rounded-[48px] bg-gradient-to-br from-primary via-[#1a2b3c] to-black p-6 md:p-12 text-white shadow-2xl border border-white/5 group">
            {/* Left Decorative Logo */}
            <div className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none z-1 transition-transform duration-1000 group-hover:scale-110 group-hover:opacity-40">
              <div
                className="size-28 md:size-64 logo-alsaif-banner"
                style={{ "--logo-url": `url(${dynamicLogo || alsaifMark?.url || ""})` } as any}
              />
            </div>

            <div className="absolute top-0 right-0 size-64 bg-gold-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
              <div className="space-y-3 md:space-y-5 text-center md:text-right">
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <div className="h-0.5 w-8 md:w-12 bg-gold-primary shadow-[0_0_10px_rgba(212,175,55,0.6)]" />
                  <span className="text-[9px] md:text-xs font-black uppercase tracking-[0.4em] text-gold-primary">
                    ملتقى العائلة
                  </span>
                </div>
                <h2 className="text-3xl md:text-6xl font-black tracking-tighter leading-tight drop-shadow-2xl">
                  الاجتماعات
                </h2>
                <p className="text-white/60 font-bold text-sm md:text-xl max-w-xl">
                  جدول اللقاءات العائلية القادمة لتعزيز الترابط والتواصل.
                </p>
              </div>

              {canManage && (
                <button
                  onClick={openCreate}
                  className="btn-gold relative px-8 py-4 md:px-12 md:py-6 rounded-2xl md:rounded-[32px] flex items-center justify-center gap-3 shadow-2xl shadow-gold-primary/30 text-sm md:text-xl font-black group/btn self-center md:self-auto shrink-0 active:scale-95 transition-all"
                >
                  <Plus className="size-5 md:size-7 group-hover:rotate-90 transition-transform duration-500" strokeWidth={3} />
                  <span>إضافة مناسبة</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-40">
             <div className="size-16 rounded-full border-4 border-primary/20 border-t-gold-primary animate-spin" />
             <p className="font-black text-primary uppercase tracking-widest text-xs">جاري تجهيز المجلس...</p>
          </div>
        ) : (
          <div className="space-y-20">
            <section className="space-y-8 animate-fade-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-primary font-black uppercase tracking-widest text-xs">
                   <Timer className="size-4 text-gold-primary" /> أهم المناسبات القادمة
                </div>
              </div>

              {upcoming.length === 0 ? (
                <div className="card-surface p-24 flex flex-col items-center text-center gap-8 border-dashed border-4 opacity-40 rounded-[56px] bg-muted/20">
                   <CalendarDays size={64} className="text-muted-foreground opacity-20" />
                   <p className="text-2xl font-black text-primary">لا توجد اجتماعات مجدولة حالياً</p>
                </div>
              ) : (
                <Carousel
                  plugins={[plugin.current]}
                  className="w-full touch-pan-y"
                  onMouseEnter={plugin.current.stop}
                  onMouseLeave={plugin.current.reset}
                  opts={{ direction: 'rtl', loop: true, watchDrag: true }}
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
                          onRsvp={setRsvp}
                          canManage={canManage}
                          onEdit={openEdit}
                          onDelete={deleteMeeting}
                          saving={savingRsvp === m.id}
                          ready={!rolesLoading && !!userId}
                          dynamicLogo={dynamicLogo}
                        />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <div className="hidden md:block">
                    <CarouselPrevious className="right-4 bg-white/20 border-white/40 text-white hover:bg-gold-primary hover:text-black" />
                    <CarouselNext className="left-4 bg-white/20 border-white/40 text-white hover:bg-gold-primary hover:text-black" />
                  </div>
                </Carousel>
              )}
            </section>

            {past.length > 0 && (
              <section className="space-y-8 animate-fade-up">
                <div className="flex items-center gap-4 opacity-50">
                   <Clock className="size-4" />
                   <h3 className="text-xs font-black uppercase tracking-[0.4em] whitespace-nowrap text-primary">الأرشيف والسجل</h3>
                   <div className="h-px flex-1 bg-gradient-to-l from-border to-transparent" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {past.map((m) => (
                    <div key={m.id} className="card-surface p-6 flex items-center justify-between opacity-60 hover:opacity-100 transition-all hover:bg-muted group rounded-[32px]">
                       <div className="flex items-center gap-6">
                          <div className="size-14 rounded-2xl bg-muted flex flex-col items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                             <span className="text-[10px] font-black uppercase tracking-tighter">{formatDate(m.scheduled_at).month}</span>
                             <span className="text-2xl font-black tracking-tighter leading-none">{formatDate(m.scheduled_at).day}</span>
                          </div>
                          <div>
                             <h4 className="font-black text-lg text-primary">{m.title}</h4>
                             <p className="text-xs font-bold text-muted-foreground">{formatDate(m.scheduled_at).year}</p>
                          </div>
                       </div>
                       <ChevronLeft className="opacity-20 group-hover:opacity-100 group-hover:-translate-x-2 transition-all" />
                    </div>
                  ))}
                </div>
              </section>
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
                       <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} required placeholder="مثال: اجتماع العائلة السنوي" className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-lg focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm" />
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

function MeetingInteractiveCard({ meeting, counts, attendeesList, profiles, myRsvp, onRsvp, canManage, onEdit, onDelete, saving, ready, dynamicLogo }: any) {
  const date = formatDate(meeting.scheduled_at);
  const going = attendeesList.filter((a: any) => a.rsvp === 'going').map((a: any) => profiles[a.user_id]).filter(Boolean);

  return (
    <article className={cn(
      "relative min-h-[420px] md:min-h-[500px] overflow-hidden rounded-[40px] md:rounded-[60px] text-white p-6 md:p-16 flex flex-col justify-between group cursor-grab active:cursor-grabbing border-2 md:border-4 border-white/5 shadow-2xl mx-1 md:mx-0 transition-all duration-700",
      myRsvp === 'going' ? "bg-emerald-950" : myRsvp === 'not_going' ? "bg-rose-950" : "bg-primary"
    )}>
       <div className={cn(
         "absolute inset-0 transition-opacity duration-700 z-0",
         myRsvp === 'going' ? "bg-gradient-to-br from-emerald-900 via-emerald-950 to-black" :
         myRsvp === 'not_going' ? "bg-gradient-to-br from-rose-900 via-rose-950 to-black" :
         "bg-gradient-to-br from-primary via-[#1a2b3c] to-black"
       )} />
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none scale-[1.5] md:scale-[2.5] logo-alsaif-banner z-1" style={{ '--logo-url': `url(${dynamicLogo || alsaifMark.url})` } as any} />
       <div className="absolute -top-40 -right-40 size-[300px] md:size-[500px] bg-gold-primary/10 rounded-full blur-[100px] pointer-events-none group-hover:scale-110 transition-transform duration-1000" />

       <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-4 md:gap-8 w-full">
          <div className="space-y-2 md:space-y-4">
             <div className="flex items-center gap-2 md:gap-3">
                <span className="px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[8px] md:text-[10px] font-black uppercase tracking-widest shadow-xl backdrop-blur-md">مناسبة قادمة</span>
                <span className="px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-white/5 text-white/60 border border-white/10 text-[8px] md:text-[10px] font-black uppercase tracking-widest backdrop-blur-md flex items-center gap-1 md:gap-2">
                   <Clock className="size-2.5 md:size-3" /> {meeting.duration_minutes || "—"} دقيقة
                </span>
             </div>
             <h3 className="text-3xl md:text-7xl font-black tracking-tighter leading-tight drop-shadow-2xl">{meeting.title}</h3>
          </div>

          <div className="flex flex-row md:flex-col md:items-end items-center justify-between md:justify-start w-full md:w-auto gap-3 md:gap-4 shrink-0">
             <div className="text-right">
                <span className="text-gold-primary font-black uppercase tracking-[0.4em] text-[8px] md:text-[10px] mb-0.5 md:mb-1 block">{date.weekday}</span>
                <div className="flex items-baseline gap-1.5 md:block">
                   <span className="text-4xl md:text-9xl font-black tracking-tighter text-white leading-none block">{date.day}</span>
                   <span className="text-base md:text-3xl font-black text-white/30 uppercase tracking-widest md:-mt-4 block">{date.month}</span>
                </div>
             </div>

             {/* Countdown Days - Now always visible */}
             {new Date(meeting.scheduled_at).getTime() > new Date().getTime() && (
               <div className="flex flex-col items-center justify-center p-2 md:p-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl md:rounded-2xl min-w-[80px] md:min-w-[120px]">
                  <Timer className="size-4 md:size-6 text-gold-primary animate-pulse mb-0.5 md:mb-1" />
                  <div className="text-center">
                    <span className="text-lg md:text-3xl font-black text-white leading-none block">
                      {Math.ceil((new Date(meeting.scheduled_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}
                    </span>
                    <span className="text-[7px] md:text-[10px] font-black uppercase tracking-widest text-white/40 block mt-0.5">أيام متبقية</span>
                  </div>
               </div>
             )}
          </div>
       </div>

       <div className="relative z-10 flex flex-col md:flex-row items-end justify-between gap-6 md:gap-10 w-full mt-6 md:mt-10">
          <div className="space-y-6 md:space-y-8 flex-1 w-full">
             <p className="text-base md:text-xl font-bold text-white/70 max-w-2xl leading-relaxed border-r-4 border-gold-primary/20 pr-4 md:pr-8">{meeting.description || "لا يوجد وصف لهذه المناسبة."}</p>

             <div className="flex flex-wrap items-center gap-4 md:gap-10">
                {meeting.location && (
                  <div className="flex items-center gap-3 md:gap-4 group/loc">
                     <div className="size-10 md:size-14 rounded-xl md:rounded-[24px] bg-white/5 flex items-center justify-center text-gold-primary border border-white/10 shadow-2xl group-hover/loc:bg-gold-primary group-hover/loc:text-black transition-all duration-500">
                        <MapPin className="size-5 md:size-6" />
                     </div>
                     <div className="space-y-0.5 md:space-y-1">
                        <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-white/30">موقع اللقاء</p>
                        {meeting.location_url ? (
                           <a href={meeting.location_url} target="_blank" rel="noreferrer" className="text-sm md:text-lg font-black hover:text-gold-primary underline underline-offset-8 decoration-gold-primary/20 transition-all flex items-center gap-2">{meeting.location} <Navigation size={12} className="opacity-40" /></a>
                        ) : (
                           <p className="text-sm md:text-lg font-black">{meeting.location}</p>
                        )}
                     </div>
                  </div>
                )}

                <div className="flex items-center gap-3 md:gap-4">
                   <div className="flex -space-x-3 md:-space-x-4 space-x-reverse">
                      {going.slice(0, 4).map((p: any) => (
                        <div key={p.id} className="size-8 md:size-12 rounded-lg md:rounded-[18px] border-2 md:border-4 border-primary overflow-hidden shadow-2xl transition-transform hover:-translate-y-1">
                           <UserAvatar path={p.avatar_url} name={p.arabic_name} className="size-full" userId={p.id} />
                        </div>
                      ))}
                      {going.length > 4 && (
                        <div className="size-8 md:size-12 rounded-lg md:rounded-[18px] bg-gold-primary text-black text-[8px] md:text-[10px] font-black flex items-center justify-center border-2 md:border-4 border-primary shadow-2xl">+{going.length - 4}</div>
                      )}
                   </div>
                   <div className="space-y-0.5 md:space-y-1">
                      <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-white/30">المشاركون</p>
                      <p className="text-[10px] md:text-xs font-black text-white">{counts.going} حاضر</p>
                   </div>
                </div>
             </div>
          </div>

          <div className="flex flex-col gap-3 md:gap-4 w-full md:w-auto min-w-full md:min-w-[320px]">
             <div className="relative bg-white/10 backdrop-blur-2xl border border-white/20 p-1.5 rounded-[32px] flex items-center shadow-2xl h-[64px] overflow-hidden">
                {/* Sliding Background Indicator */}
                <div className="absolute inset-1.5 flex z-0">
                  <AnimatePresence initial={false}>
                    {myRsvp && (
                      <motion.div
                        layoutId={`rsvp-active-bg-${meeting.id}`}
                        initial={false}
                        animate={{
                          x: myRsvp === 'going' ? 0 : 'calc(-100% - 4px)',
                          backgroundColor: myRsvp === 'going' ? '#10b981' : '#f43f5e'
                        }}
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                        className="h-full w-[calc(50%-2px)] rounded-[26px] shadow-lg shadow-black/20"
                        style={{ marginLeft: 'auto' }}
                      />
                    )}
                  </AnimatePresence>
                </div>

                <div className="relative z-10 flex w-full h-full">
                  <button
                    onClick={() => onRsvp(meeting.id, 'going')}
                    disabled={!ready || saving}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 md:gap-3 transition-colors duration-500 font-black text-xs md:text-sm disabled:opacity-60 disabled:cursor-not-allowed",
                      myRsvp === 'going' ? "text-white" : "text-white/40 hover:text-white"
                    )}
                  >
                    <UserCheck size={20} />
                    <span>{saving && myRsvp === 'going' ? "..." : "سأحضر"}</span>
                  </button>

                  <button
                    onClick={() => onRsvp(meeting.id, 'not_going')}
                    disabled={!ready || saving}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 md:gap-3 transition-colors duration-500 font-black text-xs md:text-sm disabled:opacity-60 disabled:cursor-not-allowed",
                      myRsvp === 'not_going' ? "text-white" : "text-white/40 hover:text-white"
                    )}
                  >
                    <UserX size={20} />
                    <span>{saving && myRsvp === 'not_going' ? "..." : "أعتذر"}</span>
                  </button>
                </div>
             </div>
             {canManage && (
                <div className="flex items-center gap-2 px-1">
                   <button onClick={() => onEdit(meeting)} className="flex-1 py-2.5 md:py-3 rounded-xl md:rounded-2xl bg-white/5 hover:bg-white/10 transition-all text-[9px] md:text-[10px] font-black flex items-center justify-center gap-2 border border-white/5 uppercase tracking-widest"><Pencil size={12} /> تعديل</button>
                   <button onClick={() => onDelete(meeting.id)} className="flex-1 py-2.5 md:py-3 rounded-xl md:rounded-2xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all text-[9px] md:text-[10px] font-black flex items-center justify-center gap-2 border border-rose-500/10 uppercase tracking-widest"><Trash2 size={12} /> حذف</button>
                </div>
             )}
          </div>
       </div>
    </article>
  );
}
