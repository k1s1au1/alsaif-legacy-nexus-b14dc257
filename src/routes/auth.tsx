import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft, UserPlus, Send, X, Phone, User } from "lucide-react";
import logoAsset from "@/assets/alsaif-mark.png.asset.json";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { useAppBackground } from "@/hooks/use-app-background";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/auth")({
  // T-Notify: Triggering latest brand enhancements
  head: () => ({
    meta: [
      { title: "مجلس السيف — تسجيل الدخول" },
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

  // Welcome Messages
  const [msgIndex, setMsgIndex] = useState(0);
  const welcomeMessages = [
    "أهلاً بك في مجلس السيف",
    "حيث يجتمع التاريخ بالمستقبل",
    "منصة العائلة الرسمية والخاصة",
    "نصل العائلة، نحفظ الإرث، نبني المجتمع"
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % welcomeMessages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Request form fields
  const [reqFirstName, setReqFirstName] = useState("");
  const [reqFatherName, setReqFatherName] = useState("");
  const [reqGrandName, setReqGrandFatherName] = useState("");
  const [reqPhone, setReqPhone] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqPassword, setReqPassword] = useState("");
  const [reqNote, setReqNote] = useState("");

  const { url: authBg } = useAppBackground("auth_bg");

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
      toast.error("تعذّر الدخول", { description: "تأكد من البيانات المعتمدة من الإدارة." });
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  async function onRequestAccount(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("account_requests").insert({
      first_name: reqFirstName,
      father_name: reqFatherName,
      grandfather_name: reqGrandName,
      phone: reqPhone,
      email: reqEmail,
      desired_password: reqPassword,
      note: reqNote,
      terms_accepted: true
    });
    setLoading(false);
    if (error) {
      toast.error("تعذر إرسال الطلب", { description: error.message });
      return;
    }
    toast.success("تم إرسال طلبك بنجاح", { description: "سيتم مراجعة الطلب من قبل الإدارة وإشعارك قريباً." });
    setAuthMode("login");
  }

  async function onForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("حدث خطأ", { description: error.message });
      return;
    }
    toast.success("تم إرسال رابط الاستعادة", { description: "يرجى التحقق من بريدك الإلكتروني." });
    setAuthMode("login");
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10 bg-[#fdfcf7] dark:bg-[#05070a] transition-colors duration-700 overflow-hidden">

      {/* Full-Screen Background Image (Immersive for Laptop) */}
      {authBg && (
        <div
          className="absolute inset-0 z-0 bg-center bg-cover bg-no-repeat transition-opacity duration-1000"
          style={{ backgroundImage: `url(${authBg})` }}
        >
          <div className="absolute inset-0 bg-white/30 dark:bg-black/50 backdrop-blur-[1px]" />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#fdfcf7] via-transparent to-[#fdfcf7] dark:from-[#05070a] dark:via-transparent dark:to-[#05070a] opacity-90" />
        </div>
      )}

      {/* Stronger Brand Aura for visibility on Laptops */}
      <div className="absolute inset-0 pointer-events-none z-1">
        <motion.div
          animate={{
            scale: [1, 1.4, 1],
            x: [0, 100, 0],
            y: [0, 50, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] right-[-10%] size-[1200px] rounded-full bg-primary/25 blur-[180px] dark:bg-primary/15"
        />
        <motion.div
          animate={{
            scale: [1.4, 1, 1.4],
            x: [0, -100, 0],
            y: [0, -50, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-10%] left-[-10%] size-[1200px] rounded-full bg-gold-primary/30 blur-[200px] dark:bg-gold-primary/20"
        />
      </div>

      {/* Heritage Pattern Layer - Increased Visibility */}
      <div
        className="absolute inset-0 opacity-[0.06] dark:opacity-[0.1] pointer-events-none z-1"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='140' height='140' viewBox='0 0 140 140' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M70 0 L140 70 L70 140 L0 70 Z' fill='none' stroke='%238e7745' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '140px 140px'
        }}
      />

      {/* Floating Gold Dust Effect - Larger and More Opaque */}
      <div className="absolute inset-0 pointer-events-none z-1">
        {[...Array(50)].map((_, i) => (
          <motion.div
            key={i}
            initial={{
              opacity: 0,
              x: Math.random() * 100 + "%",
              y: Math.random() * 100 + "%"
            }}
            animate={{
              y: [null, "-120%"],
              x: [null, (Math.random() - 0.5) * 50 + "%"],
              opacity: [0, 0.7, 0]
            }}
            transition={{
              duration: 15 + Math.random() * 30,
              repeat: Infinity,
              ease: "linear",
              delay: Math.random() * -30
            }}
            className="absolute size-[3px] bg-[#d4af37] rounded-full blur-[0.5px]"
            style={{ boxShadow: '0 0 15px #d4af37, 0 0 5px #ffffff' }}
          />
        ))}
      </div>

      <div
        className="relative z-10 w-full max-w-[480px] md:max-w-[560px] lg:max-w-[620px] bg-white/40 dark:bg-black/50 backdrop-blur-3xl rounded-[48px] shadow-[0_48px_120px_-24px_rgba(0,0,0,0.4)] animate-fade-up overflow-hidden border border-white/40 dark:border-white/10 transition-all duration-700"
      >
        <div className="relative z-10 p-8 sm:p-12 lg:p-16 flex flex-col h-full">
          {/* Header Section */}
          <div className="flex flex-col items-center text-center mb-10">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="size-28 mb-8 flex items-center justify-center p-5 bg-white/40 dark:bg-white/10 backdrop-blur-xl rounded-[36px] shadow-2xl border border-white/40 relative group overflow-hidden"
            >
              <div className="absolute inset-0 bg-gold-primary/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <AnimatePresence mode="wait">
                {dynamicLogo ? (
                  <motion.div
                    key={dynamicLogo}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="size-full relative z-10 logo-alsaif"
                    style={{
                      '--logo-url': `url(${dynamicLogo})`
                    } as any}
                  />
                ) : (
                  <motion.div
                    key="loader"
                    exit={{ opacity: 0 }}
                    className="size-full flex items-center justify-center"
                  >
                    <Loader2 className="size-8 animate-spin text-gold-primary" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            <h1 className="text-4xl font-black text-primary mb-2 tracking-tight">مجلس السيف</h1>
            <p className="text-[12px] font-black tracking-[0.5em] text-gold-primary uppercase mt-1">عائلة السيف · بوابة خاصة</p>

            {/* Dynamic Welcome Message */}
            <div className="h-10 mt-6 flex items-center justify-center overflow-hidden">
               <AnimatePresence mode="wait">
                  <motion.p
                    key={msgIndex}
                    initial={{ y: 25, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -25, opacity: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="text-base font-bold text-primary/80 italic"
                  >
                    {welcomeMessages[msgIndex]}
                  </motion.p>
               </AnimatePresence>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                <form onSubmit={onLogin} className="space-y-6">
                  <div className="space-y-2" dir="rtl">
                    <label className="text-xs font-black text-white mr-4 uppercase tracking-widest">البريد الإلكتروني</label>
                    <div className="relative group">
                      <Mail className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-gold-primary group-focus-within:text-white transition-colors" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-16 bg-white/10 dark:bg-black/40 border-2 border-white/30 dark:border-white/20 rounded-2xl pr-14 pl-5 font-bold text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-4 focus:ring-gold-primary/20 focus:border-gold-primary transition-all shadow-xl backdrop-blur-md"
                        placeholder="البريد الإلكتروني..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2" dir="rtl">
                    <label className="text-xs font-black text-white mr-4 uppercase tracking-widest">كلمة المرور</label>
                    <div className="relative group">
                      <Lock className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-gold-primary group-focus-within:text-white transition-colors" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-16 bg-white/10 dark:bg-black/40 border-2 border-white/30 dark:border-white/20 rounded-2xl pr-14 pl-14 font-bold text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-4 focus:ring-gold-primary/20 focus:border-gold-primary transition-all shadow-xl backdrop-blur-md"
                        placeholder="••••••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-5 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-2">
                    <label className="flex items-center gap-3 cursor-pointer text-sm font-bold text-muted-foreground select-none">
                      <input type="checkbox" className="size-5 rounded-lg border-border text-primary focus:ring-primary" />
                      تذكرني
                    </label>
                    <button
                      type="button"
                      onClick={() => setAuthMode("forgot")}
                      className="text-sm font-black text-gold-primary hover:text-primary transition-colors"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-16 bg-primary text-primary-foreground font-black text-lg rounded-2xl shadow-[0_20px_40px_-10px_rgba(6,78,59,0.3)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-4"
                  >
                    {loading ? <Loader2 className="size-6 animate-spin" /> : (
                      <>
                        <span>دخول إلى المجلس</span>
                        <ArrowLeft className="size-6" />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-6">
                    <button
                      type="button"
                      onClick={() => setAuthMode("request")}
                      className="text-base font-black text-primary hover:underline flex items-center justify-center gap-3 mx-auto"
                    >
                      <UserPlus size={20} />
                      طلب إنشاء حساب جديد
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : mode === "request" ? (
              <motion.div
                key="request"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-2" dir="rtl">
                   <h2 className="text-lg font-black text-primary uppercase tracking-widest">طلب انضمام للمجلس</h2>
                   <button onClick={() => setAuthMode("login")} className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-primary transition-all shadow-md"><X size={20} /></button>
                </div>

                <form onSubmit={onRequestAccount} className="space-y-4 max-h-[60vh] md:max-h-none overflow-y-auto md:overflow-visible no-scrollbar px-1" dir="rtl">
                   <div className="grid grid-cols-1 gap-4">
                      <ReqField label="الاسم الأول" icon={<User />} value={reqFirstName} onChange={setReqFirstName} placeholder="مثال: سعود" />
                      <div className="grid grid-cols-2 gap-3">
                         <ReqField label="اسم الأب" value={reqFatherName} onChange={setReqFatherName} placeholder="..." />
                         <ReqField label="اسم الجد" value={reqGrandName} onChange={setReqGrandFatherName} placeholder="..." />
                      </div>
                      <ReqField label="رقم الجوال" icon={<Phone />} value={reqPhone} onChange={setReqPhone} placeholder="05xxxxxxxx" type="tel" />
                      <ReqField label="البريد الإلكتروني" icon={<Mail />} value={reqEmail} onChange={setReqEmail} placeholder="البريد الإلكتروني..." type="email" />
                      <ReqField label="كلمة المرور المقترحة" icon={<Lock />} value={reqPassword} onChange={setReqPassword} placeholder="••••••••" type="password" />
                      <div className="space-y-2">
                         <label className="text-xs font-black text-primary/60 mr-2 uppercase tracking-widest">ملاحظة إضافية</label>
                         <textarea
                           value={reqNote} onChange={(e) => setReqNote(e.target.value)}
                           className="w-full bg-white/40 dark:bg-black/30 border border-white/40 dark:border-white/20 rounded-2xl p-5 font-bold text-base focus:outline-none focus:border-primary transition-all resize-none shadow-inner"
                           rows={3} placeholder="صلة القرابة أو أي معلومات إضافية..."
                         />
                      </div>
                   </div>

                   <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-16 bg-primary text-primary-foreground font-black text-lg rounded-2xl shadow-xl hover:brightness-110 transition-all flex items-center justify-center gap-4 sticky bottom-0"
                  >
                    {loading ? <Loader2 className="size-6 animate-spin" /> : (
                      <>
                        <span>إرسال الطلب</span>
                        <Send className="size-5" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-2" dir="rtl">
                   <h2 className="text-lg font-black text-primary uppercase tracking-widest">استعادة كلمة المرور</h2>
                   <button onClick={() => setAuthMode("login")} className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-primary transition-all shadow-md"><X size={20} /></button>
                </div>

                <form onSubmit={onForgotPassword} className="space-y-8" dir="rtl">
                  <p className="text-sm font-bold text-muted-foreground leading-relaxed">أدخل بريدك الإلكتروني المسجل وسنرسل لك رابطاً لاستعادة الوصول لحسابك.</p>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-primary/60 mr-4 uppercase tracking-widest">البريد الإلكتروني</label>
                    <div className="relative group">
                      <Mail className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-gold-primary/40 group-focus-within:text-primary transition-colors" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-16 bg-white/40 dark:bg-black/30 border border-white/40 dark:border-white/20 rounded-2xl pr-14 pl-5 font-bold text-base focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                        placeholder="البريد الإلكتروني..."
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full h-16 bg-primary text-primary-foreground font-black text-lg rounded-2xl shadow-xl hover:brightness-110 transition-all flex items-center justify-center gap-4"
                  >
                    {loading ? <Loader2 className="size-6 animate-spin" /> : (
                      <>
                        <span>إرسال رابط الاستعادة</span>
                        <Send className="size-5" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-center text-[12px] text-primary mt-16 tracking-[0.5em] uppercase font-black opacity-30">
            مجلس عائلة السيف
          </p>
        </div>
      </div>
    </div>
  );
}

function ReqField({ label, icon, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div className="space-y-2">
       <label className="text-xs font-black text-primary/60 mr-2 uppercase tracking-widest">{label}</label>
       <div className="relative group">
          {icon && <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gold-primary/40 group-focus-within:text-primary transition-colors">{icon}</div>}
          <input
            type={type}
            required
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "w-full h-14 bg-white/40 dark:bg-black/30 border border-white/40 dark:border-white/20 rounded-2xl font-bold text-base focus:outline-none focus:border-primary transition-all shadow-inner",
              icon ? "pr-14 pl-5" : "px-5"
            )}
            placeholder={placeholder}
          />
       </div>
    </div>
  );
}
