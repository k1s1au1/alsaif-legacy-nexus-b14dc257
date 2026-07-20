import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, useCallback, useMemo, useRef } from "react";
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
  Calendar,
  Users,
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
import { FamilySharing } from "@/lib/native-bridge";
import { OfflineCache } from "@/lib/offline-cache";
import { FileText, Download } from "lucide-react";

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
  minutes: string | null;
};
type Attendee = { meeting_id: string; user_id: string; rsvp: Rsvp; companions_count?: number };
type ProfileLite = {
  id: string;
  arabic_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

function formatDate(iso: string) {
  if (!iso) return { day: "", month: "", weekday: "", time: "", year: "" };
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { day: "??", month: "??", weekday: "??", time: "??", year: "????" };
    return {
      day: d.getDate(),
      month: d.toLocaleString("ar-SA", { month: "long" }),
      weekday: d.toLocaleString("ar-SA", { weekday: "long" }),
      time: d.toLocaleString("ar-SA", { hour: "numeric", minute: "2-digit" }),
      year: d.getFullYear(),
    };
  } catch (e) {
    console.error("formatDate error", e);
    return { day: "??", month: "??", weekday: "??", time: "??", year: "????" };
  }
}

function MeetingsPage() {
  const [profile, setProfile] = useState({
    name: "عضو العائلة",
    role: "عضو",
    initial: "ص",
    avatarPath: null as string | null,
  });
  const {
    userId,
    isLoading: rolesLoading,
    canManage: canManageSection,
    primaryRole,
    isAdmin,
    isChairman,
  } = useUserRole();
  const dynamicLogo = useSiteLogo();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [savingRsvp, setSavingRsvp] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [showMinutes, setShowMinutes] = useState<Meeting | null>(null);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // form fields
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [fLocationUrl, setFLocationUrl] = useState("");
  const [fWhen, setFWhen] = useState("");
  const [fDuration, setFDuration] = useState("");
  const [fMinutes, setFMinutes] = useState("");

  const canManage = canManageSection("meetings");
  const carouselPlugin = useRef(Autoplay({ delay: 5000, stopOnInteraction: true }));
  const carouselPlugins = useMemo(() => [carouselPlugin.current], []);

  const resetForm = useCallback(() => {
    setFTitle("");
    setFDesc("");
    setFLocation("");
    setFLocationUrl("");
    setFWhen("");
    setFDuration("");
    setFMinutes("");
    setEditing(null);
  }, []);

  const loadAll = useCallback(async () => {
    const cached = OfflineCache.load("meetings");
    if (cached) setMeetings(cached);

    setLoading(true);
    try {
      const [{ data: m }, { data: a }, { data: pr }] = await Promise.all([
        supabase.from("meetings").select("*").order("scheduled_at", { ascending: true }),
        supabase.from("meeting_attendees").select("*"),
        supabase.from("profiles").select("id, arabic_name, full_name, avatar_url"),
      ]);

      setMeetings((m ?? []) as Meeting[]);
      OfflineCache.save("meetings", m);
      setAttendees((a ?? []) as Attendee[]);
      const map: Record<string, ProfileLite> = {};
      (pr ?? []).forEach((p: any) => {
        if (p?.id) map[p.id] = p;
      });
      setProfiles(map);
    } catch (err) {
      console.error("Meetings load error:", err);
      toast.error("فشل في تحميل بيانات الاجتماعات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (userId) {
        try {
          const [{ data: p }, { data: r }] = await Promise.all([
            supabase
              .from("profiles")
              .select("arabic_name, full_name, avatar_url")
              .eq("id", userId)
              .maybeSingle(),
            supabase.from("user_roles").select("role").eq("user_id", userId),
          ]);
          const rs = (r ?? []).map((x) => x.role);
          setProfile({
            name: p?.arabic_name || p?.full_name || "عضو العائلة",
            role: rs.includes("admin")
              ? "المسؤول التقني"
              : rs.includes("chairman")
                ? "رئيس المجلس"
                : "عضو",
            initial: "ع",
            avatarPath: p?.avatar_url || null,
          });
        } catch (err) {
          console.warn("Profile fetch error in meetings:", err);
        }
      }
      await loadAll();
    })();

    const channel = supabase
      .channel("meetings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_attendees" }, () =>
        loadAll(),
      )
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
    setFWhen(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
    );
    setFDuration(m.duration_minutes ? String(m.duration_minutes) : "");
    setFMinutes(m.minutes ?? "");
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
      minutes: fMinutes.trim() || null,
    };
    try {
      if (editing) {
        const { error } = await supabase.from("meetings").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("تم التحديث");
      } else {
        const { error } = await supabase.from("meetings").insert({ ...payload, created_by: userId });
        if (error) throw error;
        toast.success("تم الإنشاء");
      }
      setShowForm(false);
      resetForm();
      loadAll();
    } catch (err: any) {
      toast.error("حدث خطأ أثناء الحفظ");
    } finally {
      setSubmitting(false);
    }
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
    const current = attendees.find((a) => a.meeting_id === meetingId && a.user_id === userId);
    const isRemoving = current?.rsvp === rsvp && current?.companions_count === companionsCount;

    setSavingRsvp(meetingId);

    // Optimistic update
    setAttendees((prev) => {
      const without = prev.filter((a) => !(a.meeting_id === meetingId && a.user_id === userId));
      return isRemoving
        ? without
        : [
            ...without,
            { meeting_id: meetingId, user_id: userId, rsvp, companions_count: companionsCount },
          ];
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
            .upsert(
              { meeting_id: meetingId, user_id: userId, rsvp },
              { onConflict: "meeting_id,user_id" },
            );
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
          category: "MEETING_INVITE",
          data: { meeting_id: m.id }
        },
      });
      toast.dismiss();
      toast.success("تم إرسال التذكير لجميع أفراد العائلة بنجاح ✨");
    } catch (err) {
      toast.dismiss();
      toast.error("فشل إرسال التذكير");
    }
  };

  const upcoming = (meetings || []).filter((m) => m && m.scheduled_at && new Date(m.scheduled_at) >= new Date());
  const past = (meetings || []).filter((m) => m && m.scheduled_at && new Date(m.scheduled_at) < new Date());

  const myRsvp = (meetingId: string): Rsvp | null => {
    if (!userId) return null;
    return (attendees || []).find((a) => a.meeting_id === meetingId && a.user_id === userId)?.rsvp ?? null;
  };

  const myCompanions = (meetingId: string): number => {
    if (!userId) return 0;
    return (
      (attendees || []).find((a) => a.meeting_id === meetingId && a.user_id === userId)?.companions_count ??
      0
    );
  };

  const carouselOpts = useMemo(
    () => ({ loop: upcoming.length > 1, direction: "rtl" as const }),
    [upcoming.length],
  );

  return (
    <AppShell title="الاجتماعات" user={profile}>
      <div className="max-w-6xl mx-auto space-y-8 pb-24 px-4 md:px-0" dir="rtl">
        <QuickActionsBanner />

        {/* Compact Header */}
        <section className="animate-fade-up">
          <div className="relative overflow-hidden rounded-[28px] md:rounded-[36px] bg-gradient-to-br from-primary via-[#1a2b3c] to-black p-6 md:p-8 text-white shadow-xl border border-white/5">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-15 pointer-events-none hidden md:block">
              <div
                className="size-24 md:size-40 logo-alsaif-banner"
                style={{ "--logo-url": dynamicLogo ? `url(${dynamicLogo})` : "none" } as any}
              />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2 text-center md:text-right">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <div className="h-0.5 w-8 bg-gold-primary" />
                  <CalendarDays className="size-3 text-gold-primary md:hidden" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold-primary">
                    ملتقى العائلة
                  </span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black tracking-tight">الاجتماعات</h2>
                <p className="text-white/60 font-bold text-xs md:text-sm max-w-md">
                  جدول اللقاءات العائلية والنقاشات.
                </p>
              </div>
              {canManage && (
                <button
                  onClick={openCreate}
                  className="btn-gold px-6 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-xl text-sm font-black self-center md:self-auto shrink-0 active:scale-95 transition-all"
                >
                  <Plus size={18} strokeWidth={3} />
                  <span>إضافة اجتماع</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Meeting List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-40">
            <div className="size-12 rounded-full border-4 border-primary/20 border-t-gold-primary animate-spin" />
            <p className="font-black text-primary uppercase tracking-widest text-xs">
              جاري التحميل...
            </p>
          </div>
        ) : (
          <div className="animate-fade-up">
            {upcoming.length === 0 ? (
              <div className="card-surface p-16 flex flex-col items-center text-center gap-4 border-dashed border-2 opacity-60 rounded-[32px] bg-muted/20">
                <CalendarDays size={48} className="text-muted-foreground opacity-40" />
                <p className="text-lg font-black text-primary">لا توجد اجتماعات مجدولة</p>
              </div>
            ) : (
              <Carousel
                plugins={carouselPlugins}
                className="w-full"
                opts={carouselOpts}
              >
                <CarouselContent>
                  {(upcoming || []).map((m) => (
                    <CarouselItem key={m.id} className="pl-0">
                      <MeetingInteractiveCard
                        meeting={m}
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
                  <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 right-4 flex-col gap-3 z-30">
                    <CarouselPrevious className="static translate-x-0 translate-y-0 bg-black/20 backdrop-blur-md border-white/10 text-white hover:bg-gold-primary hover:text-black transition-all size-12 shadow-2xl" />
                    <CarouselNext className="static translate-x-0 translate-y-0 bg-black/20 backdrop-blur-md border-white/10 text-white hover:bg-gold-primary hover:text-black transition-all size-12 shadow-2xl" />
                  </div>
                )}
              </Carousel>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showMinutes && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card border border-border rounded-[40px] w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
              dir="rtl"
            >
              <div className="p-8 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-primary">{showMinutes.title}</h3>
                  <p className="text-xs font-bold text-muted-foreground">
                    محضر اجتماع {formatDate(showMinutes.scheduled_at).day}{" "}
                    {formatDate(showMinutes.scheduled_at).month}{" "}
                    {formatDate(showMinutes.scheduled_at).year}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="size-11 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all"
                  >
                    <Download size={20} />
                  </button>
                  <button
                    onClick={() => setShowMinutes(null)}
                    className="size-11 rounded-full bg-muted flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="p-8 md:p-12 overflow-y-auto custom-scrollbar flex-1 prose dark:prose-invert max-w-none">
                <div className="bg-primary/5 p-8 rounded-[32px] border border-primary/10 shadow-inner min-h-[300px]">
                  <p className="text-lg font-bold text-foreground leading-relaxed whitespace-pre-wrap">
                    {showMinutes.minutes}
                  </p>
                </div>
              </div>
              <div className="p-6 bg-muted/10 border-t border-border text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  أرشيف مجلس السيف الرقمي — {new Date().getFullYear()}م
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                  <h3 className="text-3xl font-black tracking-tight text-primary">
                    {editing ? "تعديل اللقاء" : "جدولة لقاء عائلي"}
                  </h3>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="size-12 rounded-full bg-muted/50 flex items-center justify-center hover:bg-primary hover:text-white transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={submitForm} className="space-y-6">
                <div className="grid gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">
                      عنوان الاجتماع
                    </label>
                    <input
                      value={fTitle}
                      onChange={(e) => setFTitle(e.target.value)}
                      required
                      placeholder="مثال: اجتماع العائلة السنوي"
                      className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">
                      وصف موجز
                    </label>
                    <textarea
                      value={fDesc}
                      onChange={(e) => setFDesc(e.target.value)}
                      rows={3}
                      placeholder="ماذا سنناقش في هذا اللقاء؟"
                      className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">
                        موعد اللقاء
                      </label>
                      <input
                        type="datetime-local"
                        value={fWhen}
                        onChange={(e) => setFWhen(e.target.value)}
                        required
                        className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">
                        المدة التقريبية (دقيقة)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={fDuration}
                        onChange={(e) => setFDuration(e.target.value)}
                        placeholder="60"
                        className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">
                      مكان الاجتماع / الرابط
                    </label>
                    <input
                      value={fLocation}
                      onChange={(e) => setFLocation(e.target.value)}
                      placeholder="مثال: مجلس العائلة"
                      className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm mb-3"
                    />
                    <input
                      type="url"
                      value={fLocationUrl}
                      onChange={(e) => setFLocationUrl(e.target.value)}
                      placeholder="رابط الموقع على الخريطة"
                      className="w-full bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                    />
                  </div>

                  {editing && (
                    <div className="space-y-2">
                      <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">
                        محضر الاجتماع (القرارات والنتائج)
                      </label>
                      <textarea
                        value={fMinutes}
                        onChange={(e) => setFMinutes(e.target.value)}
                        rows={6}
                        placeholder="اكتب هنا ما تم الاتفاق عليه والقرارات التي اتخذت..."
                        className="w-full bg-muted/30 border border-border rounded-[24px] px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm resize-none custom-scrollbar"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 btn-gold py-5 rounded-[28px] text-lg font-black shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {submitting ? (
                      <div className="size-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    ) : (
                      <span>{editing ? "حفظ التعديلات" : "تأكيد الجدولة"}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-10 py-5 rounded-[28px] bg-muted/50 font-black text-muted-foreground hover:bg-muted transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function MeetingInteractiveCard({
  meeting,
  attendeesList = [],
  profiles = {},
  myRsvp,
  myCompanions,
  onRsvp,
  canManage,
  onEdit,
  onDelete,
  saving,
  ready,
  dynamicLogo,
  userId,
  onRemind,
}: any) {
  const date = formatDate(meeting?.scheduled_at);
  const going = (attendeesList || [])
    .filter((a: any) => a.rsvp === "going")
    .map((a: any) => profiles[a.user_id])
    .filter(Boolean);
  const [compCount, setCompCount] = useState(myCompanions || 0);
  const [activeTab, setActiveTab] = useState<"info" | "rsvp">("info");

  useEffect(() => {
    setCompCount(myCompanions || 0);
  }, [myCompanions]);

  const totalGoingCount = (attendeesList || [])
    .filter((a: any) => a.rsvp === "going")
    .reduce((acc: number, cur: any) => acc + 1 + (cur.companions_count || 0), 0);

  if (!meeting) return null;

  return (
    <div className="flex flex-col gap-4">
      <article
        className={cn(
          "relative overflow-hidden rounded-[48px] md:rounded-[56px] text-white flex flex-col md:flex-row border-4 border-white/5 shadow-2xl transition-all duration-700",
          myRsvp === "going" ? "bg-emerald-950" : myRsvp === "not_going" ? "bg-rose-950" : "bg-[#051410]",
          "min-h-[580px] md:min-h-[600px]"
        )}
      >
        {/* Universal Background Decorations (Mobile & Desktop) */}
        <div className="absolute inset-0 z-0 overflow-hidden">
           <div className="absolute top-0 right-0 p-8 md:p-16 opacity-[0.04] pointer-events-none -rotate-12">
             <Calendar size={400} strokeWidth={0.5} className="md:size-[600px]" />
           </div>
           <div
             className="absolute bottom-[-5%] left-[-5%] size-[70%] md:size-[50%] opacity-[0.05] pointer-events-none logo-alsaif-banner"
             style={{ "--logo-url": dynamicLogo ? `url(${dynamicLogo})` : "none" } as any}
           />
        </div>

        {/* Floating Date Stamp - Mobile & Desktop Positioned Smartly */}
        <div className="absolute top-6 left-6 md:top-10 md:right-10 z-20 flex flex-col items-center">
           <div className="bg-gold-primary/20 backdrop-blur-xl border-2 border-gold-primary/40 rounded-[24px] md:rounded-[32px] p-3 md:p-5 min-w-[70px] md:min-w-[110px] text-center shadow-2xl scale-90 sm:scale-100 transition-transform hover:scale-110 duration-500">
              <p className="text-[9px] md:text-sm font-black text-gold-primary uppercase tracking-widest mb-1">{date.month}</p>
              <p className="text-3xl md:text-6xl font-black text-white leading-none">{date.day}</p>
              <div className="h-0.5 w-5 md:w-10 bg-gold-primary/40 mx-auto my-1 md:my-2" />
              <p className="text-[8px] md:text-xs font-bold text-white/60">{date.weekday}</p>
           </div>
        </div>

        {/* Mobile Modern Navigation - Floating at bottom */}
        <div className="md:hidden absolute bottom-6 left-6 right-6 z-50 flex p-1.5 bg-black/60 backdrop-blur-3xl rounded-[28px] border border-white/10 shadow-2xl">
          <button
            onClick={() => setActiveTab("info")}
            className={cn(
              "flex-1 py-3.5 rounded-[22px] text-xs font-black transition-all duration-500 flex items-center justify-center gap-2",
              activeTab === "info" ? "bg-gold-primary text-emerald-950 shadow-xl scale-[1.02]" : "text-white/40"
            )}
          >
            <HelpCircle size={14} /> تفاصيل اللقاء
          </button>
          <button
            onClick={() => setActiveTab("rsvp")}
            className={cn(
              "flex-1 py-3.5 rounded-[22px] text-xs font-black transition-all duration-500 flex items-center justify-center gap-2",
              activeTab === "rsvp" ? "bg-gold-primary text-emerald-950 shadow-xl scale-[1.02]" : "text-white/40"
            )}
          >
            <UserCheck size={14} /> الحضور ({totalGoingCount})
          </button>
        </div>


        {/* CONTENT PANE (Adaptive) */}
        <AnimatePresence mode="wait">
          {/* INFO VIEW */}
          {(activeTab === "info" || (typeof window !== 'undefined' && window.innerWidth >= 768)) && (
            <motion.div
              key="info-mobile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className={cn(
                "flex-1 p-8 md:p-14 flex flex-col justify-start md:justify-between space-y-10 relative z-10 h-full pb-32 md:pb-14",
                activeTab === "info" ? "flex" : "hidden md:flex"
              )}
            >
               <div className="space-y-8 pt-4 md:pt-32">
                  <div className="space-y-4 max-w-[75%] md:max-w-none pr-2">
                     <div className="flex flex-wrap items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-gold-primary/20 text-gold-primary border border-gold-primary/30 text-[9px] font-black uppercase tracking-widest backdrop-blur-md">مناسبة رسمية</span>
                        <span className="px-3 py-1 rounded-full bg-white/5 text-white/60 border border-white/10 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                           <Clock size={12} /> {meeting.duration_minutes || 60} د
                        </span>
                     </div>
                     <h2 className="text-2xl md:text-7xl font-black text-white tracking-tighter leading-tight drop-shadow-2xl line-clamp-2 md:line-clamp-none">{meeting.title}</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
                     <div className="space-y-4">
                        <div className="flex items-center gap-3 text-gold-primary font-black uppercase tracking-[0.3em] text-[10px]">
                           <HelpCircle size={16} /> أجندة اللقاء
                        </div>
                        <p className="text-base md:text-2xl font-medium text-white/80 leading-relaxed border-r-4 border-gold-primary/30 pr-6 line-clamp-3 md:line-clamp-none">
                           {meeting.description || "نتطلع للقائكم في رحاب المجلس."}
                        </p>
                     </div>

                     <div className="space-y-6">
                        <div className="flex items-center gap-3 text-gold-primary font-black uppercase tracking-[0.3em] text-[10px]">
                           <MapPin size={16} /> الموقع
                        </div>
                        <div className="flex items-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-sm">
                           <div className="size-12 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary shadow-xl shrink-0"><MapPin size={24} /></div>
                           <p className="text-sm md:text-xl font-black text-white truncate">{meeting.location || "مجلس العائلة"}</p>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Action Buttons for Info View */}
               <div className="pt-4 flex items-center gap-3">
                  <button
                    onClick={() => addToCalendar({ title: meeting.title, description: meeting.description || "", location: meeting.location || "", startTime: meeting.scheduled_at })}
                    className="flex-1 flex items-center justify-center gap-3 h-14 rounded-2xl bg-white/10 text-white font-black text-xs hover:bg-white/20 transition-all border border-white/10"
                  >
                    <CalendarDays size={18} /> التقويم
                  </button>
                  {canManage && (
                    <>
                      <button
                        onClick={() => onRemind(meeting)}
                        title="إرسال تذكير للجميع"
                        className="size-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center hover:bg-amber-500/20 transition-all border border-amber-500/20"
                      >
                        <Bell size={20} />
                      </button>
                      <button onClick={() => onEdit(meeting)} className="size-14 rounded-2xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all border border-white/10">
                        <Pencil size={20} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => FamilySharing.shareInvitation({ title: meeting.title, date: `${date.weekday} ${date.day} ${date.month}`, location: meeting.location || "المجلس" })}
                    className="size-14 rounded-2xl bg-gold-primary text-emerald-950 flex items-center justify-center shadow-xl active:scale-95 transition-all"
                  >
                    <Share2 size={20} />
                  </button>
               </div>
            </motion.div>
          )}

          {/* RSVP VIEW */}
          {(activeTab === "rsvp" || (typeof window !== 'undefined' && window.innerWidth >= 768)) && (
            <motion.div
              key="rsvp-mobile"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "md:w-1/3 p-8 md:p-14 flex flex-col justify-between space-y-10 relative z-10 shrink-0 h-full pb-32 md:pb-14",
                activeTab === "rsvp" ? "flex" : "hidden md:flex"
              )}
            >
               <div className="space-y-8">
                  <div className="space-y-4">
                     <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold-primary/10 border border-gold-primary/20">
                        <Timer size={14} className="text-gold-primary animate-pulse" />
                        <span className="text-[10px] font-black text-gold-primary uppercase tracking-widest">التواجد</span>
                     </div>
                     <h3 className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tight">هل ستشرفنا بالحضور؟</h3>
                  </div>

                  <div className="space-y-6">
                     {myRsvp === "going" && (
                       <div className="flex flex-col gap-3 animate-fade-up bg-white/10 p-6 rounded-[32px] border border-white/10 shadow-inner">
                         <div className="flex items-center justify-between px-1">
                           <p className="text-[10px] font-black text-gold-primary uppercase tracking-widest">عدد المرافقين؟</p>
                           <span className="text-[12px] font-black text-white bg-white/10 px-3 py-1 rounded-lg">المجموع: {1 + compCount}</span>
                         </div>
                         <input
                           type="tel"
                           value={compCount === 0 ? "" : compCount}
                           onFocus={(e) => e.target.select()}
                           onChange={(e) => {
                             const val = e.target.value.replace(/[^0-9]/g, "");
                             setCompCount(val === "" ? 0 : parseInt(val));
                           }}
                           onBlur={() => onRsvp(meeting.id, "going", compCount)}
                           className="w-full h-16 bg-black/20 border-2 border-white/10 rounded-[24px] px-6 font-black text-center text-3xl focus:outline-none focus:border-gold-primary transition-all text-white"
                           placeholder="٠"
                         />
                       </div>
                     )}

                     <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 p-2 rounded-[32px] grid grid-cols-2 gap-2 shadow-2xl h-[80px]">
                        <div
                          className={cn(
                            "absolute inset-y-2 w-[calc(50%-12px)] rounded-[26px] transition-all duration-500 shadow-lg",
                            myRsvp === "going" ? "right-2 bg-emerald-500 shadow-emerald-500/40" :
                            myRsvp === "not_going" ? "right-[calc(50%+4px)] bg-rose-500 shadow-rose-500/40" : "opacity-0"
                          )}
                        />
                        <button
                          onClick={() => onRsvp(meeting.id, "going", compCount)}
                          className={cn(
                            "relative z-10 flex items-center justify-center gap-3 font-black text-sm transition-colors duration-500",
                            myRsvp === "going" ? "text-white" : "text-white/30"
                          )}
                        >
                          <UserCheck size={22} /> سأحضر
                        </button>
                        <button
                          onClick={() => onRsvp(meeting.id, "not_going")}
                          className={cn(
                            "relative z-10 flex items-center justify-center gap-3 font-black text-sm transition-colors duration-500",
                            myRsvp === "not_going" ? "text-white" : "text-white/30"
                          )}
                        >
                          <UserX size={22} /> أعتذر
                        </button>
                     </div>
                  </div>

                  <div className="space-y-4 pt-8 border-t border-white/10">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gold-primary font-black uppercase tracking-[0.2em] text-[10px]">
                           <Users size={14} /> الحضور المؤكد
                        </div>
                        <span className="text-[10px] font-black bg-white/10 text-white px-3 py-1 rounded-full">{totalGoingCount} حاضر</span>
                     </div>
                     <div className="flex flex-wrap gap-2">
                        {(going || []).slice(0, 8).map((p: any) => (
                          <div key={p.id} className="size-11 rounded-2xl ring-2 ring-white/10 overflow-hidden shadow-lg border-2 border-emerald-950">
                             <UserAvatar path={p.avatar_url} name={p.arabic_name} className="size-full" userId={p.id} />
                          </div>
                        ))}
                        {going.length > 8 && (
                          <div className="size-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-white">+{going.length - 8}</div>
                        )}
                     </div>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </article>
    </div>
  );
}
