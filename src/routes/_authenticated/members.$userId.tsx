import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import {
  ArrowRight,
  Calendar,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  User as UserIcon,
  Shield,
  Clock,
  ChevronLeft,
  Crown,
  History,
  Award
} from "lucide-react";
import { getMemberCredential } from "@/lib/api/member-credentials.functions";
import { PresenceDot, presenceFromLastSeen, presenceLabel } from "@/lib/presence";
import { toast } from "sonner";
import { roleLabel } from "@/hooks/use-user-role";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import palmWatermark from "@/assets/palm-watermark.png";

export const Route = createFileRoute("/_authenticated/members/$userId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ملف العضو — عائلة السيف" },
      { name: "description", content: "تفاصيل الملف الشخصي لعضو مجلس عائلة السيف." },
    ],
  }),
  component: MemberProfilePage,
});

type ProfileRow = {
  id: string;
  arabic_name: string | null;
  full_name: string | null;
  first_name: string | null;
  father_name: string | null;
  grandfather_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
};

function MemberProfilePage() {
  const { userId } = useParams({ from: "/_authenticated/members/$userId" });
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [credential, setCredential] = useState<{ email: string | null; password: string | null } | null>(null);
  const [credLoading, setCredLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const fetchCredential = useServerFn(getMemberCredential);

  const [me, setMe] = useState<{ name: string; role: string; initial: string; avatarPath: string | null }>({
    name: "...",
    role: "عضو",
    initial: "س",
    avatarPath: null,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();

      const [{ data: p }, { data: r }, { data: phoneVal }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
        supabase.rpc("get_member_phone" as any, { _user: userId }),
      ]);

      if (p) setProfile({ ...p, phone: (phoneVal as string | null) ?? null });
      setRole(r?.role ?? null);

      if (auth.user) {
        const [{ data: mine }, { data: adminCheck }] = await Promise.all([
          supabase.from("profiles").select("arabic_name, full_name, avatar_url").eq("id", auth.user.id).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", auth.user.id).eq("role", "admin").maybeSingle(),
        ]);
        const name = mine?.arabic_name || mine?.full_name || "عضو";
        setMe({ name, role: adminCheck ? "مسؤول تقني" : "عضو", initial: name[0], avatarPath: mine?.avatar_url ?? null });
        setIsAdmin(!!adminCheck);
      }
      setLoading(false);
    })();

    const loadPresence = async () => {
      const { data } = await supabase.from("user_presence").select("last_seen_at").eq("user_id", userId).maybeSingle();
      setLastSeen(data?.last_seen_at ?? null);
    };
    loadPresence();
    const interval = setInterval(loadPresence, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const presenceState = presenceFromLastSeen(lastSeen);
  const displayName = profile?.arabic_name || profile?.full_name || "عضو العائلة";

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-primary size-10" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/40 animate-pulse">جاري جلب الملف...</p>
      </div>
    </div>
  );

  if (!profile) return (
    <AppShell title="خطأ" user={me}>
      <div className="flex flex-col items-center justify-center py-40 gap-6 opacity-40">
        <UserIcon size={80} />
        <p className="text-xl font-black">لم يتم العثور على هذا العضو</p>
        <Link to="/members" className="btn-gold px-8 py-3 rounded-full text-sm font-black">العودة للأعضاء</Link>
      </div>
    </AppShell>
  );

  return (
    <AppShell title="ملف العضو" user={me}>
      <div className="max-w-4xl mx-auto space-y-10 pb-24 px-4 md:px-0" dir="rtl">

        {/* Navigation */}
        <Link to="/members" className="inline-flex items-center gap-2 text-xs font-black text-primary/60 hover:text-primary transition-all group">
          <div className="size-8 rounded-full bg-primary/5 flex items-center justify-center group-hover:-translate-x-1 transition-transform"><ArrowRight size={16} /></div>
          العودة لقائمة الأعضاء
        </Link>

        {/* Header Hero Section - Royal Emerald */}
        <section className="animate-fade-up">
           <div className="relative overflow-hidden rounded-[44px] bg-gradient-to-br from-primary via-[#0d2620] to-black p-8 md:p-16 text-white shadow-2xl border border-white/5">
              {/* Zakhrafa / Watermark */}
              <div className="absolute left-0 top-0 bottom-0 w-1/3 opacity-[0.04] pointer-events-none overflow-hidden">
                <img src={palmWatermark} alt="" className="h-full object-contain object-left-bottom scale-125" />
              </div>

              <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                 {/* Large Royal Avatar */}
                 <div className="relative group shrink-0">
                    <div className="absolute inset-0 rounded-full bg-gold-primary/20 blur-3xl group-hover:bg-gold-primary/30 transition-all duration-1000" />
                    <div className="relative size-40 md:size-60 rounded-full p-2 bg-gradient-to-br from-gold-primary via-transparent to-gold-primary shadow-2xl overflow-hidden ring-4 ring-white/5">
                       <div className="size-full rounded-full bg-[#fdfcf7] p-1 overflow-hidden relative">
                          <UserAvatar
                            path={profile.avatar_url}
                            name={displayName}
                            className="size-full object-cover rounded-full"
                            userId={profile.id}
                            presenceDotClassName="absolute bottom-2 left-2 size-10 ring-8 ring-[#fdfcf7] shadow-2xl"
                          />
                       </div>
                    </div>
                 </div>

                 <div className="flex-1 text-center md:text-right space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-gold-primary/10 border border-gold-primary/20 text-gold-primary">
                       {role === 'chairman' ? <Crown size={12} /> : <Shield size={12} />}
                       <span className="text-[10px] font-black uppercase tracking-widest">{roleLabel(role)}</span>
                    </div>
                    <h2 className="text-4xl md:text-7xl font-black tracking-tighter leading-tight drop-shadow-2xl">{displayName}</h2>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                       <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/5 text-[11px] font-black">
                          <PresenceDot state={presenceState} withRing={false} className="size-2" />
                          <span className="opacity-70">{presenceLabel(presenceState)}</span>
                       </div>
                       {presenceState === 'offline' && lastSeen && (
                         <div className="flex items-center gap-2 text-[10px] font-bold text-white/40">
                            <Clock size={12} />
                            <span>شوهد {new Date(lastSeen).toLocaleDateString("ar-SA")}</span>
                         </div>
                       )}
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* Information Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Primary Info Card */}
           <section className="lg:col-span-2 space-y-6 animate-fade-up" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center gap-3 px-2">
                 <h3 className="text-xs font-black text-primary/40 uppercase tracking-[0.3em]">البيانات التعريفية</h3>
                 <div className="h-px flex-1 bg-border/60" />
              </div>

              <div className="card-surface p-10 grid grid-cols-1 md:grid-cols-2 gap-10 relative overflow-hidden border-2">
                 {/* Traditional Ornament Corner */}
                 <div className="absolute -top-6 -right-6 size-24 bg-primary/5 rounded-full blur-3xl" />

                 <ProfileField label="الاسم الأول" value={profile.first_name || profile.arabic_name?.split(' ')[0]} icon={<UserIcon />} />
                 <ProfileField label="اسم الأب" value={profile.father_name || profile.arabic_name?.split(' ')[1]} icon={<UserIcon />} />
                 <ProfileField label="اسم الجد" value={profile.grandfather_name || profile.arabic_name?.split(' ')[2]} icon={<UserIcon />} />
                 <ProfileField label="رقم الجوال" value={profile.phone} icon={<Phone />} isPhone />

                 <div className="md:col-span-2 pt-6 border-t border-border/40">
                    <ProfileField
                       label="تاريخ الانضمام للمجلس"
                       value={new Date(profile.created_at).toLocaleDateString("ar-SA", { year: 'numeric', month: 'long', day: 'numeric' })}
                       icon={<Calendar />}
                    />
                 </div>
              </div>
           </section>

           {/* Achievements / Status Sidebar */}
           <section className="space-y-6 animate-fade-up" style={{ animationDelay: "200ms" }}>
              <div className="flex items-center gap-3 px-2">
                 <h3 className="text-xs font-black text-primary/40 uppercase tracking-[0.3em]">حالة العضوية</h3>
                 <div className="h-px flex-1 bg-border/60" />
              </div>

              <div className="card-surface p-8 space-y-8">
                 <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">الرتبة في المجلس</p>
                    <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-2xl border border-border/40">
                       <div className={cn(
                          "size-12 rounded-full flex items-center justify-center shadow-lg",
                          role === 'chairman' ? "bg-emerald-950 text-gold-primary" : "bg-primary text-white"
                       )}>
                          {role === 'chairman' ? <Crown size={24} /> : <Award size={24} />}
                       </div>
                       <div>
                          <p className="text-sm font-black text-primary">{roleLabel(role)}</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">عضوية رسمية مفعلة</p>
                       </div>
                    </div>

                    {/* NEW NOMINATION BUTTON - HIGH VISIBILITY */}
                    {role !== 'chairman' && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={async () => {
                          const confirmMsg = `هل تود فتح باب "الشورى الكبرى" لترشيح ${displayName} رئيساً للمجلس؟`;
                          if (!confirm(confirmMsg)) return;

                          const pollData = {
                            question: `هل تؤيد انتقال رئاسة المجلس إلى ${displayName}؟`,
                            options: ["نعم، أؤيد بشدة", "لا، أفضّل الوضع الحالي"],
                            type: "leadership_shura",
                            target_uid: userId,
                            target_name: displayName,
                            threshold: 70
                          };

                          const { data: userData } = await supabase.auth.getUser();

                          const { error } = await supabase.from("majlis_posts").insert({
                            title: `شورى عاجلة: ترشيح ${displayName}`,
                            body: `---poll:${JSON.stringify(pollData)}---`,
                            kind: "announcement",
                            author_id: userData.user?.id
                          });

                          if (error) {
                            toast.error("حدث خطأ أثناء فتح باب الشورى");
                          } else {
                            toast.success("تم إرسال طلب الترشيح للعائلة بنجاح");
                            if (typeof window !== 'undefined') {
                               window.dispatchEvent(new CustomEvent("island:show", {
                                  detail: { message: "بدأت شورى الرئاسة الآن", status: "success" }
                               }));
                            }
                          }
                        }}
                        className="w-full py-4 rounded-2xl bg-gold-primary text-emerald-950 font-black text-xs uppercase tracking-widest shadow-xl shadow-gold-primary/20 hover:brightness-110 transition-all flex items-center justify-center gap-3 border-2 border-white/20"
                      >
                         <Crown size={16} /> ترشيح لرئاسة المجلس
                      </motion.button>
                    )}
                 </div>

                 <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">النشاط العائلي</p>
                    <div className="grid grid-cols-2 gap-3">
                       <StatMini label="مبادرات" value="0" icon={<Award />} color="text-amber-500" />
                       <StatMini label="إرث" value="0" icon={<History />} color="text-indigo-500" />
                    </div>
                 </div>
              </div>
           </section>
        </div>

        {/* Admin Credentials Panel */}
        {isAdmin && (
          <section className="animate-fade-up border-2 border-gold-primary/20 rounded-[40px] overflow-hidden" style={{ animationDelay: "300ms" }}>
            <div className="bg-gold-primary/5 p-8 border-b border-gold-primary/10 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <KeyRound className="text-gold-primary size-6" />
                  <div>
                    <h3 className="text-lg font-black text-primary tracking-tight">بيانات الدخول</h3>
                    <p className="text-[10px] font-black text-gold-primary uppercase tracking-widest">إدارة الدخول (للمسؤول فقط)</p>
                  </div>
               </div>
            </div>

            <div className="bg-[#fdfcf7] p-8 md:p-12 space-y-8">
               {credential ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ProfileField label="البريد الإلكتروني" value={credential.email} icon={<Mail />} />
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">كلمة المرور المؤقتة</label>
                       <div className="relative group">
                          <KeyRound className="absolute right-5 top-1/2 -translate-y-1/2 text-gold-primary size-5" />
                          <div className="w-full h-14 bg-muted/40 border-2 border-border rounded-2xl flex items-center pr-14 pl-6 font-bold text-primary">
                             {showPwd ? credential.password : "••••••••••••"}
                             <button onClick={() => setShowPwd(!showPwd)} className="mr-auto text-primary/40 hover:text-primary transition-colors">
                                {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                             </button>
                          </div>
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-8 bg-muted/20 rounded-3xl border-2 border-dashed border-border/60">
                    <p className="text-sm font-bold text-muted-foreground text-center md:text-right max-w-sm">يمكنك استرجاع بيانات الدخول التي تم إنشاؤها للعضو عند تسجيله في المجلس.</p>
                    <button
                      disabled={credLoading}
                      onClick={async () => {
                        setCredLoading(true);
                        try {
                           const res = await fetchCredential({ data: { userId } });
                           setCredential(res);
                        } catch { toast.error("تعذر جلب البيانات"); }
                        finally { setCredLoading(false); }
                      }}
                      className="btn-gold px-10 py-4 rounded-2xl font-black text-sm shadow-xl flex items-center gap-3"
                    >
                      {credLoading ? <Loader2 className="animate-spin size-5" /> : <KeyRound size={20} />}
                      استرجاع البيانات
                    </button>
                 </div>
               )}
               <p className="text-[10px] font-black text-rose-500 italic text-center opacity-70 leading-relaxed">
                  * هذه البيانات سرية للغاية وخاصة بإدارة المجلس. لا تظهر إلا كلمة المرور المبدئية التي تم تسجيلها في النظام.
               </p>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function ProfileField({ label, value, icon, isPhone }: any) {
  return (
    <div className="space-y-2">
       <div className="flex items-center gap-2 mb-1 px-1">
          <div className="text-gold-primary size-3">{icon}</div>
          <label className="text-[10px] font-black uppercase tracking-widest text-primary/40">{label}</label>
       </div>
       <div className={cn(
         "w-full h-16 bg-muted/20 border-2 border-border/50 rounded-2xl flex items-center px-6 text-lg font-black text-primary shadow-sm",
         isPhone && "tabular-nums"
       )}>
          {value || <span className="opacity-20 italic">غير مسجل</span>}
       </div>
    </div>
  );
}

function StatMini({ label, value, icon, color }: any) {
  return (
    <div className="bg-muted/20 border border-border/40 p-4 rounded-2xl flex items-center gap-3">
       <div className={cn("size-8 rounded-lg bg-white shadow-sm flex items-center justify-center", color)}>
          {icon}
       </div>
       <div>
          <p className="text-[10px] font-black text-primary/40 uppercase leading-none mb-1">{label}</p>
          <p className="text-sm font-black text-primary leading-none">{value}</p>
       </div>
    </div>
  );
}
