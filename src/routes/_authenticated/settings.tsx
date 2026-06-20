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
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [darkMode, setDarkMode] = useState<"light" | "dark" | "system">("system");
  const [appVersion, setAppVersion] = useState("1.1.5 (Web)");
  const [isNative, setIsNative] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load saved theme
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    if (savedTheme) {
      setDarkMode(savedTheme);
      applyTheme(savedTheme);
    }

    // Safe Capacitor detection
    const win = window as any;
    if (win.Capacitor?.isNativePlatform()) {
      setIsNative(true);
      setAppVersion("1.1.5 (Native)");

      const plugins = win.Capacitor?.Plugins;
      if (plugins?.App) {
        plugins.App.getInfo().then((info: any) => setAppVersion(`${info.version} (${info.build})`));
      }
      if (plugins?.PushNotifications) {
        plugins.PushNotifications.checkPermissions().then((res: any) => setNotificationsEnabled(res.receive === "granted"));
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

  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    setDarkMode(theme);
    if (typeof window === "undefined") return;
    localStorage.setItem("theme", theme);
    applyTheme(theme);
    toast.success("تم تحديث المظهر", {
      description: `تم اختيار الوضع ${theme === "dark" ? "الداكن" : theme === "light" ? "الفاتح" : "التلقائي"}`,
      icon: <Check className="text-emerald-500" />
    });
  };

  return (
    <AppShell title="الإعدادات" user={{ name: "مستخدم", role: "عضو", initial: "م" }}>
      <div className="max-w-3xl mx-auto space-y-10 pb-20 animate-fade-up">

        {/* Appearance - High Legibility */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 px-2">
             <div className="size-1 w-12 bg-primary rounded-full" />
             <h3 className="text-sm font-black text-primary uppercase tracking-[0.2em]">تخصيص المظهر</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <ThemeCard
               active={darkMode === "light"}
               onClick={() => handleThemeChange("light")}
               label="الوضع الفاتح"
               desc="مثالي للقراءة في النهار"
               icon={<Sun className="size-8" />}
             />
             <ThemeCard
               active={darkMode === "dark"}
               onClick={() => handleThemeChange("dark")}
               label="الوضع الداكن"
               desc="مريح للعين في المساء"
               icon={<Moon className="size-8" />}
             />
             <ThemeCard
               active={darkMode === "system"}
               onClick={() => handleThemeChange("system")}
               label="تلقائي"
               desc="يتبع إعدادات جهازك"
               icon={<Smartphone className="size-8" />}
             />
          </div>
        </section>

        {/* System Integration */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 px-2">
             <div className="size-1 w-12 bg-[#8E7745] rounded-full" />
             <h3 className="text-sm font-black text-[#8E7745] uppercase tracking-[0.2em]">تكامل النظام</h3>
          </div>

          <div className="card-surface divide-y divide-border/60 overflow-hidden border-none shadow-2xl">
             {isNative && (
               <SettingItem
                 icon={<Bell />}
                 title="تنبيهات الجوال"
                 desc={notificationsEnabled ? "الإشعارات المنبثقة مفعّلة" : "اضغط لتفعيل تنبيهات المجلس"}
                 onClick={() => toast.info("يتم تحويلك لإعدادات الإشعارات...")}
               />
             )}
             <SettingItem
               icon={<Languages />}
               title="لغة الواجهة"
               desc="اللغة الحالية: العربية (الإقليمية)"
               badge="افتراضي"
             />
             <SettingItem
               icon={<ShieldCheck />}
               title="الخصوصية والأمان"
               desc="إدارة بياناتك والتحقق بخطوتين"
               onClick={() => toast.info("ستتوفر قريباً")}
             />
             <SettingItem
               icon={<Info />}
               title="إصدار المنصة"
               desc={`الإصدار الحالي: ${appVersion}`}
             />
          </div>
        </section>

        <div className="pt-10 flex flex-col items-center gap-2 opacity-30">
           <img src={alsaifMark.url} className="size-12 grayscale" alt="Mark" />
           <p className="text-[11px] font-black uppercase tracking-[0.5em]">Alsaif Family Hub</p>
        </div>
      </div>
    </AppShell>
  );
}

function ThemeCard({ active, label, desc, onClick, icon }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-8 rounded-[36px] text-right transition-all duration-500 flex flex-col gap-6 group relative overflow-hidden border-4",
        active
          ? "bg-[#1B4332] border-[#D4AF37] text-white shadow-2xl"
          : "bg-white border-transparent text-[#4A4A4A] hover:bg-[#F2F2F7]"
      )}
    >
      <div className={cn("size-16 rounded-3xl flex items-center justify-center transition-all duration-700",
        active ? "bg-white/10 text-[#D4AF37] rotate-12" : "bg-[#F2F2F7] text-primary")}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-black tracking-tight">{label}</p>
        <p className={cn("text-xs font-bold mt-1", active ? "text-white/60" : "text-[#8E8E93]")}>{desc}</p>
      </div>
      {active && <div className="absolute -bottom-4 -left-4 size-20 bg-white/5 rounded-full blur-3xl" />}
    </button>
  );
}

function SettingItem({ icon, title, desc, onClick, badge }: any) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="w-full p-8 flex items-center justify-between group hover:bg-[#F8F7F2] transition-all text-right"
    >
      <div className="flex items-center gap-6">
        <div className="size-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-inner">
          {icon}
        </div>
        <div>
          <p className="text-lg font-black text-[#0A0A0B]">{title}</p>
          <p className="text-sm font-bold text-[#8E8E93] mt-0.5">{desc}</p>
        </div>
      </div>
      {badge ? (
        <span className="px-3 py-1 bg-primary/5 text-primary text-[10px] font-black rounded-lg border border-primary/10">{badge}</span>
      ) : onClick ? (
        <ChevronLeft className="size-5 text-[#E5E4E0] group-hover:text-primary transition-colors" />
      ) : null}
    </button>
  );
}
