import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { MapPin, Calendar, Users, ChevronLeft, Plane, Plus, X, Upload, ImageIcon, Trash2, Pencil, Save, Compass, Clock, MapPinned, Loader2, Target, Trophy } from "lucide-react";
import { toast } from "sonner";
import { TripImage } from "@/components/trip-image";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useUserRole, roleLabel } from "@/hooks/use-user-role";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { GamesHub } from "@/components/entertainment/games-hub";
import { sendPushNotification } from "@/lib/api/push.functions";

export const Route = createFileRoute("/_authenticated/trips")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الترفيه — السيف" },
      { name: "description", content: "وجهات ترفيهية وفعاليات عائلية لتعزيز الترابط." },
    ],
  }),
  component: TripsPage,
});

type Trip = {
  id: string;
  title: string;
  badge: string | null;
  location: string | null;
  location_url: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  image_url: string | null;
  status: string;
};

function formatRange(start: string | null, end: string | null) {
  if (!start) return "—";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "long" });
  if (!end || end === start) return fmt(start);
  return `${fmt(start)} - ${fmt(end)}`;
}

function statusChip(status: string) {
  if (status === "upcoming")
    return { label: "قادمة", className: "bg-gold-primary/10 text-gold-primary border-gold-primary/20" };
  if (status === "planning")
    return { label: "قيد التخطيط", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
  return { label: "سابقة", className: "bg-muted text-muted-foreground border-border" };
}

function TripsPage() {
  const [profile, setProfile] = useState<{
    name: string;
    role: string;
    initial: string;
    avatarPath?: string | null;
  }>({ name: "عضو العائلة", role: "عضو", initial: "ص", avatarPath: null });
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"destinations" | "games">("destinations");
  const [showAdd, setShowAdd] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const { userId, canManage: canManageSection, primaryRole } = useUserRole();
  const canManage = canManageSection("trips");
  const dynamicLogo = useSiteLogo();
  const sendPush = useServerFn(sendPushNotification);

  async function loadTrips() {
    const { data, error } = await supabase
      .from("trips")
      .select("id,title,badge,location,location_url,start_date,end_date,description,image_url,status")
      .order("start_date", { ascending: true, nullsFirst: false });
    if (error) {
      toast.error("تعذر تحميل بيانات الترفيه");
    } else {
      setTrips((data ?? []) as Trip[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      if (userId) {
        const [{ data: p }, { data: r }] = await Promise.all([
          supabase.from("profiles").select("arabic_name, full_name, avatar_url").eq("id", userId).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", userId)
        ]);
        const rs = (r ?? []).map(x => x.role);
        const name = p?.arabic_name?.trim() || p?.full_name?.trim() || "عضو العائلة";
        setProfile({
          name,
          role: roleLabel(primaryRole),
          initial: (name[0] ?? "س").toUpperCase(),
          avatarPath: p?.avatar_url ?? null,
        });
      }
      await loadTrips();
    })();

    const channel = supabase
      .channel("trips-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => loadTrips())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, primaryRole]);

  return (
    <AppShell title="الترفيه" user={profile}>
      <div className="max-w-7xl mx-auto space-y-8 pb-24" dir="rtl">
        <QuickActionsBanner />

        {/* Entertainment Tabs - Moved to Top for better visibility */}
        <div className="flex items-center justify-center gap-3 px-4 md:px-0">
           <button
             onClick={() => setActiveTab("destinations")}
             className={cn(
               "flex-1 md:flex-none md:min-w-[240px] py-5 rounded-[32px] font-black text-sm md:text-base flex items-center justify-center gap-3 transition-all border-2 shadow-xl",
               activeTab === "destinations"
                 ? "bg-primary text-white border-primary scale-105"
                 : "bg-card text-muted-foreground border-transparent hover:bg-muted hover:scale-[1.02]"
             )}
           >
              <Compass size={20} />
              <span>الوجهات والرحلات</span>
           </button>
           <button
             onClick={() => setActiveTab("games")}
             className={cn(
               "flex-1 md:flex-none md:min-w-[240px] py-5 rounded-[32px] font-black text-sm md:text-base flex items-center justify-center gap-3 transition-all border-2 shadow-xl",
               activeTab === "games"
                 ? "bg-gold-primary text-black border-gold-primary scale-105 shadow-gold-primary/20"
                 : "bg-card text-muted-foreground border-transparent hover:bg-muted hover:scale-[1.02]"
             )}
           >
              <Target size={20} />
              <span>ميدان الألعاب (جديد)</span>
           </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "destinations" ? (
            <motion.div
              key="destinations"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              {/* Alsaif Trips Header — Banner Style */}
              <section className="animate-fade-up px-4 md:px-0">
                <div className="relative overflow-hidden rounded-[32px] md:rounded-[48px] bg-gradient-to-br from-indigo-900 via-primary to-black p-6 md:p-12 text-white shadow-2xl border border-white/5 group">
                  {/* Left Decorative Logo */}
                  <div className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none z-1 transition-transform duration-1000 group-hover:scale-110 group-hover:opacity-40">
                    <div
                      className="size-28 md:size-64 logo-alsaif-banner"
                      style={{ "--logo-url": dynamicLogo ? `url(${dynamicLogo})` : "none" } as any}
                    />
                  </div>

                  <div className="absolute top-0 right-0 size-64 bg-gold-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />

                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
                    <div className="space-y-3 md:space-y-5 text-center md:text-right">
                      <div className="flex items-center justify-center md:justify-start gap-3">
                        <div className="h-0.5 w-8 md:w-12 bg-gold-primary shadow-[0_0_10px_rgba(212,175,55,0.6)]" />
                        <span className="text-[9px] md:text-xs font-black uppercase tracking-[0.4em] text-gold-primary">
                          استكشاف السعادة
                        </span>
                      </div>
                      <h2 className="text-3xl md:text-6xl font-black tracking-tighter leading-tight drop-shadow-2xl">
                        ترفيه العائلة
                      </h2>
                      <p className="text-white/60 font-bold text-sm md:text-xl max-w-xl">
                        جدول الوجهات واللقاءات الترفيهية لأعضاء عائلة السيف لتعزيز الترابط.
                      </p>
                    </div>

                    {canManage && (
                      <button
                        onClick={() => setShowAdd(true)}
                        className="btn-gold relative px-8 py-4 md:px-12 md:py-6 rounded-2xl md:rounded-[32px] flex items-center justify-center gap-3 shadow-2xl shadow-gold-primary/30 text-sm md:text-xl font-black group/btn self-center md:self-auto shrink-0 active:scale-95 transition-all"
                      >
                        <Plus className="size-5 md:size-7" strokeWidth={3} />
                        <span>إضافة وجهة</span>
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-40">
                   <div className="size-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                   <p className="font-black">جاري تحضير الوجهات الترفيهية...</p>
                </div>
              ) : trips.length === 0 ? (
                <div className="card-surface p-24 flex flex-col items-center text-center gap-6 border-dashed opacity-40">
                  <div className="size-20 rounded-[40px] bg-muted/50 flex items-center justify-center text-muted-foreground"><Compass size={60} strokeWidth={1} /></div>
                  <div className="space-y-1">
                    <p className="text-2xl font-black text-primary">لا توجد أنشطة ترفيهية حالياً</p>
                    <p className="text-sm font-bold opacity-60">سيتم إشعارك فور إعلان الإدارة عن وجهة ترفيهية جديدة.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 px-4 md:px-0">
                  {trips.map((trip, i) => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      index={i}
                      canManage={canManage}
                      onEdit={setEditingTrip}
                      onRefresh={loadTrips}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="games"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
               {/* Games Header */}
               <section className="animate-fade-up px-4 md:px-0">
                  <div className="relative overflow-hidden rounded-[32px] md:rounded-[48px] bg-gradient-to-br from-[#064E3B] via-[#0d2620] to-black p-6 md:p-12 text-white shadow-2xl border border-white/5 group">
                    <div className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none z-1 transition-transform duration-1000 group-hover:scale-110 group-hover:opacity-40">
                      <div className="size-28 md:size-64 logo-alsaif-banner" style={{ "--logo-url": `url(${dynamicLogo || ""})` } as any} />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
                      <div className="space-y-3 md:space-y-5 text-center md:text-right">
                        <div className="flex items-center justify-center md:justify-start gap-3">
                          <div className="h-0.5 w-8 md:w-12 bg-gold-primary shadow-[0_0_10px_rgba(212,175,55,0.6)]" />
                          <span className="text-[9px] md:text-xs font-black uppercase tracking-[0.4em] text-gold-primary">ميدان التنافس</span>
                        </div>
                        <h2 className="text-3xl md:text-6xl font-black tracking-tighter leading-tight drop-shadow-2xl text-gold-primary">ميدان ألعاب السيف</h2>
                        <p className="text-white/60 font-bold text-sm md:text-xl max-w-xl">أدوات ذكية وألعاب حماسية مصممة لتجمعاتكم العائلية الممتعة.</p>
                      </div>
                      <div className="size-16 md:size-28 rounded-2xl md:rounded-[36px] bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-2xl self-center md:self-auto shrink-0 group-hover:rotate-12 transition-transform duration-700">
                        <Target className="size-8 md:size-14 text-gold-primary" strokeWidth={1.5} />
                      </div>
                    </div>
                  </div>
               </section>

               <GamesHub />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {(showAdd || editingTrip) && (
          <TripDialog
            trip={editingTrip || undefined}
            onClose={() => { setShowAdd(false); setEditingTrip(null); }}
            onSaved={loadTrips}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function TripCard({ trip, index, canManage, onEdit, onRefresh }: any) {
  const chip = statusChip(trip.status);

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group card-surface overflow-hidden border-none shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-gold-primary/10"
    >
      <div className="relative h-64 overflow-hidden">
        <TripImage
          path={trip.image_url}
          alt={trip.title}
          className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Status Chip */}
        <div className={cn("absolute top-5 right-5 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border backdrop-blur-md shadow-lg", chip.className)}>
          {chip.label}
        </div>

        {/* Admin Actions */}
        {canManage && (
          <div className="absolute top-5 left-5 flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
            <button onClick={() => onEdit(trip)} className="size-10 rounded-xl bg-white/20 backdrop-blur-md text-white hover:bg-white hover:text-primary transition-all flex items-center justify-center shadow-lg border border-white/20"><Pencil size={18} /></button>
            <button
              onClick={async () => {
                if (!confirm(`هل تريد حذف رحلة "${trip.title}"؟`)) return;
                const { error } = await supabase.from("trips").delete().eq("id", trip.id);
                if (error) toast.error("تعذر الحذف");
                else { toast.success("تم الحذف"); onRefresh(); }
              }}
              className="size-10 rounded-xl bg-rose-500/80 backdrop-blur-md text-white hover:bg-rose-600 transition-all flex items-center justify-center shadow-lg border border-white/20"
            ><Trash2 size={18} /></button>
          </div>
        )}

        {/* Location Overlay */}
        {trip.location && (
          <div className="absolute bottom-5 right-5 left-5 flex items-center gap-2 text-white">
             <MapPin className="size-4 text-gold-primary" />
             <span className="text-xs font-black truncate drop-shadow-md">{trip.location}</span>
          </div>
        )}
      </div>

      <div className="p-8 space-y-6">
        <div className="space-y-3">
           {trip.badge && (
              <span className="px-3 py-0.5 rounded-full bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/10">{trip.badge}</span>
           )}
           <h3 className="text-2xl font-black text-primary leading-tight line-clamp-1">{trip.title}</h3>
           {trip.description && (
             <p className="text-sm font-bold text-muted-foreground/80 leading-relaxed line-clamp-2 italic">"{trip.description}"</p>
           )}
        </div>

        <div className="grid grid-cols-2 gap-4 py-4 border-y border-border/40">
           <div className="space-y-1">
              <div className="flex items-center gap-2 opacity-40">
                 <Calendar className="size-3" />
                 <span className="text-[10px] font-black uppercase tracking-widest">تاريخ الرحلة</span>
              </div>
              <p className="text-xs font-black text-primary">{formatRange(trip.start_date, trip.end_date)}</p>
           </div>
           <div className="space-y-1">
              <div className="flex items-center gap-2 opacity-40">
                 <Users className="size-3" />
                 <span className="text-[10px] font-black uppercase tracking-widest">المشاركون</span>
              </div>
              <p className="text-xs font-black text-primary">أعضاء العائلة</p>
           </div>
        </div>

        <Link
          to="/trips/$tripId"
          params={{ tripId: trip.id }}
          className="w-full h-14 rounded-2xl bg-primary/5 hover:bg-primary hover:text-white transition-all duration-300 flex items-center justify-center gap-3 text-primary font-black text-sm uppercase tracking-widest border border-primary/10 shadow-inner group/btn"
        >
          <span>تفاصيل الوجهة</span>
          <ChevronLeft className="size-4 transition-transform group-hover/btn:-translate-x-1" />
        </Link>
      </div>
    </motion.article>
  );
}

function TripDialog({ trip, onClose, onSaved }: any) {
  const isEdit = !!trip;
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [form, setForm] = useState({
    title: trip?.title ?? "",
    badge: trip?.badge ?? "",
    location: trip?.location ?? "",
    location_url: trip?.location_url ?? "",
    start_date: trip?.start_date ?? "",
    end_date: trip?.end_date ?? "",
    description: trip?.description ?? "",
    status: trip?.status ?? "upcoming",
  });

  const update = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const onPickImage = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) {
      toast.error("عنوان الرحلة مطلوب");
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    let imagePath: string | null | undefined = undefined;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
      await supabase.storage.from("trip-images").upload(path, imageFile);
      imagePath = path;
    } else if (isEdit && removeExistingImage) {
      imagePath = null;
    }

    const payload: any = { ...form, title };
    if (imagePath !== undefined) payload.image_url = imagePath;

    let error;
    if (isEdit) {
      ({ error } = await supabase.from("trips").update(payload).eq("id", trip.id));
    } else {
      ({ error } = await supabase.from("trips").insert({ ...payload, created_by: u.user.id }));
    }

    setSaving(false);
    if (error) toast.error("حدث خطأ");
    else {
      toast.success("تم الحفظ");

      if (!isEdit) {
        // Trigger FCM for new trip
        try {
          const { sendPushNotification } = await import("@/lib/api/push.functions");
          await sendPushNotification({
            data: {
              title: "فعالية جديدة",
              body: "تمت إضافة فعالية جديدة في قسم الترفيه.",
              type: "entertainment",
              route: "/trips",
            },
          });
        } catch (fcmErr) {
          console.warn("Push broadcast failed:", fcmErr);
        }
      }

      onSaved();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-4 bg-black/80 backdrop-blur-md" dir="rtl">
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="bg-card w-full max-w-2xl overflow-hidden shadow-2xl rounded-[32px] md:rounded-[48px] flex flex-col max-h-[90vh] border border-border">
        <div className="p-6 md:p-12 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar flex-1">
           <div className="flex items-center justify-between sticky top-0 bg-card z-10 pb-4 border-b border-border/20">
              <div className="space-y-1">
                 <h3 className="text-2xl md:text-3xl font-black text-primary tracking-tight">{isEdit ? "تعديل الرحلة" : "إضافة رحلة جديدة"}</h3>
                 <p className="text-xs md:text-sm font-bold text-muted-foreground opacity-60">أدخل تفاصيل الوجهة والمواعيد لرحلة العائلة.</p>
              </div>
              <button onClick={onClose} className="size-10 md:size-12 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-white transition-all"><X size={20} /></button>
           </div>

           <form onSubmit={submit} className="space-y-6 md:space-y-8 text-foreground">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                 <Field label="عنوان الرحلة" value={form.title} onChange={(v:any) => update("title", v)} placeholder="مثال: رحلة العلا" />
                 <Field label="الوسم" value={form.badge} onChange={(v:any) => update("badge", v)} placeholder="مثال: الرحلة السنوية" />
                 <Field label="الوجهة" value={form.location} onChange={(v:any) => update("location", v)} placeholder="المدينة أو الدولة" />
                 <div className="space-y-2">
                    <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">الحالة</label>
                    <select value={form.status} onChange={(e) => update("status", e.target.value)} className="w-full h-12 md:h-14 px-5 rounded-2xl md:rounded-2xl bg-muted/40 border border-border/60 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all text-foreground">
                       <option value="upcoming">قادمة</option>
                       <option value="planning">قيد التخطيط</option>
                       <option value="past">سابقة</option>
                    </select>
                 </div>
                 <Field label="تاريخ البدء" type="date" value={form.start_date} onChange={(v:any) => update("start_date", v)} />
                 <Field label="تاريخ الانتهاء" type="date" value={form.end_date} onChange={(v:any) => update("end_date", v)} />
              </div>

              <div className="space-y-2">
                 <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">رابط الموقع</label>
                 <input dir="ltr" value={form.location_url} onChange={(e) => update("location_url", e.target.value)} placeholder="رابط خرائط جوجل" className="w-full h-12 md:h-14 px-5 rounded-2xl bg-muted/40 border border-border/60 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-inner text-foreground placeholder:text-muted-foreground/50" />
              </div>

              <div className="space-y-2">
                 <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">وصف الرحلة</label>
                 <textarea value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="التفاصيل والبرامج..." rows={3} className="w-full p-5 md:p-6 rounded-2xl md:rounded-3xl bg-muted/40 border border-border/60 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none shadow-inner text-foreground placeholder:text-muted-foreground/50" />
              </div>

              <div className="space-y-2">
                 <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">صورة الوجهة</label>
                 <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border/60 rounded-[24px] md:rounded-[32px] cursor-pointer hover:bg-primary/5 hover:border-primary/40 transition-all bg-muted/20">
                    {(imagePreview || trip?.image_url) ? (
                       <img src={imagePreview || trip?.image_url} className="w-full h-32 md:h-40 object-cover rounded-xl shadow-lg" />
                    ) : (
                       <>
                        <ImageIcon className="size-8 text-muted-foreground opacity-30" />
                        <span className="text-xs font-bold text-muted-foreground">اضغط لرفع صورة</span>
                       </>
                    )}
                    <input type="file" hidden accept="image/*" onChange={onPickImage} />
                 </label>
              </div>
           </form>
        </div>
        <div className="p-6 md:p-10 bg-card border-t border-border/20 flex gap-3 md:gap-4 sticky bottom-0">
           <button type="button" onClick={onClose} className="flex-1 py-4 md:py-5 rounded-2xl md:rounded-3xl font-black text-muted-foreground hover:bg-muted transition-all">إلغاء</button>
           <button disabled={saving} onClick={submit as any} className="flex-[2] btn-gold py-4 md:py-5 rounded-2xl md:rounded-3xl font-black text-base md:text-lg shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-2">
             {saving ? <Loader2 className="size-5 animate-spin" /> : <span>حفظ البيانات</span>}
           </button>
        </div>
      </motion.div>
    </div>
  );
}



function Field({ label, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div className="space-y-2">
       <label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">{label}</label>
       <input
         type={type}
         value={value}
         onChange={(e) => onChange(e.target.value)}
         placeholder={placeholder}
         className="w-full h-14 px-6 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-sm"
       />
    </div>
  );
}
