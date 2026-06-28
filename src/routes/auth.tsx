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
  UserPlus,
  Send,
  X,
  Phone,
  User,
  ShieldCheck,
  ChevronLeft
} from "lucide-react";
import logoAsset from "@/assets/alsaif-mark.png.asset.json";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { useAppBackground } from "@/hooks/use-app-background";
import { paletteToCssVars } from "@/lib/bg-palette";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { sendFcmNotification } from "@/lib/fcm";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "مجلس السيف — بوابة العبور" },
      { name: "description", content: "البوابة الرسمية لأعضاء عائلة السيف." },
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

  // Request fields
  const [reqFirstName, setReqFirstName] = useState("");
  const [reqFatherName, setReqFatherName] = useState("");
  const [reqGrandName, setReqGrandFatherName] = useState("");
  const [reqPhone, setReqPhone] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqPassword, setReqPassword] = useState("");
  const [reqNote, setReqNote] = useState("");

  const { url: authBg, palette: authPalette } = useAppBackground("auth_bg");
  const paletteVars = authPalette ? paletteToCssVars(authPalette) : undefined;

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
      toast.error("بيانات الدخول غير صحيحة", { description: "تأكد من البريد وكلمة المرور." });
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
      toast.error("فشل إرسال الطلب", { description: error.message });
      return;
    }

    sendFcmNotification({
      data: {
        title: "📥 طلب انضمام جديد",
        body: `رغبة في الانضمام من: ${reqFirstName} ${reqFatherName}`,
      }
    }).catch(() => {});

    toast.success("تم إرسال طلبك للإدارة", { description: "ستصلك رسالة عند تفعيل حسابك." });
    setAuthMode("login");
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 md:p-10 bg-[#051410] overflow-hidden" dir="rtl">

      {/* Background Image Layer (Restored) */}
      {authBg && (
        <div
          className="absolute inset-0 z-0 bg-center bg-cover bg-no-repeat transition-opacity duration-1000 opacity-60"
          style={{ backgroundImage: `url(${authBg})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#051410]/95 via-transparent to-[#051410]/95" />
        </div>
      )}

      {/* Cinematic Light Leaks */}
      <div className="absolute inset-0 z-0 pointer-events-none">
         <motion.div
           animate={{
             scale: [1, 1.2, 1],
             opacity: [0.2, 0.4, 0.2],
             x: [0, 50, 0],
             y: [0, -30, 0]
           }}
           transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
           className="absolute -top-[20%] -right-[10%] size-[800px] bg-gold-primary/10 rounded-full blur-[120px]"
         />
         <motion.div
           animate={{
             scale: [1.2, 1, 1.2],
             opacity: [0.1, 0.3, 0.1],
             x: [0, -60, 0],
             y: [0, 40, 0]
           }}
           transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
           className="absolute -bottom-[30%] -left-[10%] size-[900px] bg-emerald-500/10 rounded-full blur-[150px]"
         />
      </div>

      <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">

         {/* Branding Side (Visible on Desktop) */}
         <div className="hidden lg:flex flex-col space-y-10 animate-fade-up">
            <div className="space-y-4">
               <div className="flex items-center gap-4">
                  <div className="h-0.5 w-16 bg-gold-primary shadow-[0_0_20px_rgba(212,175,55,0.6)]" />
                  <span className="text-xs font-black uppercase tracking-[0.6em] text-gold-primary">مجلس السيف العريق</span>
               </div>
               <h1 className="text-8xl font-black tracking-tighter text-white leading-none">
                  بوابة<br />
                  <span className="text-white/20">التواصل</span>
               </h1>
            </div>
            <p className="text-2xl font-bold text-white/40 max-w-md leading-relaxed italic">
               "نعتز بجذورنا، ونبني مستقبلنا.. مرحباً بكم في المنصة الخاصة بأبناء عائلة السيف."
            </p>
         </div>

         {/* Form Side */}
         <div className="w-full max-w-[500px] mx-auto">
            <motion.div
               layout
               className="relative overflow-hidden bg-[#064E3B]/80 backdrop-blur-3xl border border-white/10 rounded-[48px] md:rounded-[60px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)]"
               style={paletteVars}
            >
               {/* Top Accent Gradient */}
               <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-l from-transparent via-gold-primary to-transparent opacity-40" />

               <div className="p-10 md:p-14 space-y-10">
                  {/* Logo Section */}
                  <div className="flex flex-col items-center gap-6">
                     <motion.div
                       whileHover={{ rotate: 5, scale: 1.05 }}
                       className="size-24 rounded-[32px] bg-gradient-to-br from-white/10 to-transparent border border-white/10 p-5 shadow-2xl flex items-center justify-center relative group"
                     >
                        <div className="absolute inset-0 bg-gold-primary/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="size-full logo-alsaif" style={{ '--logo-url': `url(${dynamicLogo || logoAsset.url})` } as any} />
                     </motion.div>
                     <div className="text-center lg:hidden">
                        <h2 className="text-3xl font-black text-white tracking-tight">مجلس السيف</h2>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary/60 mt-1">ALSAIF PRIVATE HUB</p>
                     </div>
                  </div>

                  <AnimatePresence mode="wait">
                     {mode === "login" && (
                        <motion.div key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                           <div className="space-y-2 text-center md:text-right">
                              <h3 className="text-2xl font-black text-white">تسجيل الدخول</h3>
                              <p className="text-sm font-bold text-white/40">يرجى إدخال بياناتك المعتمدة للوصول.</p>
                           </div>

                           <form onSubmit={onLogin} className="space-y-5">
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-gold-primary/60 mr-4">البريد الإلكتروني</label>
                                 <div className="relative group">
                                    <Mail className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-white/20 group-focus-within:text-gold-primary transition-colors" />
                                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="auth-input-royal-green" placeholder="saud@alsaif.family" />
                                 </div>
                              </div>

                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-gold-primary/60 mr-4">كلمة المرور</label>
                                 <div className="relative group">
                                    <Lock className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-white/20 group-focus-within:text-gold-primary transition-colors" />
                                    <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className="auth-input-royal-green" placeholder="••••••••••••" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                 </div>
                              </div>

                              <div className="flex items-center justify-between px-2">
                                 <button type="button" onClick={() => setAuthMode("forgot")} className="text-xs font-black text-white/40 hover:text-gold-primary transition-colors underline underline-offset-4">نسيت كلمة المرور؟</button>
                                 <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-white/40 hover:text-white transition-colors select-none">
                                    <input type="checkbox" className="size-4 rounded-lg border-white/10 bg-white/5 text-gold-primary focus:ring-gold-primary transition-all" />
                                    تذكرني
                                 </label>
                              </div>

                              <button disabled={loading} type="submit" className="btn-gold w-full h-16 rounded-3xl font-black text-lg shadow-2xl shadow-gold-primary/10 flex items-center justify-center gap-3 active:scale-95 transition-all">
                                 {loading ? <Loader2 className="animate-spin size-6" /> : <><ShieldCheck size={20} /> <span>دخول إلى المجلس</span></>}
                              </button>
                           </form>

                           <div className="pt-6 border-t border-white/5 text-center">
                              <button onClick={() => setAuthMode("request")} className="text-sm font-black text-gold-primary/80 hover:text-white transition-all flex items-center justify-center gap-2 mx-auto group">
                                 <UserPlus size={16} className="group-hover:scale-110 transition-transform" />
                                 طلب إنشاء حساب جديد
                              </button>
                           </div>
                        </motion.div>
                     )}

                     {mode === "request" && (
                        <motion.div key="request" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 text-right">
                           <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                 <h3 className="text-2xl font-black text-white">طلب الانضمام</h3>
                                 <p className="text-xs font-bold text-white/40">انضم لعائلتك ووثق تاريخك.</p>
                              </div>
                              <button onClick={() => setAuthMode("login")} className="size-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 hover:bg-white/10 transition-all"><X size={20} /></button>
                           </div>

                           <form onSubmit={onRequestAccount} className="space-y-4 max-h-[50vh] overflow-y-auto no-scrollbar px-1 custom-scrollbar">
                              <ReqField label="الاسم الأول" icon={<User />} value={reqFirstName} onChange={setReqFirstName} />
                              <div className="grid grid-cols-2 gap-3">
                                 <ReqField label="اسم الأب" value={reqFatherName} onChange={setReqFatherName} />
                                 <ReqField label="اسم الجد" value={reqGrandName} onChange={setReqGrandFatherName} />
                              </div>
                              <ReqField label="رقم الجوال" icon={<Phone />} value={reqPhone} onChange={setReqPhone} type="tel" />
                              <ReqField label="البريد الإلكتروني" icon={<Mail />} value={reqEmail} onChange={setReqEmail} type="email" />
                              <ReqField label="كلمة المرور" icon={<Lock />} value={reqPassword} onChange={setReqPassword} type="password" />
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-gold-primary/60 mr-2">ملاحظة للإدارة</label>
                                 <textarea value={reqNote} onChange={e => setReqNote(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold text-sm focus:border-gold-primary transition-all resize-none text-white" rows={2} placeholder="..." />
                              </div>

                              <button disabled={loading} type="submit" className="btn-gold w-full h-14 rounded-2xl font-black flex items-center justify-center gap-3 sticky bottom-0">
                                 {loading ? <Loader2 className="animate-spin size-5" /> : <><Send size={18} /> <span>إرسال الطلب</span></>}
                              </button>
                           </form>
                        </motion.div>
                     )}

                     {mode === "forgot" && (
                        <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 text-right">
                           <div className="flex items-center justify-between">
                              <h3 className="text-2xl font-black text-white">استعادة الوصول</h3>
                              <button onClick={() => setAuthMode("login")} className="size-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 hover:bg-white/10 transition-all"><X size={20} /></button>
                           </div>
                           <p className="text-sm font-bold text-white/40 leading-relaxed">أدخل بريدك وسنرسل لك مفتاح العبور الجديد.</p>
                           <form className="space-y-6">
                              <ReqField label="البريد الإلكتروني" icon={<Mail />} value={email} onChange={setEmail} type="email" />
                              <button type="submit" className="btn-gold w-full h-14 rounded-2xl font-black flex items-center justify-center gap-3">
                                 <Send size={18} /> <span>إرسال الرابط</span>
                              </button>
                           </form>
                        </motion.div>
                     )}
                  </AnimatePresence>

                  <p className="text-center text-[10px] font-black tracking-[0.6em] text-white/10 uppercase">
                     Heritage · Legacy · Nexus
                  </p>
               </div>
            </motion.div>
         </div>
      </div>

      <style>{`
         .auth-input-royal-green {
            width: 100%;
            height: 3.5rem;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 1.25rem;
            padding-right: 3.5rem;
            padding-left: 1.25rem;
            font-weight: 700;
            font-size: 0.875rem;
            color: white;
            transition: all 0.3s ease;
            outline: none;
         }
         .auth-input-royal-green:focus {
            background: rgba(212, 175, 55, 0.03);
            border-color: #D4AF37;
            box-shadow: 0 0 20px rgba(212, 175, 55, 0.1);
         }
         .auth-input-royal-green::placeholder {
            color: rgba(255, 255, 255, 0.15);
         }
         .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
         }
         .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(212, 175, 55, 0.2);
            border-radius: 10px;
         }
      `}</style>
    </div>
  );
}

function ReqField({ label, icon, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div className="space-y-1.5 text-right">
       <label className="text-[10px] font-black uppercase tracking-widest text-gold-primary/60 mr-2">{label}</label>
       <div className="relative group">
          {icon && <div className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-primary transition-all">{icon}</div>}
          <input
            type={type}
            required
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "w-full h-12 bg-white/5 border border-white/10 rounded-2xl font-bold text-sm focus:border-gold-primary transition-all text-white outline-none",
              icon ? "pr-12 pl-4" : "px-5"
            )}
            placeholder={placeholder}
          />
       </div>
    </div>
  );
}
