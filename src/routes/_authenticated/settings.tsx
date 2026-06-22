import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import {
  Moon,
  Sun,
  Languages,
  Bell,
  Info,
  Smartphone,
  ShieldCheck,
  ChevronLeft,
  Check,
  Palette,
  Type,
  X,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
import { motion, AnimatePresence } from "framer-motion";

const FONTS = [
  { id: "Tajawal", name: "تجوال", family: "'Tajawal', sans-serif", desc: "خط عصري وأنيق" },
  { id: "Cairo", name: "كايـرو", family: "'Cairo', sans-serif", desc: "وضوح عالي للقراءة" },
  { id: "Almarai", name: "المراعي", family: "'Almarai', sans-serif", desc: "بساطة وجمالية" },
  { id: "ElMessiri", name: "المسيري", family: "'El Messiri', sans-serif", desc: "لمسة فنية مميزة" },
  { id: "Amiri", name: "الأميري", family: "'Amiri', serif", desc: "طابع كلاسيكي فاخر" },
  { id: "Vazirmatn", name: "وزير", family: "'Vazirmatn', sans-serif", desc: "بساطة تقنية حديثة" },
  { id: "ReadexPro", name: "ريديكس", family: "'Readex Pro', sans-serif", desc: "خط هندسي مريح" },
  { id: "IBM-Plex", name: "آي بي إم", family: "'IBM Plex Sans Arabic', sans-serif", desc: "طابع رسمي احترافي" },
  { id: "NotoSans", name: "نوتو", family: "'Noto Sans Arabic', sans-serif", desc: "خط جوجل العالمي" },
];

const THEME_COLORS = [
  { id: "emerald", name: "الأخضر الماسي", primary: "#064E3B", secondary: "#D4AF37", darkPrimary: "#059669", foreground: "#FFFFFF" },
  { id: "pure-white", name: "الأبيض اللؤلؤي", primary: "#F8FAFC", secondary: "#064E3B", darkPrimary: "#F1F5F9", foreground: "#064E3B" },
  { id: "champagne", name: "شامبين الذهب", primary: "#F3E5AB", secondary: "#451A03", darkPrimary: "#FDE68A", foreground: "#451A03" },
  { id: "platinum", name: "البلاتين الفخم", primary: "#E5E7EB", secondary: "#111827", darkPrimary: "#D1D5DB", foreground: "#111827" },
  { id: "sapphire", name: "الأزرق الصافي", primary: "#1E3A8A", secondary: "#60A5FA", darkPrimary: "#60A5FA", foreground: "#FFFFFF" },
  { id: "burgundy", name: "العنابي الفاخر", primary: "#4C0519", secondary: "#FB7185", darkPrimary: "#FB7185", foreground: "#FFFFFF" },
  { id: "obsidian", name: "الأسود الفخم", primary: "#0F172A", secondary: "#94A3B8", darkPrimary: "#F1F5F9", foreground: "#FFFFFF" },
  { id: "ruby", name: "الياقوت الأحمر", primary: "#991B1B", secondary: "#FCA5A5", darkPrimary: "#F87171", foreground: "#FFFFFF" },
  { id: "Alsaif-purple", name: "الأرجوان المميز", primary: "#581C87", secondary: "#D8B4FE", darkPrimary: "#C084FC", foreground: "#FFFFFF" },
];

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [darkMode, setDarkMode] = useState<"light" | "dark" | "system" | null>(null);
  const [font, setFont] = useState("Tajawal");
  const [themeColor, setThemeColor] = useState("emerald");
  const [appVersion, setAppVersion] = useState("1.1.8 (Web)");
  const [isNative, setIsNative] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);

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
    <AppShell title="الإعدادات" user={{ name: "إعدادات المجلس", role: "تخصيص", initial: "إ" }}>
      <div className="max-w-4xl mx-auto space-y-12 pb-24" dir="rtl">

        {/* Appearance Mode */}
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

        {/* Dynamic Personalization */}
        <section className="space-y-6 animate-fade-up" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center gap-4">
             <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">التخصيص الفاخر</h3>
             <div className="h-px flex-1 bg-border/60" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Color Trigger */}
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

            {/* Font Trigger */}
            <div className="card-surface p-8 space-y-6 group">
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                     <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">خط الكتابة</p>
                     <h4 className="text-xl font-black text-primary">{currentFontObj.name}</h4>
                  </div>
                  <div className="size-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:-rotate-12 transition-transform duration-500">
                     <Type className="size-7" />
                  </div>
               </div>
               <button
                 onClick={() => setShowFontPicker(true)}
                 className="w-full px-6 py-4 rounded-2xl bg-primary/5 text-primary border border-primary/10 hover:bg-primary hover:text-white transition-all font-black text-sm"
               >
                 تغيير نوع الخط
               </button>
            </div>
          </div>
        </section>

        {/* System Settings */}
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
                <img src={alsaifMark.url} className="size-6 grayscale opacity-20" alt="" />
             </div>
          </div>
        </section>
      </div>

      {/* Color Picker Overlay */}
      <AnimatePresence>
        {showColorPicker && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="card-surface w-full max-w-lg p-8 space-y-8 shadow-2xl rounded-[48px]">
               <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-primary tracking-tight">ألوان الهوية الفاخرة</h3>
                  <button onClick={() => setShowColorPicker(false)} className="size-10 rounded-full bg-muted flex items-center justify-center"><X size={20} /></button>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  {THEME_COLORS.map(c => (
                    <button key={c.id} onClick={() => handleThemeColorChange(c.id)} className={cn("p-5 rounded-[32px] border-2 transition-all text-right flex items-center gap-4 group", themeColor === c.id ? "border-primary bg-primary/5" : "border-transparent bg-muted/30 hover:bg-muted/50")}>
                       <div className="size-12 rounded-2xl shadow-lg shrink-0 group-hover:scale-110 transition-transform" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})` }} />
                       <span className="font-black text-sm">{c.name}</span>
                    </button>
                  ))}
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Font Picker Overlay */}
      <AnimatePresence>
        {showFontPicker && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="card-surface w-full max-w-lg p-8 space-y-8 shadow-2xl rounded-[48px]">
               <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-primary tracking-tight">تخصيص الخط</h3>
                  <button onClick={() => setShowFontPicker(false)} className="size-10 rounded-full bg-muted flex items-center justify-center"><X size={20} /></button>
               </div>
               <div className="space-y-3">
                  {FONTS.map(f => (
                    <button key={f.id} onClick={() => handleFontChange(f.id)} style={{ fontFamily: f.family }} className={cn("w-full p-6 rounded-3xl border-2 transition-all text-right flex items-center justify-between group", font === f.id ? "border-primary bg-primary/5" : "border-transparent bg-muted/30 hover:bg-muted/50")}>
                       <div>
                          <p className="text-lg font-bold">{f.name}</p>
                          <p className="text-xs opacity-60">{f.desc}</p>
                       </div>
                       <span className="text-2xl opacity-20 font-black group-hover:opacity-100 transition-opacity tracking-widest">أبج</span>
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
