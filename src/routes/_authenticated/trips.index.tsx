import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { MapPin, Calendar, Users, ChevronLeft, Plane, Plus, X, Upload, ImageIcon, Trash2, Pencil, Save, Compass, Clock, MapPinned } from "lucide-react";
import { toast } from "sonner";
import { TripImage } from "@/components/trip-image";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";

export const Route = createFileRoute("/_authenticated/trips/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الرحلات — السيف" },
      { name: "description", content: "رحلات العائلة القادمة والسابقة، تفاصيل الوجهة والمشاركين." },
    ],
  }),
  component: TripsPage,
});

function roleLabel(role: string | null) {
  if (role === "admin") return "مسؤول النظام";
  if (role === "manager") return "مدير";
  return "عضو";
}

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
  const [showAdd, setShowAdd] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const canManage = userRole === "admin" || userRole === "manager";

  async function loadTrips() {
    const { data, error } = await supabase
      .from("trips")
      .select("id,title,badge,location,location_url,start_date,end_date,description,image_url,status")
      .order("start_date", { ascending: true, nullsFirst: false });
    if (error) {
      toast.error("تعذر تحميل الرحلات");
    } else {
      setTrips((data ?? []) as Trip[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const [{ data: p }, { data: r }] = await Promise.all([
          supabase
            .from("profiles")
            .select("arabic_name, full_name, avatar_url")
            .eq("id", u.user.id)
            .maybeSingle(),
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", u.user.id)
            .order("role")
            .limit(1)
            .maybeSingle(),
        ]);
        const name = p?.arabic_name?.trim() || p?.full_name?.trim() || u.user.email?.split("@")[0] || "عضو العائلة";
        setProfile({
          name,
          role: roleLabel(r?.role ?? null),
          initial: (name[0] ?? "س").toUpperCase(),
          avatarPath: p?.avatar_url ?? null,
        });
        setUserRole(r?.role ?? null);
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
  }, []);

  return (
    <AppShell title="الرحلات" user={profile}>
      <div className="max-w-7xl mx-auto space-y-12 pb-24" dir="rtl">

        {/* Royal Trips Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-up">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="size-1 w-10 bg-gold-primary rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary">استكشاف العالم</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-primary">رحلات العائلة</h2>
            <p className="text-muted-foreground font-bold text-lg opacity-70">جدول الوجهات واللقاءات الخارجية لأعضاء عائلة السيف.</p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowAdd(true)}
              className="btn-gold px-8 py-4 flex items-center gap-3 shadow-2xl shadow-gold-primary/20 text-base"
            >
              <Plus className="size-5" strokeWidth={3} />
              <span>إضافة رحلة جديدة</span>
            </button>
          )}
        </section>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-40">
             <div className="size-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
             <p className="font-black">جاري تحضير الوجهات والرحلات...</p>
          </div>
        ) : trips.length === 0 ? (
          <div className="card-surface p-24 flex flex-col items-center text-center gap-6 border-dashed opacity-40 animate-fade-up">
            <div className="size-20 rounded-[40px] bg-muted/50 flex items-center justify-center text-muted-foreground"><Compass size={60} strokeWidth={1} /></div>
            <div className="space-y-1">
              <p className="text-2xl font-black text-primary">لا توجد رحلات مجدولة حالياً</p>
              <p className="text-sm font-bold opacity-60">سيتم إشعارك فور إعلان الإدارة عن رحلة عائلية جديدة.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
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
          <div className="absolute top-5 left-5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    let imagePath = undefined;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
      await supabase.storage.from("trip-images").upload(path, imageFile);
      imagePath = path;
    } else if (isEdit && removeExistingImage) {
      imagePath = null;
    }

    const payload: any = { ...form };
    if (imagePath !== undefined) payload.image_url = imagePath;

    let error;
    if (isEdit) {
      ({ error } = await supabase.from("trips").update(payload).eq("id", trip.id));
    } else {
      ({ error } = await supabase.from("trips").insert({ ...payload, created_by: u.user.id }));
    }

    setSaving(false);
    if (error) toast.error("حدث خطأ");
    else { toast.success("تم الحفظ"); onSaved(); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card-surface w-full max-w-2xl overflow-hidden shadow-2xl rounded-[48px]">
        <div className="p-8 sm:p-12 space-y-8 max-h-[85vh] overflow-y-auto no-scrollbar">
           <div className="flex items-center justify-between">
              <div className="space-y-1">
                 <h3 className="text-3xl font-black text-primary tracking-tight">{isEdit ? "تعديل الرحلة" : "إضافة رحلة جديدة"}</h3>
                 <p className="text-sm font-bold text-muted-foreground opacity-60">أدخل تفاصيل الوجهة والمواعيد لرحلة العائلة.</p>
              </div>
              <button onClick={onClose} className="size-12 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-white transition-all"><X size={20} /></button>
           </div>

           <form onSubmit={submit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Field label="عنوان الرحلة" value={form.title} onChange={(v:any) => update("title", v)} placeholder="مثال: رحلة العائلة إلى العلا" />
                 <Field label="الوسم / المناسبة" value={form.badge} onChange={(v:any) => update("badge", v)} placeholder="مثال: الرحلة السنوية" />
                 <Field label="الوجهة / الموقع" value={form.location} onChange={(v:any) => update("location", v)} placeholder="مثال: العلا، المدينة المنورة" />
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">الحالة</label>
                    <select value={form.status} onChange={(e) => update("status", e.target.value)} className="w-full h-14 px-6 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all">
                       <option value="upcoming">قادمة</option>
                       <option value="planning">قيد التخطيط</option>
                       <option value="past">سابقة</option>
                    </select>
                 </div>
                 <Field label="تاريخ البدء" type="date" value={form.start_date} onChange={(v:any) => update("start_date", v)} />
                 <Field label="تاريخ الانتهاء" type="date" value={form.end_date} onChange={(v:any) => update("end_date", v)} />
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">رابط الموقع (خرائط جوجل)</label>
                 <input dir="ltr" value={form.location_url} onChange={(e) => update("location_url", e.target.value)} placeholder="https://..." className="w-full h-14 px-6 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all" />
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">وصف الرحلة</label>
                 <textarea value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="اكتب تفاصيل الرحلة، البرامج، والمستلزمات..." rows={4} className="w-full p-6 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none" />
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">صورة الوجهة</label>
                 <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border rounded-[32px] cursor-pointer hover:bg-primary/5 hover:border-primary/40 transition-all">
                    {(imagePreview || trip?.image_url) ? (
                       <img src={imagePreview || trip?.image_url} className="w-full h-40 object-cover rounded-2xl shadow-lg" />
                    ) : (
                       <>
                        <ImageIcon className="size-10 text-muted-foreground opacity-40" />
                        <span className="text-sm font-bold text-muted-foreground">اضغط لرفع صورة فنية للوجهة</span>
                       </>
                    )}
                    <input type="file" hidden accept="image/*" onChange={onPickImage} />
                 </label>
              </div>

              <div className="flex gap-4 pt-6">
                 <button type="button" onClick={onClose} className="flex-1 py-5 rounded-3xl font-black text-muted-foreground hover:bg-muted transition-all">إلغاء</button>
                 <button disabled={saving} type="submit" className="flex-[2] btn-gold py-5 rounded-3xl font-black text-lg shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-3">
                   {saving ? <Loader2 className="size-6 animate-spin" /> : <span>تأكيد بيانات الرحلة</span>}
                 </button>
              </div>
           </form>
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
