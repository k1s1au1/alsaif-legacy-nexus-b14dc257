import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
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
  Plus,
  Minus,
  ImagePlus,
  Star,
  Fingerprint,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { motion, AnimatePresence } from "framer-motion";
import { BiometricAuth } from "@/lib/native-bridge";
import { setupPushNotifications } from "@/lib/pushNotifications";

const FONTS = [
  { id: "Tajawal", name: "تجوال (عصري)", family: "'Tajawal', sans-serif", desc: "خط ناعم وأنيق" },
  { id: "Cairo", name: "كايـرو (عريض)", family: "'Cairo', sans-serif", desc: "وضوح عالي جداً" },
  { id: "Lalezar", name: "لاليزار (فني)", family: "'Lalezar', cursive", desc: "خط عريض ومميز" },
  { id: "Amiri", name: "الأميري (تراثي)", family: "'Amiri', serif", desc: "طابع كلاسيكي فاخر" },
  { id: "Changa", name: "شانغا (هندسي)", family: "'Changa', sans-serif", desc: "زوايا حادة وقوية" },
  {
    id: "ReemKufi",
    name: "ريم كوفي (كوفي)",
    family: "'Reem Kufi', sans-serif",
    desc: "أصالة الخط الكوفي",
  },
  {
    id: "Markazi",
    name: "مركزي (أدبي)",
    family: "'Markazi Text', serif",
    desc: "خط الكتب والروايات",
  },
  {
    id: "Vazirmatn",
    name: "وزير (بسيط)",
    family: "'Vazirmatn', sans-serif",
    desc: "بساطة تقنية حديثة",
  },
];

const THEME_COLORS = [
  {
    id: "emerald",
    name: "أخضر السيف (الأصلي)",
    primary: "#0B5D4B",
    secondary: "#C4A260",
    darkPrimary: "#46A982",
    darkSecondary: "#DEC27E",
    foreground: "#FFFFFF",
    isPrimary: true,
    mesh: ["rgba(196, 162, 96, 0.12)", "rgba(11, 93, 75, 0.08)"],
  },
  {
    id: "royal-gold",
    name: "أخضر المجلس",
    primary: "#155E52",
    secondary: "#D1B16B",
    darkPrimary: "#65B99A",
    darkSecondary: "#E4CE94",
    foreground: "#FFFFFF",
    mesh: ["rgba(209, 177, 107, 0.12)", "rgba(21, 94, 82, 0.08)"],
  },
  {
    id: "vibrant-emerald",
    name: "ذهب السيف",
    primary: "#A98445",
    secondary: "#155E52",
    darkPrimary: "#D6B56A",
    darkSecondary: "#5CB392",
    foreground: "#173E35",
    mesh: ["rgba(169, 132, 69, 0.12)", "rgba(21, 94, 82, 0.08)"],
  },
  {
    id: "midnight",
    name: "زيتوني هادئ",
    primary: "#657044",
    secondary: "#C9AA69",
    darkPrimary: "#AAB77C",
    darkSecondary: "#E1C889",
    foreground: "#FFFFFF",
    mesh: ["rgba(201, 170, 105, 0.12)", "rgba(101, 112, 68, 0.08)"],
  },
  {
    id: "burgundy",
    name: "كحلي السمر",
    primary: "#24443F",
    secondary: "#B99A5D",
    darkPrimary: "#6F9B90",
    darkSecondary: "#D9C184",
    foreground: "#FFFFFF",
    mesh: ["rgba(185, 154, 93, 0.12)", "rgba(36, 68, 63, 0.08)"],
  },
  {
    id: "pure-white",
    name: "العاجي الدافئ",
    primary: "#F3ECDD",
    secondary: "#8D7345",
    darkPrimary: "#E9DECA",
    darkSecondary: "#D0B172",
    foreground: "#184E42",
    mesh: ["rgba(141, 115, 69, 0.12)", "rgba(243, 236, 221, 0.16)"],
  },
  {
    id: "sand",
    name: "رمل الديوان",
    primary: "#B7996A",
    secondary: "#315C50",
    darkPrimary: "#D8BF91",
    darkSecondary: "#75AA95",
    foreground: "#243E36",
    mesh: ["rgba(183, 153, 106, 0.12)", "rgba(49, 92, 80, 0.08)"],
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
  const [fontScale, setFontScale] = useState(1);
  const [themeColor, setThemeColor] = useState("emerald");
  const [appVersion, setAppVersion] = useState("1.1.9 (Web)");
  const [isNative, setIsNative] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [canCustomizeBg, setCanCustomizeBg] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const dynamicLogo = useSiteLogo();

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.user.id);
      const rs = (roles ?? []).map((r) => r.role);
      setCanCustomizeBg(rs.includes("admin") || rs.includes("chairman"));
    })();
  }, []);

  useEffect(() => {
    setBiometricEnabled(localStorage.getItem("app-use-biometrics") === "true");

    if (!Capacitor.isNativePlatform()) return;

    BiometricAuth.checkBiometry()
      .then(({ isAvailable }) => setBiometricsAvailable(isAvailable))
      .catch(() => setBiometricsAvailable(false));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    if (savedTheme) {
      setDarkMode(savedTheme);
      applyTheme(savedTheme);
    } else {
      setDarkMode("system");
    }

    const savedFont = localStorage.getItem("app-font-id");
    if (savedFont) {
      setFont(savedFont);
      const fontObj = FONTS.find((f) => f.id === savedFont);
      if (fontObj) applyFont(fontObj.family);
    }

    const savedScale = localStorage.getItem("app-font-scale");
    if (savedScale) {
      setFontScale(parseFloat(savedScale));
    }

    const savedStyle = localStorage.getItem("font-style") as "modern" | "royal" | null;
    if (savedStyle) {
      setFontStyle(savedStyle);
      applyFontStyle(savedStyle);
    }

    const savedColor = localStorage.getItem("app-theme-color-id");
    if (savedColor) {
      setThemeColor(savedColor);
      const colorObj = THEME_COLORS.find((c) => c.id === savedColor);
      if (colorObj) applyThemeColors(colorObj);
    }

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
    const isDark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", isDark);

    const savedColor = localStorage.getItem("app-theme-color-id") || "emerald";
    const colorObj = THEME_COLORS.find((c) => c.id === savedColor);
    if (colorObj) applyThemeColors(colorObj);
  };

  const applyFont = (fontFamily: string) => {
    document.documentElement.style.setProperty("--app-font", fontFamily);
  };

  const applyFontScale = (scale: number) => {
    document.documentElement.style.setProperty("--app-font-scale", scale.toString());
    document.documentElement.style.fontSize = `calc(16px * ${scale})`;
  };

  const handleFontScaleChange = (scale: number) => {
    setFontScale(scale);
    localStorage.setItem("app-font-scale", scale.toString());
    applyFontScale(scale);
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
    const selected = FONTS.find((f) => f.id === fontId);
    if (!selected) return;
    setFont(fontId);
    localStorage.setItem("app-font-id", fontId);
    applyFont(selected.family);
    toast.success(`تم تفعيل خط ${selected.name}`);
    setShowFontPicker(false);
  };

  const applyThemeColors = (colors: (typeof THEME_COLORS)[0]) => {
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");

    root.style.setProperty("--primary", isDark ? colors.darkPrimary : colors.primary);
    root.style.setProperty(
      "--gold-primary",
      isDark ? colors.darkSecondary || colors.secondary : colors.secondary,
    );
    root.style.setProperty("--primary-foreground", colors.foreground);

    if (colors.mesh) {
      root.style.setProperty("--mesh-color-1", colors.mesh[0]);
      root.style.setProperty("--mesh-color-2", colors.mesh[1]);
    }
  };

  const handleThemeColorChange = (colorId: string) => {
    const selected = THEME_COLORS.find((c) => c.id === colorId);
    if (!selected) return;
    setThemeColor(colorId);
    localStorage.setItem("app-theme-color-id", colorId);
    applyThemeColors(selected);
    toast.success(`تم تفعيل ${selected.name}`);
    setShowColorPicker(false);
  };

  const handleBiometricChange = async () => {
    if (!biometricsAvailable) {
      toast.error("فعّل البصمة أو رمز قفل الشاشة من إعدادات جهازك أولاً.");
      return;
    }

    if (biometricEnabled) {
      localStorage.removeItem("app-use-biometrics");
      sessionStorage.removeItem("app-biometric-unlocked");
      setBiometricEnabled(false);
      toast.success("تم إيقاف قفل التطبيق");
      return;
    }

    try {
      const result = await BiometricAuth.authenticate({
        title: "تفعيل قفل التطبيق",
        subtitle: "استخدم البصمة أو رمز قفل الجهاز للتأكيد",
      });

      if (!result.success) return;
      localStorage.setItem("app-use-biometrics", "true");
      sessionStorage.setItem("app-biometric-unlocked", "true");
      setBiometricEnabled(true);
      toast.success("تم تفعيل قفل التطبيق بالبصمة أو رمز الجهاز");
    } catch {
      toast.error("تعذر تفعيل القفل. تأكد من إعداد البصمة أو رمز قفل على جهازك.");
    }
  };

  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    setDarkMode(theme);
    localStorage.setItem("theme", theme);
    applyTheme(theme);
    toast.success(
      `تم تفعيل الوضع ${theme === "dark" ? "الداكن" : theme === "light" ? "الفاتح" : "التلقائي"}`,
    );
  };

  const currentThemeObj = THEME_COLORS.find((c) => c.id === themeColor) || THEME_COLORS[0];
  const currentFontObj = FONTS.find((f) => f.id === font) || FONTS[0];

  const handleRegisterPush = async () => {
    const tId = toast.loading("جاري محاولة ربط الجهاز...");
    try {
      if (Capacitor.isNativePlatform()) {
        // استخدام الإعدادات الأصلية للجوال فقط كما طلب المستخدم
        await setupPushNotifications();

        // ننتظر قليلاً لضمان تنفيذ مستمع التسجيل وحفظ الـ Token في قاعدة البيانات
        await new Promise((resolve) => setTimeout(resolve, 4000));
      } else {
        // Handle Web Push Registration
        const { isSupported, getMessaging, getToken } = await import("firebase/messaging");
        const { initializeApp, getApps } = await import("firebase/app");
        const { FIREBASE_CONFIG, FCM_VAPID_KEY } = await import("@/lib/fcm-config");

        if (!(await isSupported())) {
          throw new Error("المتصفح لا يدعم الإشعارات");
        }

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          throw new Error("لم يتم منح إذن الإشعارات");
        }

        const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
        const messaging = getMessaging(app);

        const token = await getToken(messaging, { vapidKey: FCM_VAPID_KEY });
        if (token) {
          const { data: auth } = await supabase.auth.getUser();
          if (auth.user) {
            await supabase.from("push_tokens").upsert(
              { user_id: auth.user.id, token, platform: "web", is_active: true },
              { onConflict: "token" }
            );
          }
        }
      }

      // فحص جدول push_tokens للمستخدم الحالي لعرض نتيجة الربط
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const { data: tokens } = await supabase
          .from("push_tokens")
          .select("id")
          .eq("user_id", auth.user.id)
          .eq("is_active", true)
          .limit(1);

        toast.dismiss(tId);
        if (tokens && tokens.length > 0) {
          toast.success("مبروك! تم ربط جهازك بنجاح بنظام الإشعارات ✨");
        } else {
          toast.error("لم يتم تسجيل الجهاز بعد. تأكد من منح الأذونات اللازمة.");
        }
      } else {
        toast.dismiss(tId);
      }
    } catch (e: any) {
      toast.dismiss(tId);
      toast.error("فشل الربط: " + (e.message || "خطأ غير معروف"));
    }
  };

  return (
    <AppShell title="الإعدادات" user={{ name: "إعدادات الأخبار", role: "تخصيص", initial: "إ" }}>
      <div className="max-w-4xl mx-auto space-y-12 pb-24" dir="rtl">
        <section className="space-y-6 animate-fade-up">
          <div className="flex items-center gap-4">
            <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
              مظهر المنصة
            </h3>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ThemeCard
              active={darkMode === "light"}
              onClick={() => handleThemeChange("light")}
              label="فاتح"
              icon={<Sun />}
            />
            <ThemeCard
              active={darkMode === "dark"}
              onClick={() => handleThemeChange("dark")}
              label="داكن"
              icon={<Moon />}
            />
            <ThemeCard
              active={darkMode === "system"}
              onClick={() => handleThemeChange("system")}
              label="تلقائي"
              icon={<Smartphone />}
            />
          </div>
        </section>

        <section className="space-y-6 animate-fade-up" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center gap-4">
            <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
              النمط والخطوط
            </h3>
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
                    className={cn(
                      "flex-1 py-3 rounded-xl font-black text-xs transition-all",
                      fontStyle === "modern"
                        ? "bg-primary text-white shadow-lg"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    عصري
                  </button>
                  <button
                    onClick={() => handleFontStyleChange("royal")}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-black text-xs transition-all",
                      fontStyle === "royal"
                        ? "bg-gold-primary text-white shadow-lg"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    ملكي (مخطوطة)
                  </button>
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
                  <button
                    onClick={() => setShowFontPicker(true)}
                    className="text-[10px] font-black text-gold-primary uppercase tracking-widest hover:underline"
                  >
                    تغيير
                  </button>
                </div>
                <div className="p-4 rounded-2xl bg-muted/30 border border-border/60">
                  <p className="text-sm font-bold text-primary">{currentFontObj.name}</p>
                  <p className="text-[10px] text-muted-foreground">{currentFontObj.desc}</p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-border/40">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <Type className="size-5" />
                  </div>
                  <div className="text-right">
                    <h4 className="text-lg font-black text-primary">تكبير الخطوط</h4>
                    <p className="text-[10px] text-muted-foreground font-bold">
                      تحكم في حجم نصوص المنصة بالكامل
                    </p>
                  </div>
                </div>
                <div className="px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-primary font-black text-xs">
                  {Math.round(fontScale * 100)}%
                </div>
              </div>

              <div className="flex items-center gap-6">
                <button
                  onClick={() => handleFontScaleChange(Math.max(0.8, fontScale - 0.05))}
                  className="size-12 rounded-2xl bg-muted flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all active:scale-90"
                >
                  <Minus size={20} strokeWidth={3} />
                </button>

                <div className="flex-1 px-2">
                  <input
                    type="range"
                    min="0.8"
                    max="1.5"
                    step="0.05"
                    value={fontScale}
                    onChange={(e) => handleFontScaleChange(parseFloat(e.target.value))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between mt-2 px-1 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                    <span>افتراضي</span>
                    <span>كبير</span>
                    <span>ضخم</span>
                  </div>
                </div>

                <button
                  onClick={() => handleFontScaleChange(Math.min(1.5, fontScale + 0.05))}
                  className="size-12 rounded-2xl bg-primary flex items-center justify-center text-white hover:brightness-110 transition-all active:scale-90 shadow-lg shadow-primary/20"
                >
                  <Plus size={20} strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card-surface p-8 space-y-6 group">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                    لون الهوية
                  </p>
                  <h4 className="text-xl font-black text-primary">{currentThemeObj.name}</h4>
                </div>
                <div
                  className="size-14 rounded-2xl shadow-xl transition-transform group-hover:rotate-12 duration-500"
                  style={{
                    background: `linear-gradient(135deg, ${currentThemeObj.primary}, ${currentThemeObj.secondary})`,
                  }}
                />
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
            <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
              إعدادات النظام
            </h3>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="card-surface overflow-hidden divide-y divide-border/40">
            <SettingRow icon={<Languages />} title="لغة الواجهة" desc="العربية (الافتراضية)" />
            <SettingRow icon={<Bell />} title="الإشعارات" desc="مفعلة لكافة الأحداث" />
            <SettingRow icon={<ShieldCheck />} title="الأمان" desc="التحقق من الهوية مفعل" />

            <div className="p-8 flex items-center justify-between text-muted-foreground/40 italic">
              <span className="text-[10px] font-black uppercase tracking-widest">
                Version {appVersion}
              </span>
              <div
                className="size-6 logo-alsaif grayscale opacity-20"
                style={{ "--logo-url": dynamicLogo ? `url(${dynamicLogo})` : "none" } as any}
              />
            </div>
          </div>
        </section>

        {isNative && (
          <section className="space-y-6 animate-fade-up" style={{ animationDelay: "250ms" }}>
            <div className="flex items-center gap-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
                حماية التطبيق
              </h3>
              <div className="h-px flex-1 bg-border/60" />
            </div>

            <div className="card-surface p-6 flex items-center justify-between gap-5">
              <div className="flex items-center gap-4 min-w-0">
                <div className="size-12 shrink-0 rounded-2xl bg-gold-primary/10 text-gold-primary flex items-center justify-center">
                  <Fingerprint className="size-6" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-black text-primary">القفل بالبصمة أو رمز الجهاز</h4>
                  <p className="mt-1 text-[11px] leading-relaxed font-bold text-muted-foreground">
                    {biometricsAvailable
                      ? "يطلب تأكيد هويتك عند فتح التطبيق أو العودة إليه."
                      : "فعّل البصمة أو رمز قفل الشاشة من إعدادات جهازك أولاً."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={biometricEnabled}
                onClick={handleBiometricChange}
                disabled={!biometricsAvailable}
                className={cn(
                  "relative h-8 w-14 shrink-0 rounded-full transition-colors duration-300 focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-45",
                  biometricEnabled ? "bg-primary" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 right-1 size-6 rounded-full bg-white shadow-md transition-transform duration-300",
                    biometricEnabled ? "-translate-x-6" : "translate-x-0",
                  )}
                />
              </button>
            </div>
          </section>
        )}

        <NotificationPreferencesSection />

        <section className="space-y-6 animate-fade-up">
          <div className="flex items-center gap-4">
            <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
              تجربة الإشعارات ({isNative ? "تطبيق الجوال" : "المتصفح"})
            </h3>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="card-surface p-8 space-y-4">
            <p className="text-sm font-bold text-muted-foreground">
              إذا لم تكن الإشعارات تصلك، يمكنك محاولة إعادة طلب الإذن يدوياً من هنا.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleRegisterPush}
                className="flex-1 btn-gold py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-sm shadow-xl"
              >
                {isNative ? <Smartphone className="size-5" /> : <Bell className="size-5" />}
                {isNative ? "إعادة ربط الجوال" : "تفعيل إشعارات المتصفح"}
              </button>

              <button
                onClick={async () => {
                  const tId = toast.loading("جاري إرسال إشعار تجريبي لجهازك...");
                  try {
                    const { data: auth } = await supabase.auth.getUser();
                    const { data: result, error } = await supabase.functions.invoke("send-push", {
                      body: {
                        title: "🔔 تجربة الإشعارات",
                        body: "هذا إشعار تجريبي من مجلس السيف الرقمي ✨",
                        user_ids: [auth.user?.id],
                      }
                    });
                    toast.dismiss(tId);
                    if (error) throw error;
                    if (result?.sent > 0) {
                      toast.success("تم إرسال الإشعار بنجاح! تفقد مركز التنبيهات.");
                    } else {
                      toast.error("فشل الإرسال. تأكد من أن جهازك مسجل ومسموح له بالاستقبال.");
                    }
                  } catch (e: any) {
                    toast.dismiss(tId);
                    toast.error("خطأ تقني: " + e.message);
                  }
                }}
                className="px-8 py-4 rounded-2xl bg-white/5 text-white font-black text-sm border border-white/10 hover:bg-white/10 transition-all"
              >
                إرسال تجربة
              </button>
            </div>
          </div>
        </section>

        {canCustomizeBg && (
          <section className="space-y-6 animate-fade-up" style={{ animationDelay: "300ms" }}>
            <div className="flex items-center gap-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
                خلفيات الواجهة
              </h3>
              <div className="h-px flex-1 bg-border/60" />
            </div>
            <div className="card-surface p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary">
                  <ImagePlus className="size-6" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-primary">تخصيص الخلفيات</h4>
                  <p className="text-xs font-bold text-muted-foreground opacity-60">
                    متاح للمسؤولين التقنيين ورئيس المجلس فقط.
                  </p>
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-50">
                    شعار المنصة
                  </p>
                  <BackgroundUploader inline settingKey="site_logo" label="تحديث الشعار الرسمي" />
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-50">
                    خلفية صفحة الدخول
                  </p>
                  <BackgroundUploader inline settingKey="auth_bg" label="تغيير خلفية الترحيب" />
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <AnimatePresence>
        {showColorPicker && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            dir="rtl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card-surface w-full max-w-lg p-8 space-y-8 shadow-2xl rounded-[48px]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-primary tracking-tight">
                  ألوان الهوية الفاخرة
                </h3>
                <button
                  onClick={() => setShowColorPicker(false)}
                  className="size-10 rounded-full bg-muted flex items-center justify-center transition-transform hover:rotate-90"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {THEME_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleThemeColorChange(c.id)}
                    className={cn(
                      "p-5 rounded-[32px] border-2 transition-all text-right flex items-center gap-4 group relative",
                      themeColor === c.id
                        ? "border-primary bg-primary/5 shadow-inner"
                        : "border-transparent bg-muted/30 hover:bg-muted/50",
                    )}
                  >
                    <div
                      className="size-12 rounded-2xl shadow-lg shrink-0 group-hover:scale-110 transition-transform"
                      style={{
                        background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})`,
                      }}
                    />
                    <div className="flex-1">
                      <span className="font-black text-sm block text-primary">{c.name}</span>
                      {c.isPrimary && (
                        <span className="text-[9px] font-black text-gold-primary uppercase tracking-widest mt-0.5">
                          الهوية الأساسية
                        </span>
                      )}
                    </div>
                    {c.isPrimary && (
                      <Star className="absolute top-4 left-4 size-4 text-gold-primary fill-gold-primary" />
                    )}
                    {themeColor === c.id && (
                      <div className="absolute top-1/2 left-4 -translate-y-1/2 size-6 rounded-full bg-primary flex items-center justify-center text-white">
                        <Check size={14} strokeWidth={4} />
                      </div>
                    )}
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
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card-surface w-full max-w-lg p-6 space-y-6 shadow-2xl rounded-[40px]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-primary tracking-tight">تخصيص الخط</h3>
                <button
                  onClick={() => setShowFontPicker(false)}
                  className="size-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {FONTS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleFontChange(f.id)}
                    style={{ fontFamily: f.family }}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all text-right flex items-center justify-between group",
                      font === f.id
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted/30 hover:bg-muted/50",
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold truncate">{f.name}</p>
                      <p className="text-[10px] opacity-60 truncate">{f.desc}</p>
                    </div>
                    <span className="text-xl opacity-20 font-black group-hover:opacity-100 transition-opacity shrink-0">
                      أبج
                    </span>
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
    <button
      onClick={onClick}
      className={cn(
        "p-6 md:p-8 rounded-[32px] md:rounded-[40px] border-4 transition-all duration-500 flex flex-col items-center gap-3 md:gap-4 text-center",
        active
          ? "bg-primary border-gold-primary text-primary-foreground shadow-2xl scale-105"
          : "bg-card border-transparent text-muted-foreground hover:bg-muted",
      )}
    >
      <div
        className={cn(
          "size-12 md:size-16 rounded-[22px] md:rounded-[28px] flex items-center justify-center transition-all duration-700",
          active ? "bg-white/10 text-gold-primary rotate-12" : "bg-muted text-primary",
        )}
      >
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

const NOTIF_OPTIONS: {
  key: "meetings" | "entertainment" | "tasks" | "chat" | "news";
  label: string;
  desc: string;
}[] = [
  { key: "meetings", label: "إشعارات الاجتماعات", desc: "تنبيه عند إنشاء اجتماع جديد." },
  { key: "entertainment", label: "إشعارات الترفيه", desc: "تنبيه للفعاليات والرحلات والمناسبات." },
  { key: "tasks", label: "إشعارات المهام", desc: "تنبيه عند إسناد مهمة لك." },
  { key: "chat", label: "إشعارات المحادثات", desc: "تنبيه عند وصول رسالة جديدة." },
  { key: "news", label: "إشعارات الأخبار والإعلانات", desc: "تنبيه عند نشر خبر أو إعلان." },
];

function NotificationPreferencesSection() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    meetings: true,
    entertainment: true,
    tasks: true,
    chat: true,
    news: true,
  });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        return;
      }
      setUserId(auth.user.id);
      const { data } = await supabase
        .from("notification_preferences")
        .select("meetings,entertainment,tasks,chat,news")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (data) setPrefs(data as any);
      setLoading(false);
    })();
  }, []);

  const toggle = async (key: string) => {
    if (!userId) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: userId, ...next }, { onConflict: "user_id" });
    if (error) {
      toast.error("تعذّر حفظ الإعداد");
      setPrefs(prefs);
    }
  };

  return (
    <section className="space-y-6 animate-fade-up" style={{ animationDelay: "250ms" }}>
      <div className="flex items-center gap-4">
        <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
          إعدادات الإشعارات
        </h3>
        <div className="h-px flex-1 bg-border/60" />
      </div>
      <div className="card-surface overflow-hidden divide-y divide-border/40">
        {NOTIF_OPTIONS.map((o) => (
          <div key={o.key} className="p-6 md:p-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 md:gap-6 min-w-0">
              <div className="size-11 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
                <Bell className="size-5" />
              </div>
              <div className="text-right min-w-0">
                <p className="font-black text-primary tracking-tight text-sm md:text-base">
                  {o.label}
                </p>
                <p className="text-xs font-bold text-muted-foreground opacity-60 truncate">
                  {o.desc}
                </p>
              </div>
            </div>
            <button
              onClick={() => toggle(o.key)}
              disabled={loading}
              aria-pressed={prefs[o.key]}
              className={cn(
                "relative w-14 h-8 rounded-full transition-colors shrink-0",
                prefs[o.key] ? "bg-primary" : "bg-muted",
                loading && "opacity-50",
              )}
            >
              <span
                className={cn(
                  "absolute top-1 size-6 rounded-full bg-white shadow transition-all",
                  prefs[o.key] ? "right-1" : "right-7",
                )}
              />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
