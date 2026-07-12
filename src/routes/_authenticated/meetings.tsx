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
  const carouselPlugin = useRef(Autoplay({ delay: 5000, stopOnInteraction: true }));
  const carouselPlugins = useMemo(() => [carouselPlugin.current], []);

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
    setLoading(true);
    try {
      const [{ data: m }, { data: a }, { data: pr }] = await Promise.all([
        supabase.from("meetings").select("*").order("scheduled_at", { ascending: true }),
        supabase.from("meeting_attendees").select("*"),
        supabase.from("profiles").select("id, arabic_name, full_name, avatar_url"),
      ]);

      setMeetings((m ?? []) as Meeting[]);
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

  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const carouselOpts = useMemo(
    () => ({ loop: upcoming.length > 1, direction: "rtl" as const }),
    [upcoming.length],
  );

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

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-muted/40 rounded-2xl border border-border/40">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "min-w-0 px-2 sm:px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm font-black transition-all",
                  active
                    ? "bg-primary text-white shadow-lg"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon size={14} className="shrink-0" />
                <span className="truncate">{t.label}</span>
                {typeof t.count === "number" && t.count > 0 && (
                  <span
                    className={cn(
                      "hidden sm:inline text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0",
                      active ? "bg-white/20" : "bg-muted-foreground/10",
                    )}
                  >
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
            <p className="font-black text-primary uppercase tracking-widest text-xs">
              جاري التحميل...
            </p>
          </div>
        ) : (
          <div key={tab} className="animate-fade-up">
            {tab === "upcoming" &&
              (upcoming.length === 0 ? (
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
              ))}

            {tab === "past" &&
              (past.length === 0 ? (
                <div className="card-surface p-16 flex flex-col items-center text-center gap-4 border-dashed border-2 opacity-60 rounded-[32px] bg-muted/20">
                  <Clock size={48} className="text-muted-foreground opacity-40" />
                  <p className="text-lg font-black text-primary">لا توجد اجتماعات سابقة</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {past.map((m) => (
                    <div
                      key={m.id}
                      className="card-surface p-5 flex items-center justify-between hover:bg-muted/40 transition-all group rounded-[24px]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="size-14 rounded-2xl bg-muted flex flex-col items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                          <span className="text-[10px] font-black uppercase tracking-tighter">
                            {formatDate(m.scheduled_at).month}
                          </span>
                          <span className="text-2xl font-black tracking-tighter leading-none">
                            {formatDate(m.scheduled_at).day}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-black text-base text-foreground">{m.title}</h4>
                          <p className="text-xs font-bold text-muted-foreground">
                            {formatDate(m.scheduled_at).year}
                          </p>
                        </div>
                      </div>
                      <ChevronLeft className="opacity-20 group-hover:opacity-100 group-hover:-translate-x-2 transition-all" />
                    </div>
                  ))}
                </div>
              ))}
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

  useEffect(() => {
    setCompCount(myCompanions || 0);
  }, [myCompanions]);

  const totalGoingCount = (attendeesList || [])
    .filter((a: any) => a.rsvp === "going")
    .reduce((acc: number, cur: any) => acc + 1 + (cur.companions_count || 0), 0);

  if (!meeting) return null;

  return (
    <div className="flex flex-col gap-4 md:gap-0">
      <article
        className={cn(
          "relative overflow-hidden rounded-[32px] md:rounded-[56px] text-white flex flex-col md:flex-row border border-white/10 shadow-2xl transition-all duration-700",
          myRsvp === "going" ? "bg-emerald-950" : myRsvp === "not_going" ? "bg-rose-950" : "bg-[#0a1a16]",
          "md:min-h-[600px]"
        )}
      >
        {/* Background Ornaments - Desktop Only for full banner */}
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none hidden md:block">
          <CalendarDays size={240} className="text-white" />
        </div>
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none scale-[2] logo-alsaif-banner z-0 hidden md:block"
          style={{ "--logo-url": dynamicLogo ? `url(${dynamicLogo})` : "none" } as any}
        />

        {/* TOP/LEFT SECTION (Attendance & Participants) */}
        <div className={cn(
          "md:w-1/3 p-6 md:p-14 flex flex-col justify-between space-y-8 md:space-y-10 relative z-10 shrink-0",
          "bg-white/5 backdrop-blur-md border-b md:border-b-0 md:border-l border-white/10 rounded-[32px] md:rounded-none m-2 md:m-0 shadow-xl md:shadow-none"
        )}>
          <div className="space-y-6 md:space-y-8">
             <div className="space-y-3 md:space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-primary/10 border border-gold-primary/20">
                   <Timer size={14} className="text-gold-primary animate-pulse" />
                   <span className="text-[10px] font-black text-gold-primary uppercase tracking-widest">تأكيد الحضور</span>
                </div>
                <h3 className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tight">هل ستشرفنا بالحضور؟</h3>
                <p className="text-sm font-bold text-white/50 leading-relaxed">ردك يساعدنا في إعداد الضيافة وترتيب المجلس بما يليق بكم.</p>
             </div>

             <div className="space-y-4">
                {myRsvp === "going" && (
                  <div className="flex flex-col gap-3 animate-fade-up bg-white/10 p-5 rounded-[32px] border border-white/10 shadow-inner">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[10px] font-black text-gold-primary uppercase tracking-widest">عدد المرافقين معك؟</p>
                      <span className="text-[12px] font-black text-white bg-white/10 px-3 py-1 rounded-lg">إجمالي: {1 + compCount}</span>
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
                      className="w-full h-16 bg-black/20 border-2 border-white/10 rounded-[24px] px-6 font-black text-center text-3xl focus:outline-none focus:border-gold-primary transition-all text-white shadow-inner"
                      placeholder="٠"
                    />
                  </div>
                )}

                <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 p-1.5 rounded-[28px] grid grid-cols-2 gap-1.5 shadow-2xl overflow-hidden h-[74px]">
                  <div
                    className={cn(
                      "absolute inset-y-1.5 w-[calc(50%-6px)] rounded-[22px] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-lg",
                      myRsvp === "going" ? "right-1.5 bg-emerald-500 shadow-emerald-500/40" :
                      myRsvp === "not_going" ? "right-[calc(50%+1.5px)] bg-rose-500 shadow-rose-500/40" : "opacity-0"
                    )}
                  />
                  <button
                    onClick={() => onRsvp(meeting.id, "going", compCount)}
                    disabled={!ready || saving}
                    className={cn(
                      "relative z-10 flex items-center justify-center gap-3 font-black text-sm transition-colors duration-500",
                      myRsvp === "going" ? "text-white" : "text-white/40 hover:text-white/60"
                    )}
                  >
                    {saving && myRsvp === "going" ? <Loader2 size={18} className="animate-spin" /> : <UserCheck size={22} />}
                    <span>سأحضر</span>
                  </button>
                  <button
                    onClick={() => onRsvp(meeting.id, "not_going")}
                    disabled={!ready || saving}
                    className={cn(
                      "relative z-10 flex items-center justify-center gap-3 font-black text-sm transition-colors duration-500",
                      myRsvp === "not_going" ? "text-white" : "text-white/40 hover:text-white/60"
                    )}
                  >
                    {saving && myRsvp === "not_going" ? <Loader2 size={18} className="animate-spin" /> : <UserX size={22} />}
                    <span>أعتذر</span>
                  </button>
                </div>
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
                {(going || []).slice(0, 5).map((p: any) => {
                  if (!p) return null;
                  const attendee = (attendeesList || []).find((a: any) => a.user_id === p.id);
                  const cCount = attendee?.companions_count || 0;
                  return (
                    <div key={p.id} className="relative group/avatar">
                      <div className="size-11 rounded-xl ring-2 ring-white/10 overflow-hidden shadow-lg transition-transform hover:scale-110">
                        <UserAvatar path={p.avatar_url} name={p.arabic_name} className="size-full" userId={p.id} />
                      </div>
                      {cCount > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 size-5 bg-gold-primary text-black text-[9px] font-black rounded-full flex items-center justify-center border-2 border-emerald-950 z-10">
                          +{cCount}
                        </div>
                      )}
                    </div>
                  );
                })}
                {going.length > 5 && (
                  <div className="size-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-white">+{going.length - 5}</div>
                )}
                {going.length === 0 && <p className="text-[10px] font-bold text-white/20 italic">لا يوجد حضور مؤكد بعد</p>}
             </div>
          </div>
        </div>

        {/* BOTTOM/RIGHT SECTION (Meeting Content & Info) */}
        <div className={cn(
          "flex-1 p-6 md:p-14 flex flex-col justify-between space-y-10 relative z-10",
          "rounded-[32px] md:rounded-none m-2 md:m-0 bg-white/[0.02] md:bg-transparent border border-white/5 md:border-none shadow-xl md:shadow-none"
        )}>
          <div className="space-y-10">
             <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div className="space-y-4 flex-1">
                   <div className="flex flex-wrap items-center gap-3">
                      <span className="px-4 py-1 rounded-full bg-gold-primary/20 text-gold-primary border border-gold-primary/30 text-[10px] font-black uppercase tracking-widest backdrop-blur-md">مناسبة عائلية</span>
                      <span className="px-4 py-1 rounded-full bg-white/5 text-white/60 border border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                         <Clock size={14} /> {meeting.duration_minutes || 60} دقيقة
                      </span>
                   </div>
                   <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-tight drop-shadow-2xl">{meeting.title}</h2>
                </div>

                <div className="text-right shrink-0">
                   <span className="text-gold-primary font-black uppercase tracking-[0.3em] text-xs block mb-1">{date.weekday}</span>
                   <div className="flex items-baseline gap-2">
                      <span className="text-6xl md:text-8xl font-black tracking-tighter text-white leading-none">{date.day}</span>
                      <span className="text-xl md:text-3xl font-black text-white/40 uppercase tracking-widest">{date.month}</span>
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-5">
                   <div className="flex items-center gap-3 text-gold-primary font-black uppercase tracking-[0.3em] text-[11px]">
                      <HelpCircle size={16} /> أجندة اللقاء
                   </div>
                   <div className="text-lg md:text-2xl font-bold text-white/80 leading-relaxed border-r-4 border-gold-primary/30 pr-6">
                      {meeting.description || "لا يوجد وصف لهذه المناسبة العائلية."}
                   </div>
                </div>

                <div className="space-y-6">
                   <div className="flex items-center gap-3 text-gold-primary font-black uppercase tracking-[0.3em] text-[11px]">
                      <MapPin size={16} /> تفاصيل الموقع
                   </div>
                   <div className="grid gap-4">
                      <div className="flex items-center gap-4 bg-white/5 p-5 rounded-[28px] border border-white/10">
                         <div className="size-14 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary shadow-xl shrink-0"><MapPin size={28} /></div>
                         <div className="min-w-0">
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">المكان</p>
                            <p className="text-base md:text-xl font-black text-white truncate">{meeting.location || "مجلس العائلة"}</p>
                         </div>
                      </div>
                      {meeting.location_url && (
                        <a href={meeting.location_url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-5 rounded-[28px] bg-gold-primary text-emerald-950 font-black shadow-xl hover:scale-[1.02] transition-all">
                           <div className="flex items-center gap-3">
                              <Navigation size={24} strokeWidth={2.5} />
                              <span className="text-base">فتح الموقع على الخريطة</span>
                           </div>
                           <ChevronLeft size={20} strokeWidth={3} />
                        </a>
                      )}
                   </div>
                </div>
             </div>
          </div>

          {/* Bottom Actions Bar */}
          <div className="pt-10 space-y-4">
             <MeetingPresentations meetingId={meeting.id} canManage={canManage} userId={userId} />

             <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                   onClick={() => addToCalendar({
                     title: meeting.title,
                     description: meeting.description || "",
                     location: meeting.location || "",
                     startTime: meeting.scheduled_at,
                     durationMinutes: meeting.duration_minutes || 60
                   })}
                   className="flex-1 w-full flex items-center justify-center gap-3 h-14 rounded-2xl bg-white/5 text-white/60 font-black text-xs border border-white/10 hover:bg-white/10 hover:text-white transition-all shadow-xl"
                >
                   <CalendarDays size={18} /> إضافة لتقويم الجوال
                </button>

                {canManage && (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                     {/* This button is now strictly tied to canManage which only includes Chairman, Technical Admin, and Meeting Head */}
                     <button onClick={() => onRemind(meeting)} className="h-14 px-6 rounded-2xl bg-gold-primary text-emerald-950 font-black text-xs shadow-xl flex items-center gap-2 active:scale-95 transition-all"><Bell size={18} /> تذكير الجميع</button>
                     <button onClick={() => onEdit(meeting)} className="h-14 w-14 rounded-2xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all border border-white/10"><Pencil size={20} /></button>
                     <button onClick={() => onDelete(meeting.id)} className="h-14 w-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all border border-rose-500/10"><Trash2 size={20} /></button>
                  </div>
                )}
             </div>
          </div>
        </div>
      </article>
    </div>
  );
}
