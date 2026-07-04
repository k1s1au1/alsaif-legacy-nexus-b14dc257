import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft, Send, X, Phone, User } from "lucide-react";
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
  const dynamicLogo = useSiteLogo();

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
    <div className="min-h-screen relative flex items-center justify-center px-4 py-8 bg-[#05070a] overflow-hidden">

      {/* Background Layer */}
      <div className="absolute inset-0 z-0 bg-[#064e3b]" />

      {/* Gold Dust Particles */}
      <div className="absolute inset-0 pointer-events-none z-1">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: Math.random() * 100 + "%", y: "110%" }}
            animate={{ y: "-10%", opacity: [0, 0.5, 0] }}
            transition={{ duration: 10 + Math.random() * 15, repeat: Infinity, ease: "linear", delay: Math.random() * -20 }}
            className="absolute size-1 bg-gold-primary rounded-full blur-[0.5px]"
          />
        ))}
      </div>

      {/* Main Card: Compact & Premium */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-[440px] bg-[#fdfcf7]/95 backdrop-blur-2xl rounded-[48px] shadow-[0_40px_100px_rgba(0,0,0,0.5)] border-[3px] border-gold-primary/20 overflow-hidden"
      >
        {/* Palm Watermark Decoration */}
        <div className="absolute -left-10 -bottom-10 size-64 opacity-[0.03] pointer-events-none">
           <img src={palmWatermark} alt="" className="size-full object-contain" />
        </div>

        <div className="relative z-10 p-8 sm:p-12 flex flex-col items-center">

          {/* Logo Section */}
          <div className="mb-10 text-center flex flex-col items-center">
             <div className="size-20 bg-white rounded-[24px] shadow-xl border border-gold-primary/10 p-4 mb-6 relative group overflow-hidden">
                <div className="absolute inset-0 bg-gold-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="size-full logo-alsaif" style={{ "--logo-url": dynamicLogo ? `url(${dynamicLogo})` : `url(${logoAsset.url})` } as any} />
             </div>

             <h1 className="text-3xl font-black text-primary tracking-tight" style={{ fontFamily: "'Reem Kufi', sans-serif" }}>مجلس السيف</h1>
             <div className="flex items-center gap-2 mt-1 opacity-40">
                <div className="h-[1px] w-4 bg-gold-primary" />
                <span className="text-[8px] font-black uppercase tracking-[0.4em] text-gold-primary">الهوية الرقمية</span>
                <div className="h-[1px] w-4 bg-gold-primary" />
             </div>

             <div className="h-8 mt-6 flex items-center justify-center">
                <AnimatePresence mode="wait">
                   <motion.p
                     key={msgIndex}
                     initial={{ opacity: 0, y: 5 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -5 }}
                     className="text-lg md:text-xl text-primary/60 font-medium"
                     style={{ fontFamily: "'Amiri', serif" }}
                   >
                     {welcomeMessages[msgIndex]}
                   </motion.p>
                </AnimatePresence>
             </div>
          </div>

          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <motion.form key="login" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={onLogin} className="w-full space-y-5">
                <div className="space-y-1.5" dir="rtl">
                   <label className="text-[10px] font-black text-primary/40 mr-1 uppercase tracking-widest">البريد الإلكتروني</label>
                   <div className="relative group">
                      <Mail className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-gold-primary/40 group-focus-within:text-primary transition-colors" />
                      <input
                        type="email" required value={email} onChange={e => setEmail(e.target.value)}
                        className="w-full h-14 bg-white/50 border border-border rounded-2xl pr-12 pl-4 font-bold text-sm text-primary focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-inner"
                        placeholder="example@mail.com"
                      />
                   </div>
                </div>

                <div className="space-y-1.5" dir="rtl">
                   <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">كلمة المرور</label>
                      <button type="button" onClick={() => setAuthMode("forgot")} className="text-[10px] font-black text-gold-primary hover:underline">نسيت الكلمة؟</button>
                   </div>
                   <div className="relative group">
                      <Lock className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-gold-primary/40 group-focus-within:text-primary transition-colors" />
                      <input
                        type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                        className="w-full h-14 bg-white/50 border border-border rounded-2xl pr-12 pl-12 font-bold text-sm text-primary focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-inner"
                        placeholder="••••••••••••"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors p-1">
                         {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                   </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4"
                >
                  {loading ? <Loader2 className="animate-spin size-5" /> : <><span>دخول للمجلس</span><ArrowLeft className="size-5" /></>}
                </button>

                <div className="pt-8 text-center">
                   <p className="text-[10px] font-bold text-muted-foreground mb-4 uppercase tracking-[0.2em]">ليس لديك حساب في المجلس؟</p>
                   <button
                     type="button"
                     onClick={() => setAuthMode("request")}
                     className="btn-gold px-10 py-3.5 rounded-full text-xs font-black shadow-2xl shadow-gold-primary/30"
                   >
                     تقديم طلب انضمام رسمي
                   </button>
                </div>
              </motion.form>
            ) : mode === "forgot" ? (
              <motion.form key="forgot" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={onForgot} className="w-full space-y-4" dir="rtl">
                <div className="flex justify-between items-center mb-2">
                   <h3 className="text-xl font-black text-primary">استعادة الحساب</h3>
                   <button type="button" onClick={() => setAuthMode("login")} className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-rose-500 hover:text-white transition-all"><X size={18} /></button>
                </div>
                <p className="text-xs font-bold text-muted-foreground leading-relaxed">أدخل بريدك المسجل وسنرسل لك رابط التحديث فوراً.</p>
                <AuthField label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} placeholder="mail@example.com" icon={<Mail size={16} />} />
                <button
                  type="submit" disabled={loading}
                  className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-lg mt-4 flex items-center justify-center gap-3"
                >
                  {loading ? <Loader2 className="size-5 animate-spin" /> : <><Send size={18} /> <span>إرسال الرابط</span></>}
                </button>
              </motion.form>
            ) : (
              <motion.form key="request" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={onRequest} className="w-full space-y-4 h-[380px] overflow-y-auto pr-2 no-scrollbar" dir="rtl">
                <div className="flex justify-between items-center mb-4 sticky top-0 bg-[#fdfcf7] z-10 py-2">
                   <h3 className="text-xl font-black text-primary">طلب عضوية جديد</h3>
                   <button type="button" onClick={() => setAuthMode("login")} className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-rose-500 hover:text-white transition-all"><X size={18} /></button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <AuthField label="الاسم الأول" value={reqForm.firstName} onChange={(v: string) => setReqForm({...reqForm, firstName: v})} placeholder="الاسم الشخصي" icon={<User size={16} />} />
                  <div className="grid grid-cols-2 gap-3">
                    <AuthField label="اسم الأب" value={reqForm.fatherName} onChange={(v: string) => setReqForm({...reqForm, fatherName: v})} placeholder="الأب" />
                    <AuthField label="اسم الجد" value={reqForm.grandFatherName} onChange={(v: string) => setReqForm({...reqForm, grandFatherName: v})} placeholder="الجد" />
                  </div>
                  <AuthField label="رقم الجوال" value={reqForm.phone} onChange={(v: string) => setReqForm({...reqForm, phone: v})} placeholder="05xxxxxxxx" icon={<Phone size={16} />} />
                  <AuthField label="البريد الإلكتروني" type="email" value={reqForm.email} onChange={(v: string) => setReqForm({...reqForm, email: v})} placeholder="mail@example.com" icon={<Mail size={16} />} />
                  <AuthField label="كلمة المرور" type="password" value={reqForm.password} onChange={(v: string) => setReqForm({...reqForm, password: v})} placeholder="••••••••" icon={<Lock size={16} />} />
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl mt-4 flex items-center justify-center gap-3"
                >
                  {loading ? <Loader2 className="size-5 animate-spin" /> : <><Send size={18} /> <span>إرسال الطلب</span></>}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="mt-12 pt-6 border-t border-border/40 flex flex-col items-center gap-2 opacity-20">
             <div className="size-5 logo-alsaif grayscale opacity-50" style={{ '--logo-url': `url(${logoAsset.url})` } as any} />
             <p className="text-[8px] font-black tracking-[0.5em] text-primary uppercase">Alsaif Nexus • 2026</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AuthField({ label, icon, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div className="space-y-1.5" dir="rtl">
       <label className="text-[10px] font-black text-primary/40 mr-1 uppercase tracking-widest">{label}</label>
       <div className="relative group">
          {icon && <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gold-primary/40 group-focus-within:text-primary transition-colors">{icon}</div>}
          <input
            type={type} required value={value} onChange={(e) => onChange(e.target.value)}
            className={cn(
              "w-full h-12 bg-white/40 border border-border rounded-xl font-bold text-sm text-primary focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm",
              icon ? "pr-11 pl-4" : "px-4"
            )}
            placeholder={placeholder}
          />
       </div>
    </div>
  );
}
