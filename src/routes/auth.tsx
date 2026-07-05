import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft, Send, X, Phone, User, Sparkles } from "lucide-react";
import logoAsset from "@/assets/alsaif-mark.png.asset.json";
import authBgAsset from "@/assets/alsaif-auth-bg.png.asset.json";
import palmWatermark from "@/assets/palm-watermark.png";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { useAppBackground } from "@/hooks/use-app-background";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { getPublicStats } from "@/lib/api/stats.functions";
import { BackgroundUploader } from "@/components/background-uploader";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "مجلس السيف — بوابة الدخول" },
      { name: "description", content: "بوابة الدخول الخاصة بأعضاء عائلة السيف." },
    ],
  }),
  component: AuthPage,
});

type AuthMode = "login" | "request" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState({ members: 0, completedTasks: 0 });
  const dynamicLogo = useSiteLogo();
  const { url: customBg } = useAppBackground("auth_bg");

  const [reqForm, setReqForm] = useState({
    firstName: "",
    fatherName: "",
    grandFatherName: "",
    phone: "",
    email: "",
    password: ""
  });

  const [msgIndex, setMsgIndex] = useState(0);
  const welcomeMessages = [
    "أهلاً بك في مجلس السيف الموقر",
    "نصل العائلة.. ونبض المجتمع",
    "حيث يُحفظ الإرث وتُبنى الروابط",
    "منصة التواصل الرسمية والخاصة"
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % welcomeMessages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });

    const fetchStats = async () => {
      try {
        const data = await getPublicStats();
        if (data && typeof data.members === 'number') {
           setCounts(data);
        }
      } catch (err) {
        console.error("Stats error", err);
      }
    };
    fetchStats();
  }, [navigate]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("تعذّر الدخول", { description: "يرجى التحقق من بيانات الاعتماد." });
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error("أدخل بريدك الإلكتروني أولاً");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("تعذّر إرسال الرابط", { description: error.message });
      return;
    }
    toast.success("تم إرسال رابط استعادة كلمة المرور إلى بريدك");
    setAuthMode("login");
  }

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("account_requests").insert({
      first_name: reqForm.firstName,
      father_name: reqForm.fatherName,
      grandfather_name: reqForm.grandFatherName,
      phone: reqForm.phone,
      email: reqForm.email,
      desired_password: reqForm.password,
      status: "pending"
    });
    setLoading(false);
    if (error) {
      toast.error("فشل إرسال الطلب", { description: error.message });
      return;
    }
    toast.success("تم إرسال طلبك بنجاح", { description: "سيتم مراجعة طلبك من قبل إدارة المجلس." });
    setAuthMode("login");
  }

  return (
    <div className="min-h-screen relative flex flex-col lg:flex-row bg-[#05070a] overflow-hidden" dir="rtl">

      {/* 1. Full-Height Login Pane (Right Side in RTL - Order matters for display) */}
      <div className="w-full lg:w-[500px] xl:w-[650px] min-h-screen bg-[#0d0f17] relative z-20 flex flex-col items-center justify-center p-8 sm:p-24 border-l border-white/5 shadow-[-50px_0_100px_rgba(0,0,0,0.6)]">

        {/* Mobile Backdrop Glow */}
        <div className="lg:hidden absolute inset-0 bg-gradient-to-b from-[#064e3b] to-[#0d0f17] -z-1 opacity-20" />

        {/* Palm Watermark Decoration */}
        <div className="absolute -left-10 -bottom-10 size-72 opacity-[0.03] pointer-events-none">
           <img src={palmWatermark} alt="" className="size-full object-contain brightness-0 invert" />
        </div>

        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, type: "spring", damping: 25 }}
          className="w-full max-w-md flex flex-col items-center"
        >
          {/* Logo Section */}
          <div className="mb-12 text-center flex flex-col items-center w-full">
             <div className="size-36 lg:size-48 bg-white rounded-[40px] lg:rounded-[56px] shadow-2xl p-6 lg:p-10 mb-8 relative overflow-hidden group/logo border-4 border-gold-primary/10">
                <div
                  className="size-full bg-contain bg-no-repeat bg-center transition-transform duration-1000 group-hover/logo:rotate-[360deg] scale-110"
                  style={{ backgroundImage: dynamicLogo ? `url(${dynamicLogo})` : `url(${logoAsset.url})` }}
                />
             </div>

             <h3 className="text-3xl lg:text-4xl font-black text-gold-primary tracking-tight">مجلس السيف</h3>
             <div className="flex items-center justify-center gap-3 mt-4 opacity-30">
                <div className="h-px w-8 bg-gold-primary" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white">الهوية الرقمية</span>
                <div className="h-px w-8 bg-gold-primary" />
             </div>
          </div>

          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <motion.form key="login" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={onLogin} className="w-full space-y-6">
                <div className="space-y-2">
                   <label className="text-[11px] font-black text-white/40 mr-1 uppercase tracking-widest">البريد الإلكتروني</label>
                   <div className="relative group">
                      <Mail className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-gold-primary/40 group-focus-within:text-gold-primary transition-colors" />
                      <input
                        type="email" required value={email} onChange={e => setEmail(e.target.value)}
                        className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl pr-14 pl-6 font-bold text-sm text-white focus:outline-none focus:ring-4 focus:ring-gold-primary/5 focus:border-gold-primary transition-all shadow-inner"
                        placeholder="example@mail.com"
                      />
                   </div>
                </div>

                <div className="space-y-2">
                   <div className="flex justify-between items-center px-1">
                      <label className="text-[11px] font-black text-white/40 uppercase tracking-widest">كلمة المرور</label>
                      <button type="button" onClick={() => setAuthMode("forgot")} className="text-[11px] font-black text-gold-primary hover:underline">نسيت الكلمة؟</button>
                   </div>
                   <div className="relative group">
                      <Lock className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-gold-primary/40 group-focus-within:text-gold-primary transition-colors" />
                      <input
                        type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                        className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl pr-14 pl-14 font-bold text-sm text-white focus:outline-none focus:ring-4 focus:ring-gold-primary/5 focus:border-gold-primary transition-all shadow-inner"
                        placeholder="••••••••••••"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold-primary transition-colors p-1">
                         {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                      </button>
                   </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full h-16 bg-gold-primary text-emerald-950 font-black rounded-2xl shadow-[0_15px_40px_-5px_rgba(212,175,55,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4 mt-2"
                >
                  {loading ? <Loader2 className="animate-spin size-6" /> : <><span>دخول للمجلس</span><ArrowLeft className="size-6 rotate-180" /></>}
                </button>

                <div className="pt-12 text-center border-t border-white/5 mt-6">
                   <p className="text-xs font-bold text-muted-foreground mb-6 uppercase tracking-widest opacity-60">ليس لديك حساب رسمي؟</p>
                   <button
                     type="button"
                     onClick={() => setAuthMode("request")}
                     className="w-full h-14 rounded-2xl bg-white/5 text-white font-black text-xs hover:bg-white/10 transition-all border border-white/10 shadow-sm"
                   >
                     تقديم طلب انضمام للعائلة
                   </button>
                </div>
              </motion.form>
            ) : mode === "forgot" ? (
              <motion.form key="forgot" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} onSubmit={onForgot} className="w-full space-y-6">
                <div className="flex justify-between items-center mb-2">
                   <h3 className="text-2xl font-black text-gold-primary tracking-tight">استعادة الحساب</h3>
                   <button type="button" onClick={() => setAuthMode("login")} className="size-10 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground hover:bg-rose-500 hover:text-white transition-all"><X size={22} /></button>
                </div>
                <p className="text-sm text-white/50 leading-relaxed">أدخل بريدك المسجل وسنرسل لك رابط التحديث فوراً.</p>
                <AuthField label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} placeholder="mail@example.com" icon={<Mail size={20} />} />
                <button
                  type="submit" disabled={loading}
                  className="w-full h-16 bg-gold-primary text-emerald-950 font-black rounded-2xl shadow-lg mt-6 flex items-center justify-center gap-3"
                >
                  {loading ? <Loader2 className="size-6 animate-spin" /> : <><Send size={20} /> <span>إرسال الرابط</span></>}
                </button>
              </motion.form>
            ) : (
              <motion.form key="request" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onSubmit={onRequest} className="w-full space-y-5 h-[450px] overflow-y-auto pr-3 no-scrollbar custom-scrollbar-pane" dir="rtl">
                <div className="flex justify-between items-center mb-6 sticky top-0 bg-[#0d0f17] z-10 py-2">
                   <h3 className="text-2xl font-black text-gold-primary tracking-tight">طلب عضوية</h3>
                   <button type="button" onClick={() => setAuthMode("login")} className="size-10 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground hover:bg-rose-500 hover:text-white transition-all"><X size={22} /></button>
                </div>

                <div className="grid grid-cols-1 gap-5">
                  <AuthField label="الاسم الأول" value={reqForm.firstName} onChange={(v: string) => setReqForm({...reqForm, firstName: v})} placeholder="الاسم الشخصي" icon={<User size={18} />} />
                  <div className="grid grid-cols-2 gap-4">
                    <AuthField label="اسم الأب" value={reqForm.fatherName} onChange={(v: string) => setReqForm({...reqForm, fatherName: v})} placeholder="الأب" />
                    <AuthField label="اسم الجد" value={reqForm.grandFatherName} onChange={(v: string) => setReqForm({...reqForm, grandFatherName: v})} placeholder="الجد" />
                  </div>
                  <AuthField label="رقم الجوال" value={reqForm.phone} onChange={(v: string) => setReqForm({...reqForm, phone: v})} placeholder="05xxxxxxxx" icon={<Phone size={18} />} />
                  <AuthField label="البريد الإلكتروني" type="email" value={reqForm.email} onChange={(v: string) => setReqForm({...reqForm, email: v})} placeholder="mail@example.com" icon={<Mail size={18} />} />
                  <AuthField label="كلمة المرور" type="password" value={reqForm.password} onChange={(v: string) => setReqForm({...reqForm, password: v})} placeholder="••••••••" icon={<Lock size={18} />} />
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full h-16 bg-gold-primary text-emerald-950 font-black rounded-2xl shadow-xl mt-6 flex items-center justify-center gap-3"
                >
                  {loading ? <Loader2 className="size-6 animate-spin" /> : <><Send size={20} /> <span>إرسال الطلب</span></>}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col items-center gap-2 opacity-20">
             <p className="text-[9px] font-black tracking-[0.5em] text-white uppercase">Alsaif Nexus • 2026</p>
          </div>
        </motion.div>
      </div>

      {/* 2. Welcoming Heritage Section (Left Side in RTL) */}
      <div className="hidden lg:flex flex-1 flex-col justify-center items-start p-12 xl:p-24 relative overflow-hidden bg-[#064e3b]">

        {/* Dynamic Background Image with Advanced Gradient Mask */}
        <motion.div
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.4 }}
          transition={{ duration: 2.5, ease: "easeOut" }}
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${customBg || authBgAsset.url})` }}
        />

        {/* Multi-layered Seamless Blend */}
        <div className="absolute inset-0 z-1 bg-gradient-to-l from-[#064e3b] via-[#064e3b]/80 to-transparent" />
        <div className="absolute inset-0 z-1 bg-gradient-to-t from-[#064e3b] via-transparent to-transparent opacity-60" />
        <div className="absolute inset-y-0 left-0 w-48 z-1 bg-gradient-to-r from-black/50 to-transparent" />

        {/* Animated Heritage Texture Overlay */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none z-2 mix-blend-overlay scale-150"
             style={{
               backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 0l20 40H20zM40 80L20 40h40zM0 40l40-20v40zM80 40L40 60V20z' fill='%23D4AF37' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
               backgroundSize: '100px 100px'
             }}
        />

        {/* Gold Dust Particles */}
        <div className="absolute inset-0 pointer-events-none z-3">
          {[...Array(20)].map((_, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: Math.random() * 100 + "%", y: "110%" }} animate={{ y: "-10%", opacity: [0, 0.4, 0] }} transition={{ duration: 15 + Math.random() * 20, repeat: Infinity, ease: "linear", delay: Math.random() * -20 }} className="absolute size-1.5 bg-gold-primary rounded-full blur-[1px]" />
          ))}
        </div>

        <div className="relative z-10 space-y-12 w-full max-w-4xl">
           <div className="space-y-8 text-right">
              <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.8 }} className="flex items-center gap-4">
                 <div className="h-0.5 w-20 bg-gold-primary shadow-[0_0_20px_rgba(212,175,55,0.6)]" />
                 <span className="text-sm font-black uppercase tracking-[0.5em] text-gold-primary">إرث يمتد.. ومستقبل يُبنى</span>
              </motion.div>

              <motion.h1
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 1, delay: 0.2 }}
                className="text-8xl xl:text-[11rem] font-black text-white tracking-tighter leading-none drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              >
                 عائلة<br />
                 <span className="text-transparent bg-clip-text bg-gradient-to-l from-gold-primary via-white/80 to-[#8E7745] animate-pulse">السيف</span>
              </motion.h1>

              <div className="h-16 overflow-hidden relative">
                 <AnimatePresence mode="wait">
                    <motion.p
                      key={msgIndex}
                      initial={{ y: 40, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -40, opacity: 0 }}
                      transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
                      className="text-3xl xl:text-5xl text-white/80 font-bold max-w-2xl leading-tight drop-shadow-lg"
                    >
                       {welcomeMessages[msgIndex]}
                    </motion.p>
                 </AnimatePresence>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-20 pt-10 border-t border-white/10 w-fit">
              <HeritageStat label="الأعضاء المسجلين" value={`${counts.members}`} delay={0.4} />
              <HeritageStat label="مبادرات مكتملة" value={`${counts.completedTasks}`} delay={0.6} />
           </div>

           {/* Floating Decorative Logo (Subtle Background element) */}
           <motion.div
             animate={{ rotate: [0, 360], scale: [1, 1.05, 1] }}
             transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
             className="pt-20 opacity-[0.08] pointer-events-none flex justify-center w-full"
           >
              <div className="size-[500px] border-[2px] border-dashed border-gold-primary/30 rounded-full flex items-center justify-center relative">
                 <div className="size-[400px] border-[1px] border-gold-primary/10 rounded-full" />
                 <div className="absolute size-64"
                      style={{
                        backgroundImage: dynamicLogo ? `url(${dynamicLogo})` : `url(${logoAsset.url})`,
                        backgroundSize: 'contain',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                        filter: 'brightness(0) invert(1)'
                      }}
                 />
              </div>
           </motion.div>
        </div>

        {/* Change Background Button (Visible for testing/admin) */}
        <div className="absolute bottom-10 left-10 z-50">
           <BackgroundUploader settingKey="auth_bg" label="تغيير الخلفية" className="bg-white/10 text-white/40 border-white/10 hover:bg-gold-primary hover:text-emerald-950 shadow-none transition-all" />
        </div>
      </div>

    </div>
  );
}

function HeritageStat({ label, value, delay = 0 }: { label: string, value: string, delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay }}
      className="space-y-2 group cursor-default"
    >
       <div className="flex items-baseline gap-2">
          <p className="text-7xl xl:text-9xl font-black text-white tabular-nums drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] group-hover:text-gold-primary transition-colors duration-700">
             {value}
          </p>
          <Sparkles className="size-6 text-gold-primary opacity-0 group-hover:opacity-100 transition-opacity animate-bounce" />
       </div>
       <p className="text-xs font-black uppercase tracking-[0.4em] text-gold-primary/60 group-hover:text-white transition-colors duration-500">
          {label}
       </p>
    </motion.div>
  );
}

function AuthField({ label, icon, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div className="space-y-2">
       <label className="text-[11px] font-black text-white/40 mr-1 uppercase tracking-widest">{label}</label>
       <div className="relative group">
          {icon && <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gold-primary/40 group-focus-within:text-gold-primary transition-colors">{icon}</div>}
          <input
            type={type} required value={value} onChange={(e) => onChange(e.target.value)}
            className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl font-bold text-sm text-white focus:outline-none focus:ring-4 focus:ring-gold-primary/5 focus:border-gold-primary transition-all pr-14 pl-6 shadow-sm"
            placeholder={placeholder}
          />
       </div>
    </div>
  );
}
