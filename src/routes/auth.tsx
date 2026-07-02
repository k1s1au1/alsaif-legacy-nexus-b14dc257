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

      {/* Heritage Pattern Layer */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M50 0 L100 50 L50 100 L0 50 Z' fill='none' stroke='%238e7745' stroke-width='0.5'/%3E%3C/svg%3E")`, backgroundSize: '100px 100px' }} />

      {/* Floating Gold Dust Effect */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            initial={{
              opacity: 0.1 + Math.random() * 0.4,
              x: Math.random() * 100 + "%",
              y: Math.random() * 100 + "%"
            }}
            animate={{
              y: [null, "-100%"],
              x: [null, (Math.random() - 0.5) * 30 + "%"],
              rotate: [0, 360]
            }}
            transition={{
              duration: 15 + Math.random() * 30,
              repeat: Infinity,
              ease: "linear",
              delay: Math.random() * -30
            }}
            className="absolute size-[2px] bg-[#d4af37] rounded-full blur-[1px]"
            style={{ boxShadow: '0 0 10px #d4af37' }}
          />
        ))}
      </div>

      {/* Dynamic Brand Mesh Background */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            x: [0, 50, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-20%] right-[-10%] size-[800px] rounded-full bg-primary/10 blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [0, -90, 0],
            x: [0, -50, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-20%] left-[-10%] size-[800px] rounded-full bg-gold-primary/10 blur-[140px]"
        />
      </div>

      <div
        className="relative w-full max-w-[480px] md:max-w-[540px] bg-white/40 dark:bg-black/40 backdrop-blur-3xl rounded-[44px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] animate-fade-up overflow-hidden border border-white/20 dark:border-white/10 transition-all duration-500"
      >
        {authBg && (
          <div
            className="absolute inset-0 z-0 bg-center bg-cover bg-no-repeat opacity-[0.2] transition-opacity duration-1000"
            style={{ backgroundImage: `url(${authBg})` }}
          />
        )}

        <div className="relative z-10 p-8 sm:p-10 flex flex-col h-full">
          {/* Header Section */}
          <div className="flex flex-col items-center text-center mb-8">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="size-24 mb-6 flex items-center justify-center p-4 bg-white/20 dark:bg-white/5 backdrop-blur-md rounded-[32px] shadow-lg border border-white/20 relative group overflow-hidden"
            >
              <div className="absolute inset-0 bg-gold-primary/10 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
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
                    <Loader2 className="size-6 animate-spin text-gold-primary/20" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            <h1 className="text-3xl font-black text-primary mb-1 tracking-tight">مجلس السيف</h1>
            <p className="text-[10px] font-black tracking-[0.4em] text-gold-primary uppercase mt-1 opacity-60">عائلة السيف · بوابة خاصة</p>

            {/* Dynamic Welcome Message */}
            <div className="h-8 mt-4 flex items-center justify-center overflow-hidden">
               <AnimatePresence mode="wait">
                  <motion.p
                    key={msgIndex}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="text-sm font-bold text-primary/70 italic"
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
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-center gap-4 mb-2">
                  <div className="h-px w-8 bg-border" />
                  <h2 className="text-sm font-black text-primary uppercase tracking-widest">تسجيل الدخول</h2>
                  <div className="h-px w-8 bg-border" />
                </div>

                <form onSubmit={onLogin} className="space-y-5">
                  <div className="space-y-1.5" dir="rtl">
                    <label className="text-[10px] font-black text-muted-foreground mr-4 uppercase tracking-widest">البريد الإلكتروني</label>
                    <div className="relative">
                      <Mail className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-gold-primary/40" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-14 bg-white/30 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-2xl pr-14 pl-5 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                        placeholder="البريد الإلكتروني..."
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5" dir="rtl">
                    <label className="text-[10px] font-black text-muted-foreground mr-4 uppercase tracking-widest">كلمة المرور</label>
                    <div className="relative">
                      <Lock className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-gold-primary/40" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-14 bg-white/30 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-2xl pr-14 pl-14 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                        placeholder="••••••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-muted-foreground select-none">
                      <input type="checkbox" className="size-4 rounded-md border-border text-primary focus:ring-primary" />
                      تذكرني
                    </label>
                    <button
                      type="button"
                      onClick={() => setAuthMode("forgot")}
                      className="text-xs font-black text-gold-primary hover:text-primary transition-colors"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 bg-primary text-primary-foreground font-black rounded-2xl shadow-xl shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                  >
                    {loading ? <Loader2 className="size-5 animate-spin" /> : (
                      <>
                        <span>دخول إلى المجلس</span>
                        <ArrowLeft className="size-5" />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-4">
                    <button
                      type="button"
                      onClick={() => setAuthMode("request")}
                      className="text-sm font-black text-primary hover:underline flex items-center justify-center gap-2 mx-auto"
                    >
                      <UserPlus size={16} />
                      طلب إنشاء حساب جديد
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : mode === "request" ? (
              <motion.div
                key="request"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-2" dir="rtl">
                   <h2 className="text-sm font-black text-primary uppercase tracking-widest">طلب انضمام للمجلس</h2>
                   <button onClick={() => setAuthMode("login")} className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-primary transition-all"><X size={16} /></button>
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
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-muted-foreground mr-2 uppercase tracking-widest">ملاحظة إضافية</label>
                         <textarea
                           value={reqNote} onChange={(e) => setReqNote(e.target.value)}
                           className="w-full bg-white/30 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl p-4 font-bold text-sm focus:outline-none focus:border-primary transition-all resize-none shadow-sm"
                           rows={2} placeholder="صلة القرابة أو أي معلومات إضافية..."
                         />
                      </div>
                   </div>

                   <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 bg-primary text-primary-foreground font-black rounded-2xl shadow-xl shadow-primary/20 hover:brightness-110 transition-all flex items-center justify-center gap-3 sticky bottom-0"
                  >
                    {loading ? <Loader2 className="size-5 animate-spin" /> : (
                      <>
                        <span>إرسال الطلب</span>
                        <Send className="size-4" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-2" dir="rtl">
                   <h2 className="text-sm font-black text-primary uppercase tracking-widest">استعادة كلمة المرور</h2>
                   <button onClick={() => setAuthMode("login")} className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-primary transition-all"><X size={16} /></button>
                </div>

                <form onSubmit={onForgotPassword} className="space-y-6" dir="rtl">
                  <p className="text-xs font-bold text-muted-foreground leading-relaxed">أدخل بريدك الإلكتروني المسجل وسنرسل لك رابطاً لاستعادة الوصول لحسابك.</p>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground mr-4 uppercase tracking-widest">البريد الإلكتروني</label>
                    <div className="relative">
                      <Mail className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-gold-primary/40" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-14 bg-white/30 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-2xl pr-14 pl-5 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                        placeholder="البريد الإلكتروني..."
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full h-14 bg-primary text-primary-foreground font-black rounded-2xl shadow-xl shadow-primary/20 hover:brightness-110 transition-all flex items-center justify-center gap-3"
                  >
                    {loading ? <Loader2 className="size-5 animate-spin" /> : (
                      <>
                        <span>إرسال رابط الاستعادة</span>
                        <Send className="size-4" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-center text-[10px] text-muted-foreground mt-12 tracking-[0.4em] uppercase font-black opacity-40">
            مجلس عائلة السيف
          </p>
        </div>
      </div>
    </div>
  );
}

function ReqField({ label, icon, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div className="space-y-1.5">
       <label className="text-[10px] font-black text-muted-foreground mr-2 uppercase tracking-widest">{label}</label>
       <div className="relative">
          {icon && <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gold-primary/40">{icon}</div>}
          <input
            type={type}
            required
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "w-full h-12 bg-white/30 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl font-bold text-sm focus:outline-none focus:border-primary transition-all shadow-sm",
              icon ? "pr-12 pl-4" : "px-4"
            )}
            placeholder={placeholder}
          />
       </div>
    </div>
  );
}
