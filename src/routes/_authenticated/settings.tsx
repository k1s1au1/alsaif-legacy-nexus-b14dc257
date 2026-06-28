import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { BackgroundUploader } from "@/components/background-uploader";
import { supabase } from "@/integrations/supabase/client";
import {
  Moon,
  Sun,
  Languages,
  Bell,
  Smartphone,
  ShieldCheck,
  ChevronLeft,
  Check,
  Palette,
  Type,
  X,
  ImagePlus,
  Star
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { motion, AnimatePresence } from "framer-motion";

const FONTS = [
  { id: "Tajawal", name: "تجوال (عصري)", family: "'Tajawal', sans-serif", desc: "خط ناعم وأنيق" },
  { id: "Cairo", name: "كايـرو (عريض)", family: "'Cairo', sans-serif", desc: "وضوح عالي جداً" },
  { id: "Lalezar", name: "لاليزار (فني)", family: "'Lalezar', cursive", desc: "خط عريض ومميز" },
  { id: "Amiri", name: "الأميري (تراثي)", family: "'Amiri', serif", desc: "طابع كلاسيكي فاخر" },
  { id: "Changa", name: "شانغا (هندسي)", family: "'Changa', sans-serif", desc: "زوايا حادة وقوية" },
  { id: "ReemKufi", name: "ريم كوفي (كوفي)", family: "'Reem Kufi', sans-serif", desc: "أصالة الخط الكوفي" },
  { id: "Markazi", name: "مركزي (أدبي)", family: "'Markazi Text', serif", desc: "خط الكتب والروايات" },
  { id: "Vazirmatn", name: "وزير (بسيط)", family: "'Vazirmatn', sans-serif", desc: "بساطة تقنية حديثة" },
];

const THEME_COLORS = [
  {
    id: "emerald",
    name: "أخضر السيف (الأصلي)",
    primary: "#064E3B",
    secondary: "#D4AF37",
    darkPrimary: "#059669",
    foreground: "#FFFFFF",
    isPrimary: true,
    mesh: ["rgba(212, 175, 55, 0.1)", "rgba(6, 78, 59, 0.08)"]
  },
  {
    id: "midnight",
    name: "الكحلي الوقور",
    primary: "#1E293B",
    secondary: "#94A3B8",
    darkPrimary: "#334155",
    foreground: "#FFFFFF",
    mesh: ["rgba(148, 163, 184, 0.1)", "rgba(30, 41, 59, 0.1)"]
  },
  {
    id: "burgundy",
    name: "العنابي الفاخر",
    primary: "#4C0519",
    secondary: "#D4AF37",
    darkPrimary: "#800000",
    foreground: "#FFFFFF",
    mesh: ["rgba(212, 175, 55, 0.1)", "rgba(76, 5, 25, 0.1)"]
  },
  {
    id: "pure-white",
    name: "الأبيض العاجي",
    primary: "#FDFCF7",
    secondary: "#8E7745",
    darkPrimary: "#F1F5F9",
    foreground: "#8E7745",
    mesh: ["rgba(142, 119, 69, 0.1)", "rgba(253, 252, 247, 0.1)"]
  },
  {
    id: "sand",
    name: "رمل نجد (تراثي)",
    primary: "#C2B280",
    secondary: "#451A03",
    darkPrimary: "#D2B48C",
    foreground: "#451A03",
    mesh: ["rgba(69, 26, 3, 0.1)", "rgba(194, 178, 128, 0.1)"]
  },
];

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  component: SettingsPage,
});

function SettingsPage() {
  const [darkMode, setDarkMode] = useState<"light" | "dark" | "system" | null>(null);
  const [font, setFont] = useState("Tajawal");
  const [fontStyle, setFontStyle] = useState<"modern" | "royal">("modern");
  const [themeColor, setThemeColor] = useState("emerald");
  const [appVersion, setAppVersion] = useState("1.1.8 (Web)");
  const [isNative, setIsNative] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [canCustomizeBg, setCanCustomizeBg] = useState(false);
  const dynamicLogo = useSiteLogo();

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id);
      const rs = (roles ?? []).map(r => r.role);
      setCanCustomizeBg(rs.includes("admin") || rs.includes("chairman"));
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load saved theme
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    if (savedTheme) {
      setDarkMode(savedTheme);
      applyTheme(savedTheme);
    } else {
      setDarkMode("system");
    }

    // Load saved font
    const savedFont = localStorage.getItem("app-font-id");
    if (savedFont) {
      setFont(savedFont);
      const fontObj = FONTS.find(f => f.id === savedFont);
      if (fontObj) applyFont(fontObj.family);
    }

    // Load saved font style
    const savedStyle = localStorage.getItem("font-style") as "modern" | "royal" | null;
    if (savedStyle) {
      setFontStyle(savedStyle);
      applyFontStyle(savedStyle);
    }

    // Load saved theme color
    const savedColor = localStorage.getItem("app-theme-color-id");
    if (savedColor) {
      setThemeColor(savedColor);
      const colorObj = THEME_COLORS.find(c => c.id === savedColor);
      if (colorObj) applyThemeColors(colorObj);
    }

    // Safe Capacitor detection
    const win = window as any;
    if (win.Capacitor?.isNativePlatform()) {
      setIsNative(true);
      const plugins = win.Capacitor?.Plugins;
      if (plugins?.App) {
        plugins.App.getInfo().then((info: any) => setAppVersion(`${info.version} (Native)`));
      }
    }
  }, []);

  const applyTheme = (theme: "light" | "dark" | "system") => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
    }
  };

  const applyFont = (fontFamily: string) => {
    document.documentElement.style.setProperty("--app-font", fontFamily);
  };

  const applyFontStyle = (style: "modern" | "royal") => {
    if (style === "royal") {
      document.documentElement.classList.add("font-royal-mode");
    } else {
      document.documentElement.classList.remove("font-royal-mode");
    }
  };

  const handleFontStyleChange = (style: "modern" | "royal") => {
    setFontStyle(style);
    localStorage.setItem("font-style", style);
    applyFontStyle(style);
    toast.success(`تم تفعيل النمط ${style === "royal" ? "الملكي" : "العصري"}`);
  };

  const handleFontChange = (fontId: string) => {
    const selected = FONTS.find(f => f.id === fontId);
    if (!selected) return;
    setFont(fontId);
    localStorage.setItem("app-font-id", fontId);
    applyFont(selected.family);
    toast.success(`تم تفعيل خط ${selected.name}`);
    setShowFontPicker(false);
  };

  const applyThemeColors = (colors: typeof THEME_COLORS[0]) => {
    const root = document.documentElement;
    root.style.setProperty("--primary", colors.primary);
    root.style.setProperty("--primary-foreground", colors.foreground);
    root.style.setProperty("--gold-primary", colors.secondary);

    // Apply Mesh colors
    if (colors.mesh) {
      root.style.setProperty("--mesh-color-1", colors.mesh[0]);
      root.style.setProperty("--mesh-color-2", colors.mesh[1]);
    }

    if (root.classList.contains("dark")) {
      root.style.setProperty("--primary", colors.darkPrimary);
      root.style.setProperty("--primary-foreground", colors.foreground === "#FFFFFF" ? "#FFFFFF" : "#0A0C10");
    }
  };

  const handleThemeColorChange = (colorId: string) => {
    const selected = THEME_COLORS.find(c => c.id === colorId);
    if (!selected) return;
    setThemeColor(colorId);
    localStorage.setItem("app-theme-color-id", colorId);
    applyThemeColors(selected);
    toast.success(`تم تفعيل ${selected.name}`);
    setShowColorPicker(false);
  };

  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    setDarkMode(theme);
    localStorage.setItem("theme", theme);
    applyTheme(theme);
    toast.success(`تم تفعيل الوضع ${theme === "dark" ? "الداكن" : theme === "light" ? "الفاتح" : "التلقائي"}`);
  };

  const currentThemeObj = THEME_COLORS.find(c => c.id === themeColor) || THEME_COLORS[0];
  const currentFontObj = FONTS.find(f => f.id === font) || FONTS[0];

  return (
    <AppShell title="الإعدادات" user={{ name: "إعدادات الأخبار", role: "تخصيص", initial: "إ" }}>
      <div className="max-w-4xl mx-auto space-y-12 pb-24" dir="rtl">

        <section className="space-y-6 animate-fade-up">
          <div className="flex items-center gap-4">
             <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">مظهر المنصة</h3>
             <div className="h-px flex-1 bg-border/60" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <ThemeCard active={darkMode === "light"} onClick={() => handleThemeChange("light")} label="فاتح" icon={<Sun />} />
             <ThemeCard active={darkMode === "dark"} onClick={() => handleThemeChange("dark")} label="داكن" icon={<Moon />} />
             <ThemeCard active={darkMode === "system"} onClick={() => handleThemeChange("system")} label="تلقائي" icon={<Smartphone />} />
          </div>
        </section>

        <section className="space-y-6 animate-fade-up" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center gap-4">
             <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">النمط والخطوط</h3>
             <div className="h-px flex-1 bg-border/60" />
          </div>

          <div className="card-surface p-8 space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                   <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-gold-primary/10 flex items-center justify-center text-gold-primary">
                         <Type className="size-5" />
                      </div>
                      <h4 className="text-lg font-black text-primary">نمط الكتابة العام</h4>
                   </div>
                   <div className="flex gap-2 p-1 bg-muted/40 rounded-2xl border border-border/40">
                      <button
                        onClick={() => handleFontStyleChange("modern")}
                        className={cn("flex-1 py-3 rounded-xl font-black text-xs transition-all", fontStyle === "modern" ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:bg-muted")}
                      >عصري</button>
                      <button
                        onClick={() => handleFontStyleChange("royal")}
                        className={cn("flex-1 py-3 rounded-xl font-black text-xs transition-all", fontStyle === "royal" ? "bg-gold-primary text-white shadow-lg" : "text-muted-foreground hover:bg-muted")}
                      >ملكي (مخطوطة)</button>
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <Languages className="size-5" />
                         </div>
                         <h4 className="text-lg font-black text-primary">اختيار الخط المخصص</h4>
                      </div>
                      <button onClick={() => setShowFontPicker(true)} className="text-[10px] font-black text-gold-primary uppercase tracking-widest hover:underline">تغيير</button>
                   </div>
                   <div className="p-4 rounded-2xl bg-muted/30 border border-border/60">
                      <p className="text-sm font-bold text-primary">{currentFontObj.name}</p>
                      <p className="text-[10px] text-muted-foreground">{currentFontObj.desc}</p>
                   </div>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card-surface p-8 space-y-6 group">
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                     <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">لون الهوية</p>
                     <h4 className="text-xl font-black text-primary">{currentThemeObj.name}</h4>
                  </div>
                  <div className="size-14 rounded-2xl shadow-xl transition-transform group-hover:rotate-12 duration-500"
                       style={{ background: `linear-gradient(135deg, ${currentThemeObj.primary}, ${currentThemeObj.secondary})` }} />
               </div>
               <button
                 onClick={() => setShowColorPicker(true)}
                 className="w-full btn-gold py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-sm shadow-2xl shadow-gold-primary/20"
               >
                 <Palette className="size-5" /> اختيار لون جديد
               </button>
            </div>
          </div>
        </section>

        <section className="space-y-6 animate-fade-up" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center gap-4">
             <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">إعدادات النظام</h3>
             <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="card-surface overflow-hidden divide-y divide-border/40">
             <SettingRow icon={<Languages />} title="لغة الواجهة" desc="العربية (الافتراضية)" />
             <SettingRow icon={<Bell />} title="الإشعارات" desc="مفعلة لكافة الأحداث" />
             <SettingRow icon={<ShieldCheck />} title="الأمان" desc="التحقق من الهوية مفعل" />
             <div className="p-8 flex items-center justify-between text-muted-foreground/40 italic">
                <span className="text-[10px] font-black uppercase tracking-widest">Version {appVersion}</span>
                <div
                  className="size-6 logo-alsaif grayscale opacity-20"
                  style={{ "--logo-url": dynamicLogo ? `url(${dynamicLogo})` : "none" } as any}
                />
             </div>
          </div>
        </section>

        {canCustomizeBg && (
          <section className="space-y-6 animate-fade-up" style={{ animationDelay: "300ms" }}>
            <div className="flex items-center gap-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">خلفيات الواجهة</h3>
              <div className="h-px flex-1 bg-border/60" />
            </div>
            <div className="card-surface p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary">
                  <ImagePlus className="size-6" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-primary">تخصيص الخلفيات</h4>
                  <p className="text-xs font-bold text-muted-foreground opacity-60">متاح للمسؤولين التقنيين ورئيس المجلس فقط.</p>
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-50">شعار المنصة</p>
                  <BackgroundUploader inline settingKey="site_logo" label="تحديث الشعار الرسمي" />
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-50">صفحة الدخول</p>
                  <BackgroundUploader inline settingKey="auth_bg" label="خلفية تسجيل الدخول" />
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <AnimatePresence>
        {showColorPicker && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="card-surface w-full max-w-lg p-8 space-y-8 shadow-2xl rounded-[48px]">
               <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-primary tracking-tight">ألوان الهوية الفاخرة</h3>
                  <button onClick={() => setShowColorPicker(false)} className="size-10 rounded-full bg-muted flex items-center justify-center"><X size={20} /></button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {THEME_COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleThemeColorChange(c.id)}
                      className={cn(
                        "p-5 rounded-[32px] border-2 transition-all text-right flex items-center gap-4 group relative",
                        themeColor === c.id ? "border-primary bg-primary/5" : "border-transparent bg-muted/30 hover:bg-muted/50"
                      )}
                    >
                       <div className="size-12 rounded-2xl shadow-lg shrink-0 group-hover:scale-110 transition-transform" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})` }} />
                       <div className="flex-1">
                          <span className="font-black text-sm block">{c.name}</span>
                          {c.isPrimary && <span className="text-[9px] font-black text-gold-primary uppercase tracking-widest mt-0.5">الهوية الأساسية</span>}
                       </div>
                       {c.isPrimary && <Star className="absolute top-4 left-4 size-4 text-gold-primary fill-gold-primary" />}
                    </button>
                  ))}
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFontPicker && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="card-surface w-full max-w-lg p-6 space-y-6 shadow-2xl rounded-[40px]">
               <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-primary tracking-tight">تخصيص الخط</h3>
                  <button onClick={() => setShowFontPicker(false)} className="size-8 rounded-full bg-muted flex items-center justify-center"><X size={16} /></button>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {FONTS.map(f => (
                    <button key={f.id} onClick={() => handleFontChange(f.id)} style={{ fontFamily: f.family }} className={cn("p-4 rounded-2xl border-2 transition-all text-right flex items-center justify-between group", font === f.id ? "border-primary bg-primary/5" : "border-transparent bg-muted/30 hover:bg-muted/50")}>
                       <div className="overflow-hidden">
                          <p className="text-sm font-bold truncate">{f.name}</p>
                          <p className="text-[10px] opacity-60 truncate">{f.desc}</p>
                       </div>
                       <span className="text-xl opacity-20 font-black group-hover:opacity-100 transition-opacity shrink-0">أبج</span>
                    </button>
                  ))}
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function ThemeCard({ active, label, icon, onClick }: any) {
  return (
    <button onClick={onClick} className={cn("p-6 md:p-8 rounded-[32px] md:rounded-[40px] border-4 transition-all duration-500 flex flex-col items-center gap-3 md:gap-4 text-center", active ? "bg-primary border-gold-primary text-primary-foreground shadow-2xl scale-105" : "bg-card border-transparent text-muted-foreground hover:bg-muted")}>
       <div className={cn("size-12 md:size-16 rounded-[22px] md:rounded-[28px] flex items-center justify-center transition-all duration-700", active ? "bg-white/10 text-gold-primary rotate-12" : "bg-muted text-primary")}>
          {icon}
       </div>
       <span className="text-base md:text-lg font-black tracking-tight">{label}</span>
    </button>
  );
}

function SettingRow({ icon, title, desc }: any) {
  return (
    <div className="p-8 flex items-center justify-between group transition-all">
       <div className="flex items-center gap-6">
          <div className="size-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-inner">
             {icon}
          </div>
          <div className="text-right">
             <p className="font-black text-primary tracking-tight">{title}</p>
             <p className="text-xs font-bold text-muted-foreground opacity-60">{desc}</p>
          </div>
       </div>
       <ChevronLeft className="size-5 text-muted-foreground/30" />
    </div>
  );
}
