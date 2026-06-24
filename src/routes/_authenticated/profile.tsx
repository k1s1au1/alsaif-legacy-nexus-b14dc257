import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { toast } from "sonner";
import { Camera, Loader2, Lock, User as UserIcon, Mail, Calendar, Phone, CheckCircle2, ChevronLeft, ShieldCheck, Quote } from "lucide-react";
import { UserAvatar, invalidateAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import alsaifMark from "@/assets/alsaif-mark.png";

export const Route = createFileRoute("/_authenticated/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الملف الشخصي — السيف" },
      { name: "description", content: "إدارة بيانات حسابك الشخصية وكلمة المرور وصورة الملف." },
    ],
  }),
  component: ProfilePage,
});

const nameSchema = z
  .string()
  .trim()
  .min(2, { message: "الاسم يجب أن يحتوي على حرفين على الأقل" })
  .max(80, { message: "الاسم طويل جداً" });

const passwordSchema = z
  .string()
  .min(8, { message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" })
  .max(72, { message: "كلمة المرور طويلة جداً" });

const phoneSchema = z
  .string()
  .trim()
  .min(8, { message: "رقم الجوال قصير جداً" })
  .max(20, { message: "رقم الجوال طويل جداً" })
  .regex(/^[\d\s+\-()]+$/, { message: "أرقام فقط" });

type ProfileRow = {
  id: string;
  arabic_name: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
};

function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [userId, setUserId] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [createdAt, setCreatedAt] = useState<string>("");
  const [arabicName, setArabicName] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      setEmail(u.user.email ?? "");
      setCreatedAt(u.user.created_at);
      const { data: p } = await supabase
        .from("profiles")
        .select("id, arabic_name, full_name, phone, avatar_url, created_at")
        .eq("id", u.user.id)
        .maybeSingle<ProfileRow>();
      if (p) {
        setArabicName(p.arabic_name ?? "");
        setFullName(p.full_name ?? "");
        setPhone(p.phone ?? "");
        setAvatarUrl(p.avatar_url);
        if (p.avatar_url) {
          const { data: signed } = await supabase.storage
            .from("avatars")
            .createSignedUrl(p.avatar_url, 60 * 60);
          setAvatarSrc(signed?.signedUrl ?? null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const displayName = (arabicName || fullName || email.split("@")[0] || "عضو العائلة").trim();
  const initial = (displayName[0] ?? "س").toUpperCase();

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const parsed = nameSchema.safeParse(arabicName || fullName);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const phoneParsed = phoneSchema.safeParse(phone);
    if (!phoneParsed.success) {
      toast.error(phoneParsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        arabic_name: arabicName.trim() || null,
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error("تعذر حفظ التغييرات");
      return;
    }
    toast.success("تم تحديث بياناتك بنجاح");
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (password !== passwordConfirm) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setPwSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword("");
    setPasswordConfirm("");
    toast.success("تم تحديث كلمة المرور بنجاح");
  }

  async function uploadAvatar(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("يجب اختيار صورة");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 5 ميغابايت");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast.error("فشل رفع الصورة");
      return;
    }
    const previous = avatarUrl;
    if (previous && previous !== path) {
      await supabase.storage.from("avatars").remove([previous]);
    }
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", userId);
    if (updErr) {
      setUploading(false);
      toast.error("تعذر حفظ الصورة");
      return;
    }
    setAvatarUrl(path);
    const { data: signed } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60);
    setAvatarSrc(signed?.signedUrl ?? null);
    invalidateAvatar(previous);
    invalidateAvatar(path);
    setUploading(false);
    toast.success("تم تحديث صورة الملف الشخصي");
  }

  if (loading) {
    return (
      <AppShell title="الملف الشخصي" user={{ name: "...", role: "عضو", initial: "ص" }}>
        <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-40">
           <div className="size-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
           <p className="font-black">جاري تحميل بياناتك...</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="ملفي الشخصي" user={{ name: displayName, role: "عضو العائلة", initial, avatarPath: avatarUrl }}>
      <div className="max-w-5xl mx-auto space-y-12 pb-24" dir="rtl">

        {/* Alsaif Profile Header */}
        <section className="flex flex-col md:flex-row items-center gap-10 animate-fade-up">
           <div className="relative group">
              <div className="absolute inset-0 bg-gold-primary/20 blur-[60px] rounded-full group-hover:bg-gold-primary/30 transition-all duration-700" />
              <div className="relative size-40 md:size-56 rounded-[48px] bg-card border-4 border-white dark:border-border shadow-2xl overflow-hidden ring-1 ring-black/5 transition-transform duration-700 group-hover:scale-[1.02]">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={displayName} className="size-full object-cover" />
                ) : (
                  <div className="size-full flex items-center justify-center bg-primary/5 text-6xl font-black text-primary uppercase">{initial}</div>
                )}

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-all duration-300 backdrop-blur-[2px]"
                >
                  <Camera className="size-10 mb-2" />
                  <span className="text-xs font-black uppercase tracking-widest">تحديث الصورة</span>
                </button>
              </div>

              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-card/80 rounded-[48px] z-20 backdrop-blur-md">
                   <Loader2 className="size-10 animate-spin text-primary" />
                </div>
              )}
           </div>

           <div className="flex-1 text-center md:text-right space-y-4">
              <div className="space-y-1">
                 <div className="flex items-center justify-center md:justify-start gap-3">
                    <div className="size-1 w-8 bg-gold-primary rounded-full" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary">الملف التعريفي</span>
                 </div>
                 <h2 className="text-4xl md:text-5xl font-black tracking-tight text-primary">{displayName}</h2>
                 <p className="text-lg font-bold text-muted-foreground opacity-60">عضو مجلس عائلة آل سيف الموقر</p>
              </div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                 <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20 text-emerald-600">
                    <ShieldCheck className="size-4" />
                    <span className="text-xs font-black uppercase tracking-tighter">حساب معتمد</span>
                 </div>
                 <div className="flex items-center gap-2 bg-primary/5 px-4 py-1.5 rounded-full border border-primary/10 text-primary">
                    <Calendar className="size-4" />
                    <span className="text-xs font-black uppercase tracking-tighter">منذ {new Date(createdAt).getFullYear()}م</span>
                 </div>
              </div>
           </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

           {/* Primary Actions Column */}
           <div className="lg:col-span-2 space-y-8">

              {/* Profile Editor */}
              <form onSubmit={saveProfile} className="card-surface p-8 md:p-10 space-y-8 animate-fade-up" style={{ animationDelay: "100ms" }}>
                 <div className="flex items-center justify-between border-b border-border/40 pb-6">
                    <div className="flex items-center gap-4">
                       <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"><UserIcon className="size-6" /></div>
                       <h3 className="text-xl font-black text-primary">البيانات الشخصية</h3>
                    </div>
                    {saving && <Loader2 className="size-5 animate-spin text-primary" />}
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Field label="الاسم بالعربية (المجلس)" icon={<Quote className="size-4" />} value={arabicName} onChange={setArabicName} placeholder="مثال: سعود السيف" />
                    <Field label="الاسم الكامل (الهوية)" icon={<UserIcon className="size-4" />} value={fullName} onChange={setFullName} placeholder="الاسم كما في الهوية..." />
                    <Field label="رقم الجوال" icon={<Phone className="size-4" />} value={phone} onChange={setPhone} placeholder="05xxxxxxxx" type="tel" />
                    <Field label="البريد الإلكتروني" icon={<Mail className="size-4" />} value={email} disabled placeholder="البريد لا يمكن تعديله" />
                 </div>

                 <div className="pt-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn-gold w-full md:w-fit px-12 py-4 rounded-2xl text-base font-black shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-3 transition-all hover:scale-105"
                    >
                      <CheckCircle2 className="size-5" />
                      حفظ كافة التغييرات
                    </button>
                 </div>
              </form>

              {/* Password Security */}
              <form onSubmit={changePassword} className="card-surface p-8 md:p-10 space-y-8 animate-fade-up" style={{ animationDelay: "200ms" }}>
                 <div className="flex items-center gap-4 border-b border-border/40 pb-6">
                    <div className="size-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-600 shadow-inner"><Lock className="size-6" /></div>
                    <h3 className="text-xl font-black text-primary">تأمين الحساب</h3>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Field label="كلمة المرور الجديدة" type="password" value={password} onChange={setPassword} placeholder="••••••••••••" />
                    <Field label="تأكيد كلمة المرور" type="password" value={passwordConfirm} onChange={setPasswordConfirm} placeholder="••••••••••••" />
                 </div>

                 <div className="pt-4">
                    <button
                      type="submit"
                      disabled={pwSaving || !password}
                      className="px-10 py-4 rounded-2xl bg-muted/60 hover:bg-primary hover:text-white transition-all font-black text-sm text-primary flex items-center gap-3 w-full md:w-fit"
                    >
                      {pwSaving ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
                      تحديث كلمة السر
                    </button>
                 </div>
              </form>

           </div>

           {/* Sidebar Info Column */}
           <div className="space-y-8">
              <div className="card-surface p-8 space-y-6 relative overflow-hidden bg-primary text-white border-none shadow-2xl animate-fade-up" style={{ animationDelay: "300ms" }}>
                 <div className="absolute top-0 left-0 opacity-10 -translate-x-1/3 -translate-y-1/3 pointer-events-none scale-150 rotate-12">
                    <img src={alsaifMark} className="size-48 brightness-0 invert" alt="" />
                 </div>
                 <h4 className="text-lg font-black tracking-tight relative z-10">إرث آل سيف الرقمي</h4>
                 <p className="text-sm font-bold opacity-80 leading-relaxed relative z-10">هذا الحساب موثق لدى مجلس العائلة. بياناتك الشخصية محمية بخصوصية تامة ولا تظهر إلا لأعضاء المجلس المعتمدين.</p>
                 <div className="pt-4 relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                       Secure Connection
                    </div>
                 </div>
              </div>

              <div className="card-surface p-8 space-y-6 animate-fade-up" style={{ animationDelay: "400ms" }}>
                 <h4 className="text-xs font-black uppercase tracking-[0.2em] text-gold-primary">إحصائيات سريعة</h4>
                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <span className="text-sm font-bold text-muted-foreground">تاريخ الانضمام</span>
                       <span className="text-sm font-black text-primary">{new Date(createdAt).toLocaleDateString("ar-SA")}</span>
                    </div>
                    <div className="h-px bg-border/40" />
                    <div className="flex items-center justify-between">
                       <span className="text-sm font-bold text-muted-foreground">نوع الحساب</span>
                       <span className="text-sm font-black text-emerald-600">عضو نشط</span>
                    </div>
                 </div>
              </div>
           </div>

        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadAvatar(f);
            e.target.value = "";
          }}
        />
      </div>
    </AppShell>
  );
}

function Field({ label, icon, value, onChange, type = "text", placeholder, disabled = false }: any) {
  return (
    <div className="space-y-2">
       <label className="text-[10px] font-black text-muted-foreground mr-2 uppercase tracking-widest">{label}</label>
       <div className="relative group">
          {icon && <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gold-primary/40 group-focus-within:text-primary transition-colors">{icon}</div>}
          <input
            type={type}
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn(
              "w-full h-14 bg-muted/30 border border-border rounded-2xl font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm",
              icon ? "pr-14 pl-5" : "px-5",
              disabled && "opacity-50 cursor-not-allowed bg-muted/60"
            )}
          />
       </div>
    </div>
  );
}
