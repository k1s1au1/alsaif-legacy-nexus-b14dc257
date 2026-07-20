import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  Send,
  X,
  Phone,
  User,
  Sparkles,
  ImagePlus,
  ChevronDown,
} from "lucide-react";
import palmWatermark from "@/assets/palm-watermark.png";
import authBgAsset from "@/assets/alsaif-auth-bg.png.asset.json";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { useAppBackground } from "@/hooks/use-app-background";
import { BackgroundUploader } from "@/components/background-uploader";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { getPublicStats } from "@/lib/api/stats.functions";
import { notifyAdminsOfNewRequest } from "@/lib/api/admin-notifications.functions";
import { useQuery } from "@tanstack/react-query";

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
  const [isAdmin, setIsAdmin] = useState(false);
  const dynamicLogo = useSiteLogo();
  const { url: customBg } = useAppBackground("auth_bg");

  // Fetch Public Stats directly from the new project to ensure they are "honest"
  const { data: counts = { members: 0, completedTasks: 0 } } = useQuery({
    queryKey: ["public-stats"],
    queryFn: async () => {
      const [{ count: mCount }, { count: tCount }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "done"),
      ]);
      return { members: mCount || 0, completedTasks: tCount || 0 };
    },
    refetchInterval: 1000 * 60,
  });

  const [reqForm, setReqForm] = useState({
    firstName: "",
    fatherName: "",
    grandFatherName: "",
    phone: "",
    email: "",
    password: "",
  });

  const [msgIndex, setMsgIndex] = useState(0);
  const welcomeMessages = [
    "أهلاً بك في مجلس السيف الموقر",
    "نصل العائلة.. ونبض المجتمع",
    "حيث يُحفظ الإرث وتُبنى الروابط",
    "منصة التواصل الرسمية والخاصة",
  ];

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12) return "صباح الخير";
    if (hr >= 12 && hr < 17) return "مساء النور";
    if (hr >= 17 && hr < 21) return "مساء الخير";
    return "طاب مساؤك";
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % welcomeMessages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        navigate({ to: "/dashboard", replace: true });
        // Also check if admin for the uploader button
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .then(({ data: roles }) => {
            const r = (roles ?? []).map((x) => x.role);
            setIsAdmin(r.includes("admin") || r.includes("chairman"));
          });
      }
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
      status: "pending",
    });

    if (error) {
      setLoading(false);
      toast.error("فشل إرسال الطلب", { description: error.message });
      return;
    }

    // Notify admins (Chairman and Technical Admin)
    try {
      await notifyAdminsOfNewRequest({ data: { name: `${reqForm.firstName} ${reqForm.fatherName}` } });
    } catch (err) {
      console.warn("Notification error:", err);
    }

    setLoading(false);
    toast.success("تم إرسال طلبك بنجاح", { description: "سيتم مراجعة طلبك من قبل إدارة المجلس." });
    setAuthMode("login");
  }

  return (
    <div
      className="min-h-screen relative flex flex-col lg:flex-row bg-[#062F2B] overflow-y-auto"
      dir="rtl"
    >
      {/* 1. Full-Height Login Pane (Main on Mobile) */}
      <div className="w-full lg:w-[500px] xl:w-[600px] min-h-screen bg-gradient-to-b from-[#FCF8EF] via-[#F7F1E4] to-[#EEE4CF] relative z-20 flex flex-col items-center justify-center p-6 sm:p-20 border-l border-[#D8C282]/45 shadow-[-40px_0_100px_rgba(4,43,38,0.22)] shrink-0 overflow-hidden">

        {/* Layered Alsaif palette: teal depth, ivory light, and a restrained gold glow */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute right-0 top-24 h-2/3 w-px bg-gradient-to-b from-transparent via-gold-primary/35 to-transparent" />
          <div className="absolute inset-x-10 bottom-10 h-px bg-gradient-to-l from-transparent via-[#0B5D4B]/20 to-transparent" />
          <div className="absolute top-8 left-8 right-8 flex items-center gap-3 opacity-70">
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#0B5D4B]/20" />
            <span className="text-[9px] font-black tracking-[0.35em] text-[#0B5D4B]/55">إرثٌ يجمعنا</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#0B5D4B]/20" />
          </div>
        </div>


        {/* Immersive Mobile Background (Shows the custom image with charcoal overlay) */}
        <div className="lg:hidden absolute inset-0 -z-10 overflow-hidden">
          <div
            className="size-full bg-cover bg-left opacity-10 scale-110 blur-[2px]"
            style={{ backgroundImage: `url(${customBg || authBgAsset.url})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#FCF8EF]/95 via-[#F7F1E4]/96 to-[#EEE4CF]/98" />
        </div>

        {/* Integrated Palm Watermark with Warm Golden Glow */}
        <div className="absolute -right-28 -bottom-28 size-[26rem] lg:size-[32rem] opacity-[0.14] pointer-events-none text-[#0B5D4B]">
          <div className="absolute inset-10 rounded-full border border-[#0B5D4B]/15" />
          <div className="absolute inset-16 rounded-full border border-gold-primary/20 border-dashed" />
          <img
            src={palmWatermark}
            alt=""
            className="size-full object-contain opacity-55 mix-blend-multiply rotate-[-8deg]"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, type: "spring" }}
          className="w-full max-w-md flex flex-col items-center relative z-10"
        >
          {/* Mobile Welcome Tag */}
          <div className="lg:hidden mb-6 px-4 py-1.5 rounded-full bg-[#0B5D4B]/5 border border-[#0B5D4B]/15 backdrop-blur-md">
            <p className="text-[10px] font-black text-[#0B5D4B] uppercase tracking-[0.3em]">
              {getGreeting()}، يا أهل الوفاء
            </p>
          </div>

          {/* Logo Section */}
          <div className="mb-10 lg:mb-12 text-center flex flex-col items-center w-full">
            <div className="size-32 lg:size-52 rounded-[38px] lg:rounded-[60px] p-0.5 bg-gradient-to-br from-gold-primary via-gold-primary/20 to-gold-primary shadow-2xl mb-6 lg:mb-8 relative overflow-hidden group/logo flex items-center justify-center transition-all duration-700 hover:scale-105">
              <div className="size-full rounded-[36px] lg:rounded-[58px] bg-[#FCF8EF] p-3 lg:p-6 flex items-center justify-center shadow-inner overflow-hidden border border-emerald-950/5">
                {dynamicLogo && !dynamicLogo.includes("alsaif-mark") ? (
                  <div
                    className="size-full bg-contain bg-no-repeat bg-center transition-transform duration-1000 group-hover/logo:rotate-[360deg] scale-110"
                    style={{ backgroundImage: `url(${dynamicLogo})` }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 opacity-20">
                    <Sparkles className="size-16 text-gold-primary animate-pulse" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-gold-primary">
                      ارفع الشعار
                    </span>
                  </div>
                )}
              </div>
            </div>

            <h3 className="text-3xl lg:text-4xl font-black text-[#0B5D4B] tracking-tight">
              مجلس السيف
            </h3>
            <div className="flex items-center justify-center gap-3 mt-4 opacity-70">
              <div className="h-px w-8 bg-gold-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#0B5D4B]/70">
                بوابة المجلس الرقمية
              </span>
              <div className="h-px w-8 bg-gold-primary" />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={onLogin}
                className="w-full space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-[#0B3F3A]/65 mr-1 uppercase tracking-widest">
                    البريد الإلكتروني
                  </label>
                  <div className="relative group">
                    <Mail className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-gold-primary/40 group-focus-within:text-gold-primary transition-colors" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-16 bg-white/60 border border-[#0B5D4B]/20 rounded-2xl pr-14 pl-6 font-bold text-sm text-[#0B3F3A] focus:outline-none focus:ring-4 focus:ring-gold-primary/5 focus:border-gold-primary transition-all shadow-inner"
                      placeholder="example@mail.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[11px] font-black text-[#0B3F3A]/65 uppercase tracking-widest">
                      كلمة المرور
                    </label>
                    <button
                      type="button"
                      onClick={() => setAuthMode("forgot")}
                      className="text-[11px] font-black text-[#0B5D4B] hover:text-[#064A43] hover:underline"
                    >
                      نسيت الكلمة؟
                    </button>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-gold-primary/40 group-focus-within:text-gold-primary transition-colors" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-16 bg-white/60 border border-[#0B5D4B]/20 rounded-2xl pr-14 pl-14 font-bold text-sm text-[#0B3F3A] focus:outline-none focus:ring-4 focus:ring-gold-primary/5 focus:border-gold-primary transition-all shadow-inner"
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold-primary transition-colors p-1"
                    >
                      {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-16 bg-gold-primary text-emerald-950 font-black rounded-2xl shadow-[0_15px_40px_-5px_rgba(212,175,55,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4 mt-2"
                >
                  {loading ? (
                    <Loader2 className="animate-spin size-6" />
                  ) : (
                    <>
                      <span>دخول للمجلس</span>
                      <ArrowLeft className="size-6 rotate-180" />
                    </>
                  )}
                </button>

                <div className="pt-12 text-center border-t border-[#0B3F3A]/10 mt-6">
                  <p className="text-xs font-bold text-[#0B3F3A]/60 mb-6 uppercase tracking-widest">
                    ليس لديك حساب رسمي؟
                  </p>
                  <button
                    type="button"
                    onClick={() => setAuthMode("request")}
                    className="w-full h-14 rounded-2xl bg-[#0B5D4B]/5 text-[#0B3F3A] font-black text-xs hover:bg-[#0B5D4B]/10 transition-all border border-[#0B5D4B]/15 shadow-sm"
                  >
                    تقديم طلب انضمام للعائلة
                  </button>
                </div>
              </motion.form>
            ) : mode === "forgot" ? (
              <motion.form
                key="forgot"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={onForgot}
                className="w-full space-y-6"
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-2xl font-black text-[#0B5D4B] tracking-tight">
                    استعادة الحساب
                  </h3>
                  <button
                    type="button"
                    onClick={() => setAuthMode("login")}
                    className="size-10 rounded-full bg-[#0B5D4B]/5 flex items-center justify-center text-[#0B3F3A]/60 hover:bg-rose-500 hover:text-white transition-all"
                  >
                    <X size={22} />
                  </button>
                </div>
                <p className="text-sm text-[#0B3F3A]/65 leading-relaxed">
                  أدخل بريدك المسجل وسنرسل لك رابط التحديث فوراً.
                </p>
                <AuthField
                  label="البريد الإلكتروني"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="mail@example.com"
                  icon={<Mail size={20} />}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-16 bg-gold-primary text-emerald-950 font-black rounded-2xl shadow-lg mt-6 flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <Loader2 className="size-6 animate-spin" />
                  ) : (
                    <>
                      <Send size={20} /> <span>إرسال الرابط</span>
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.div
                key="request-container"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative w-full"
              >
                <form
                  onSubmit={onRequest}
                  className="w-full space-y-5 max-h-[500px] overflow-y-auto pr-3 scrollbar-thin scrollbar-thumb-gold-primary/20 hover:scrollbar-thumb-gold-primary/40 scrollbar-track-transparent custom-scrollbar-pane"
                  dir="rtl"
                  id="auth-request-form"
                >
                  <div className="flex justify-between items-center mb-6 sticky top-0 bg-[#F7F1E4] z-10 py-2">
                    <h3 className="text-2xl font-black text-[#0B5D4B] tracking-tight">
                      طلب عضوية
                    </h3>
                    <button
                      type="button"
                      onClick={() => setAuthMode("login")}
                      className="size-10 rounded-full bg-[#0B5D4B]/5 flex items-center justify-center text-[#0B3F3A]/60 hover:bg-rose-500 hover:text-white transition-all"
                    >
                      <X size={22} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-5">
                    <AuthField
                      label="الاسم الأول"
                      value={reqForm.firstName}
                      onChange={(v: string) => setReqForm({ ...reqForm, firstName: v })}
                      placeholder="الاسم الشخصي"
                      icon={<User size={18} />}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <AuthField
                        label="اسم الأب"
                        value={reqForm.fatherName}
                        onChange={(v: string) => setReqForm({ ...reqForm, fatherName: v })}
                        placeholder="الأب"
                      />
                      <AuthField
                        label="اسم الجد"
                        value={reqForm.grandFatherName}
                        onChange={(v: string) => setReqForm({ ...reqForm, grandFatherName: v })}
                        placeholder="الجد"
                      />
                    </div>
                    <AuthField
                      label="رقم الجوال"
                      value={reqForm.phone}
                      onChange={(v: string) => setReqForm({ ...reqForm, phone: v })}
                      placeholder="05xxxxxxxx"
                      icon={<Phone size={18} />}
                    />
                    <AuthField
                      label="البريد الإلكتروني"
                      type="email"
                      value={reqForm.email}
                      onChange={(v: string) => setReqForm({ ...reqForm, email: v })}
                      placeholder="mail@example.com"
                      icon={<Mail size={18} />}
                    />
                    <AuthField
                      label="كلمة المرور"
                      type="password"
                      value={reqForm.password}
                      onChange={(v: string) => setReqForm({ ...reqForm, password: v })}
                      placeholder="••••••••"
                      icon={<Lock size={18} />}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-16 bg-gold-primary text-emerald-950 font-black rounded-2xl shadow-xl mt-6 flex items-center justify-center gap-3 mb-10"
                  >
                    {loading ? (
                      <Loader2 className="size-6 animate-spin" />
                    ) : (
                      <>
                        <Send size={20} /> <span>إرسال الطلب</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Floating Scroll Indicator for long forms */}
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none animate-bounce opacity-40">
                  <ChevronDown className="size-5 text-gold-primary" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-12 pt-8 border-t border-[#0B3F3A]/10 flex flex-col items-center gap-2 opacity-35">
            <p className="text-[9px] font-black tracking-[0.5em] text-[#0B3F3A] uppercase">
              Alsaif Family • 2026
            </p>
          </div>
        </motion.div>
      </div>

      {/* 2. Welcoming Heritage Section (Left Side in RTL) */}
      <div className="hidden lg:flex flex-1 flex-col justify-center items-start p-12 xl:p-24 relative overflow-hidden bg-[#0A3732]">
        {/* Heritage Backdrop Image with Optimized Fitting */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <motion.div
            key={customBg}
            initial={{ scale: 1.15, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.5 }}
            transition={{ duration: 3, ease: "easeOut" }}
            className="size-full bg-cover bg-left bg-no-repeat transition-all duration-1000"
            style={{ backgroundImage: customBg ? `url(${customBg})` : "none" }}
          />
        </div>

        {/* Refined Seamless Blend - Luxury Charcoal Edition */}
        <div className="absolute inset-0 z-1 bg-gradient-to-l from-[#0A3732] via-[#0A3732]/80 to-transparent" />
        <div className="absolute inset-0 z-1 bg-gradient-to-t from-[#0A3732]/45 via-transparent to-transparent opacity-40" />
        <div className="absolute inset-y-0 left-0 w-48 z-1 bg-gradient-to-r from-[#064A43]/45 to-transparent" />

        <div className="relative z-10 space-y-10 w-full max-w-4xl pr-4">
          <div className="space-y-6 text-right">
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="flex items-center gap-4"
            >
              <div className="h-px w-12 bg-gold-primary/70" />
              <span className="text-[10px] font-black uppercase tracking-[0.35em] text-gold-primary">
                إرث يمتد.. ومستقبل يُبنى
              </span>
            </motion.div>

            <motion.h1
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="text-6xl xl:text-8xl font-black text-white tracking-tighter leading-[0.95] drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            >
              عائلة
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-l from-gold-primary via-white/80 to-[#8E7745] animate-pulse">
                السيف
              </span>
            </motion.h1>

            <div className="h-16 overflow-hidden relative">
              <AnimatePresence mode="wait">
                <motion.p
                  key={msgIndex}
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -40, opacity: 0 }}
                  transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
                  className="text-2xl xl:text-4xl text-white/70 font-bold max-w-2xl leading-tight"
                >
                  {welcomeMessages[msgIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-16 pt-6">
            <HeritageStat label="الأعضاء المسجلين" value={`${counts.members}`} delay={0.4} />
            <HeritageStat label="مبادرات مكتملة" value={`${counts.completedTasks}`} delay={0.6} />
          </div>
        </div>

        {/* Change Background Button (Visible for admins) */}
        {isAdmin && (
          <div className="absolute bottom-10 left-10 z-50">
            <BackgroundUploader
              settingKey="auth_bg"
              label="تغيير الخلفية"
              className="bg-white/5 text-white/40 border border-white/10 hover:bg-gold-primary hover:text-emerald-950 transition-all shadow-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function HeritageStat({
  label,
  value,
  delay = 0,
}: {
  label: string;
  value: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay }}
      className="space-y-3 group cursor-default border-t border-gold-primary/20 pt-4"
    >
      <div className="flex items-baseline gap-2">
        <p className="text-5xl xl:text-6xl font-black text-white tabular-nums drop-shadow-[0_6px_18px_rgba(0,0,0,0.35)] group-hover:text-gold-primary transition-colors duration-700">
          {value}
        </p>
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold-primary/60 group-hover:text-white transition-colors duration-500">
        {label}
      </p>
    </motion.div>
  );
}

function AuthField({ label, icon, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-black text-white/40 mr-1 uppercase tracking-widest">
        {label}
      </label>
      <div className="relative group">
        {icon && (
          <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gold-primary/40 group-focus-within:text-gold-primary transition-colors">
            {icon}
          </div>
        )}
        <input
          type={type}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-16 bg-white/60 border border-[#0B5D4B]/20 rounded-2xl font-bold text-sm text-[#0B3F3A] focus:outline-none focus:ring-4 focus:ring-gold-primary/5 focus:border-gold-primary transition-all pr-14 pl-6 shadow-sm"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
