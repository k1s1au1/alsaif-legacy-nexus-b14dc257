import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft, UserPlus, Send, X, Phone, User, Check } from "lucide-react";
import logoAsset from "@/assets/alsaif-mark.png.asset.json";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/auth")({
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
  const dynamicLogo = useSiteLogo();

  // Registration State
  const [reqForm, setReqForm] = useState({
    firstName: "",
    fatherName: "",
    grandFatherName: "",
    phone: "",
    email: "",
    password: ""
  });

  // Signature Messages
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
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
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
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10 bg-[#05070a] transition-colors duration-1000 overflow-hidden">

      {/* Deep Emerald Backdrop */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#064e3b] via-[#042f26] to-[#010a08]" />

      {/* Luxury Dust Particles */}
      <div className="absolute inset-0 pointer-events-none z-1">
        {[...Array(40)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: Math.random() * 100 + "%", y: Math.random() * 100 + "%" }}
            animate={{ y: [null, "-100%"], opacity: [0, 0.4, 0] }}
            transition={{ duration: 15 + Math.random() * 20, repeat: Infinity, ease: "linear", delay: Math.random() * -30 }}
            className="absolute size-[1.5px] bg-gold-primary rounded-full blur-[1px]"
          />
        ))}
      </div>

      {/* Main Card: Classic Ivory Royal Style */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[500px] md:max-w-[600px] bg-[#fdfcf7] rounded-[40px] shadow-[0_60px_150px_-20px_rgba(0,0,0,0.6)] border-[6px] border-double border-gold-primary/30 overflow-hidden"
      >
        {/* Decorative Corner Patterns */}
        <div className="absolute top-0 right-0 size-24 md:size-32 opacity-10 pointer-events-none">
           <svg viewBox="0 0 100 100" className="size-full fill-primary">
              <path d="M0,0 L100,0 L100,100 C100,100 60,100 0,0" />
           </svg>
        </div>
        <div className="absolute bottom-0 left-0 size-24 md:size-32 opacity-10 pointer-events-none rotate-180">
           <svg viewBox="0 0 100 100" className="size-full fill-primary">
              <path d="M0,0 L100,0 L100,100 C100,100 60,100 0,0" />
           </svg>
        </div>

        {/* Traditional Geometric Pattern Border (Subtle) */}
        <div className="absolute inset-0 border-[20px] border-transparent opacity-[0.03] pointer-events-none"
             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #064e3b 1px, transparent 0)', backgroundSize: '12px 12px' }} />

        <div className="relative z-10 p-8 sm:p-14 lg:p-20 flex flex-col h-full">

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-12">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="size-24 mb-8 flex items-center justify-center p-4 bg-white rounded-full shadow-2xl border-2 border-gold-primary/20 relative"
            >
              <AnimatePresence mode="wait">
                {dynamicLogo ? (
                  <motion.div key={dynamicLogo} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="size-full relative z-10 logo-alsaif" style={{ '--logo-url': `url(${dynamicLogo})` } as any} />
                ) : (
                  <Loader2 className="size-8 animate-spin text-primary/20" />
                )}
              </AnimatePresence>
            </motion.div>

            <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4" style={{ fontFamily: "'Reem Kufi', sans-serif" }}>مجلس السيف</h1>

            <div className="flex items-center gap-3 opacity-60">
              <div className="h-px w-8 bg-gold-primary" />
              <span className="text-[10px] font-black tracking-[0.4em] text-gold-primary uppercase">بوابة الدخول الرسمية</span>
              <div className="h-px w-8 bg-gold-primary" />
            </div>

            {/* Greeting */}
            <div className="h-10 mt-10 flex items-center justify-center overflow-hidden">
               <AnimatePresence mode="wait">
                  <motion.p
                    key={msgIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-2xl md:text-3xl text-primary/80"
                    style={{ fontFamily: "'Amiri', serif" }}
                  >
                    {welcomeMessages[msgIndex]}
                  </motion.p>
               </AnimatePresence>
            </div>
          </div>

          {/* Form */}
          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <motion.form key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={onLogin} className="space-y-6">
                <div className="space-y-2" dir="rtl">
                  <label className="text-xs font-black text-primary/50 mr-2 uppercase tracking-widest">البريد الإلكتروني</label>
                  <div className="relative group">
                    <Mail className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-gold-primary/40 group-focus-within:text-primary transition-colors" />
                    <input
                      type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-16 bg-white/60 border-2 border-border/50 rounded-2xl pr-14 pl-6 font-bold text-primary focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm"
                      placeholder="example@mail.com"
                    />
                  </div>
                </div>

                <div className="space-y-2" dir="rtl">
                  <label className="text-xs font-black text-primary/50 mr-2 uppercase tracking-widest">كلمة المرور</label>
                  <div className="relative group">
                    <Lock className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-gold-primary/40 group-focus-within:text-primary transition-colors" />
                    <input
                      type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-16 bg-white/60 border-2 border-border/50 rounded-2xl pr-14 pl-14 font-bold text-primary focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm"
                      placeholder="••••••••••••"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors">
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full h-16 bg-primary text-white font-black text-lg rounded-2xl shadow-xl hover:shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-4"
                >
                  {loading ? <Loader2 className="size-6 animate-spin" /> : <><span>دخول للمجلس</span><ArrowLeft className="size-6" /></>}
                </button>

                <div className="flex flex-col items-center pt-8 border-t border-border/40">
                   <p className="text-xs font-bold text-muted-foreground mb-3">ليس لديك حساب؟</p>
                   <button
                     type="button"
                     onClick={() => setAuthMode("request")}
                     className="px-8 py-3 rounded-full bg-gold-primary text-black font-black text-sm shadow-lg hover:scale-105 transition-all"
                   >
                     طلب انضمام للمجلس
                   </button>
                </div>
              </motion.form>
            ) : (
              <motion.form key="request" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={onRequest} className="space-y-5 h-[400px] overflow-y-auto pr-2 no-scrollbar" dir="rtl">
                <div className="flex justify-between items-center mb-4 sticky top-0 bg-[#fdfcf7] z-10 py-2">
                   <h3 className="text-xl font-black text-primary">طلب عضوية جديد</h3>
                   <button type="button" onClick={() => setAuthMode("login")} className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-rose-500 hover:text-white transition-all"><X size={18} /></button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <AuthField label="الاسم الأول" value={reqForm.firstName} onChange={(v: string) => setReqForm({...reqForm, firstName: v})} placeholder="الاسم كما في الهوية" icon={<User size={18} />} />
                  <div className="grid grid-cols-2 gap-4">
                    <AuthField label="اسم الأب" value={reqForm.fatherName} onChange={(v: string) => setReqForm({...reqForm, fatherName: v})} placeholder="الأب" />
                    <AuthField label="اسم الجد" value={reqForm.grandFatherName} onChange={(v: string) => setReqForm({...reqForm, grandFatherName: v})} placeholder="الجد" />
                  </div>
                  <AuthField label="رقم الجوال" value={reqForm.phone} onChange={(v: string) => setReqForm({...reqForm, phone: v})} placeholder="05xxxxxxxx" icon={<Phone size={18} />} />
                  <AuthField label="البريد الإلكتروني" type="email" value={reqForm.email} onChange={(v: string) => setReqForm({...reqForm, email: v})} placeholder="mail@example.com" icon={<Mail size={18} />} />
                  <AuthField label="كلمة المرور المطلوبة" type="password" value={reqForm.password} onChange={(v: string) => setReqForm({...reqForm, password: v})} placeholder="••••••••" icon={<Lock size={18} />} />
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full h-14 bg-primary text-white font-black rounded-xl shadow-lg mt-4 flex items-center justify-center gap-3"
                >
                  {loading ? <Loader2 className="size-5 animate-spin" /> : <><Send size={18} /> <span>إرسال طلب الانضمام</span></>}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Footer Logo/Mark */}
          <div className="mt-16 pt-8 border-t border-border flex flex-col items-center gap-2 opacity-20">
             <div className="size-6 logo-alsaif grayscale" style={{ '--logo-url': `url(${dynamicLogo || logoAsset.url})` } as any} />
             <p className="text-[9px] font-black tracking-[0.4em] text-primary uppercase">Alsaif Nexus — 2026</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AuthField({ label, icon, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div className="space-y-1.5" dir="rtl">
       <label className="text-[10px] font-black text-primary/40 mr-2 uppercase tracking-widest">{label}</label>
       <div className="relative group">
          {icon && <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gold-primary/40 group-focus-within:text-primary transition-colors">{icon}</div>}
          <input
            type={type} required value={value} onChange={(e) => onChange(e.target.value)}
            className={cn(
              "w-full h-12 bg-white/40 border border-border rounded-xl font-bold text-sm text-primary focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm",
              icon ? "pr-12 pl-4" : "px-4"
            )}
            placeholder={placeholder}
          />
       </div>
    </div>
  );
}
