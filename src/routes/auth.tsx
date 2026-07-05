import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft, Send, X, Phone, User, Sparkles } from "lucide-react";
import logoAsset from "@/assets/alsaif-mark.png.asset.json";
import palmWatermark from "@/assets/palm-watermark.png";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
  const [counts, setCounts] = useState({ members: 0, tasks: 0 });
  const dynamicLogo = useSiteLogo();

  const [reqForm, setReqForm] = useState({
    firstName: "",
    fatherName: "",
    grandFatherName: "",
    phone: "",
    email: "",
    password: ""
  });

  const welcomeMessages = [
    "أهلاً بك في مجلس السيف الموقر",
    "نصل العائلة.. ونبض المجتمع",
    "حيث يُحفظ الإرث وتُبنى الروابط",
    "منصة التواصل الرسمية والخاصة"
  ];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });

    // Fetch stats for the welcome screen
    (async () => {
      const [{ count: mCount }, { count: tCount }] = await Promise.all([
        supabase.from("profiles").select("*", { count: 'exact', head: true }),
        supabase.from("tasks").select("*", { count: 'exact', head: true })
      ]);
      setCounts({ members: mCount || 0, tasks: tCount || 0 });
    })();
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
    <div className="min-h-screen relative flex items-center justify-center lg:justify-end bg-[#05070a] overflow-hidden" dir="rtl">

      {/* Deep Emerald Backdrop */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#064e3b] via-[#042d22] to-[#02140e]" />

      {/* Animated Heritage Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-1 mix-blend-overlay scale-150"
           style={{
             backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 0l20 40H20zM40 80L20 40h40zM0 40l40-20v40zM80 40L40 60V20z' fill='%23D4AF37' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
             backgroundSize: '80px 80px'
           }}
      />

      {/* Gold Dust Particles */}
      <div className="absolute inset-0 pointer-events-none z-1">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: Math.random() * 100 + "%", y: "110%" }}
            animate={{ y: "-10%", opacity: [0, 0.4, 0] }}
            transition={{ duration: 15 + Math.random() * 20, repeat: Infinity, ease: "linear", delay: Math.random() * -20 }}
            className="absolute size-1.5 bg-gold-primary rounded-full blur-[1px]"
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12 p-6 lg:p-20">

        {/* Left Side: Welcoming Text & Heritage Visuals (Visible only on Desktop) */}
        <div className="hidden lg:flex flex-1 flex-col items-start text-right space-y-10 animate-fade-up">
           <motion.div
             initial={{ x: 50, opacity: 0 }}
             animate={{ x: 0, opacity: 1 }}
             transition={{ duration: 0.8, ease: "easeOut" }}
             className="space-y-6"
           >
              <div className="flex items-center gap-4">
                 <div className="h-0.5 w-16 bg-gold-primary shadow-[0_0_15px_rgba(212,175,55,0.5)]" />
                 <span className="text-xs font-black uppercase tracking-[0.5em] text-gold-primary">مجلس عائلة السيف</span>
              </div>

              <h1 className="text-7xl xl:text-8xl font-black text-white tracking-tighter leading-tight drop-shadow-2xl">
                 نصل العائلة<br />
                 <span className="text-transparent bg-clip-text bg-gradient-to-l from-gold-primary to-[#8E7745]">ونبض المجتمع</span>
              </h1>

              <p className="text-xl xl:text-2xl text-white/50 font-medium max-w-xl leading-relaxed">
                 بوابة التواصل الرقمية الرسمية لأبناء عائلة السيف العريقة، حيث يُحفظ الإرث وتُبنى روابط المستقبل بوفاء واعتزاز.
              </p>
           </motion.div>

           <div className="grid grid-cols-2 gap-8 pt-6">
              <HeritageStat label="عضو نشط" value={`${counts.members}+`} />
              <HeritageStat label="مبادرة عائلية" value={`${counts.tasks}+`} />
           </div>

           {/* Floating Decorative Logo */}
           <motion.div
             animate={{
               y: [0, -20, 0],
               rotate: [0, 5, -5, 0]
             }}
             transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
             className="pt-10 opacity-30"
           >
              <div className="size-48 logo-alsaif grayscale brightness-200" style={{ '--logo-url': `url(${logoAsset.url})` } as any} />
           </motion.div>
        </div>

        {/* Right Side: Enhanced Login Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, x: 30 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative w-full max-w-[520px] bg-[#12141c]/90 backdrop-blur-3xl rounded-[60px] shadow-[0_60px_150px_rgba(0,0,0,0.7)] border-[1px] border-white/10 p-8 sm:p-16 flex flex-col items-center overflow-hidden lg:mr-10"
        >
          {/* Subtle Corner Decoration */}
          <div className="absolute top-0 right-0 size-32 bg-gold-primary/10 rounded-bl-[100px] blur-3xl pointer-events-none" />

          {/* Logo Section inside Card (Visible on Mobile, smaller on Desktop) */}
          <div className="mb-10 text-center flex flex-col items-center w-full">
             <div className="size-20 lg:size-24 bg-white rounded-[28px] shadow-2xl p-4 mb-6 relative overflow-hidden group/logo">
                <div
                  className="size-full bg-contain bg-no-repeat bg-center transition-transform duration-1000 group-hover/logo:rotate-[360deg]"
                  style={{ backgroundImage: dynamicLogo ? `url(${dynamicLogo})` : `url(${logoAsset.url})` }}
                />
             </div>

             <div className="lg:hidden">
                <h2 className="text-3xl font-black text-white tracking-tight">مجلس السيف</h2>
                <div className="flex items-center justify-center gap-2 mt-2 opacity-40">
                  <div className="h-[1px] w-4 bg-gold-primary" />
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-gold-primary text-center">الهوية الرقمية</span>
                  <div className="h-[1px] w-4 bg-gold-primary" />
                </div>
             </div>

             <h3 className="hidden lg:block text-2xl font-black text-gold-primary tracking-tight">تسجيل الدخول للمجلس</h3>
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
                  className="w-full h-16 bg-gold-primary text-emerald-950 font-black rounded-2xl shadow-[0_15px_40px_-5px_rgba(212,175,55,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4 mt-4"
                >
                  {loading ? <Loader2 className="animate-spin size-6" /> : <><span>دخول للمجلس</span><ArrowLeft className="size-6 rotate-180" /></>}
                </button>

                <div className="pt-10 text-center border-t border-white/5 mt-4">
                   <p className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-[0.2em]">ليس لديك حساب في المجلس؟</p>
                   <button
                     type="button"
                     onClick={() => setAuthMode("request")}
                     className="w-full h-14 rounded-2xl bg-white/5 text-white font-black text-xs hover:bg-white/10 transition-all border border-white/10"
                   >
                     تقديم طلب انضمام رسمي
                   </button>
                </div>
              </motion.form>
            ) : mode === "forgot" ? (
              <motion.form key="forgot" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} onSubmit={onForgot} className="w-full space-y-5">
                <div className="flex justify-between items-center mb-2">
                   <h3 className="text-2xl font-black text-gold-primary tracking-tight">استعادة الحساب</h3>
                   <button type="button" onClick={() => setAuthMode("login")} className="size-10 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground hover:bg-rose-500 hover:text-white transition-all"><X size={22} /></button>
                </div>
                <p className="text-sm text-white/50 leading-relaxed mb-4">أدخل بريدك المسجل وسنرسل لك رابط التحديث فوراً.</p>
                <AuthField label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} placeholder="mail@example.com" icon={<Mail size={20} />} />
                <button
                  type="submit" disabled={loading}
                  className="w-full h-16 bg-gold-primary text-emerald-950 font-black rounded-2xl shadow-lg mt-6 flex items-center justify-center gap-3"
                >
                  {loading ? <Loader2 className="size-6 animate-spin" /> : <><Send size={20} /> <span>إرسال الرابط</span></>}
                </button>
              </motion.form>
            ) : (
              <motion.form key="request" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onSubmit={onRequest} className="w-full space-y-5 h-[450px] overflow-y-auto pr-3 no-scrollbar">
                <div className="flex justify-between items-center mb-6 sticky top-0 bg-[#12141c]/95 backdrop-blur-xl z-10 py-2">
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
    </div>
  );
}

function HeritageStat({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-1">
       <p className="text-3xl font-black text-white tabular-nums">{value}</p>
       <p className="text-[10px] font-black uppercase tracking-widest text-gold-primary/60">{label}</p>
    </div>
  );
}

function AuthField({ label, icon, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div className="space-y-1.5">
       <label className="text-[11px] font-black text-white/40 mr-1 uppercase tracking-widest">{label}</label>
       <div className="relative group">
          {icon && <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gold-primary/40 group-focus-within:text-gold-primary transition-colors">{icon}</div>}
          <input
            type={type} required value={value} onChange={(e) => onChange(e.target.value)}
            className={cn(
              "w-full h-14 bg-white/5 border border-white/10 rounded-2xl font-bold text-sm text-white focus:outline-none focus:ring-4 focus:ring-gold-primary/5 focus:border-gold-primary transition-all shadow-sm",
              icon ? "pr-14 pl-6" : "px-6"
            )}
            placeholder={placeholder}
          />
       </div>
    </div>
  );
}
