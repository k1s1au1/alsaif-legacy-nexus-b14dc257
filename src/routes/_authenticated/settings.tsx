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
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [darkMode, setDarkMode] = useState<"light" | "dark" | "system">("system");
  const [appVersion, setAppVersion] = useState("1.0.0");
  const [isNative, setIsNative] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check for theme
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    if (savedTheme) setDarkMode(savedTheme);

    // Safely check for native platform using global objects only
    const win = window as any;
    const isMobile = win.Capacitor?.isNativePlatform();

    // For testing/UI purposes, we might want to show mobile settings if we are on a small screen too
    // but the request said "mobile settings not working", so let's make it visible and functional if possible
    if (isMobile || window.innerWidth < 768) {
      setIsNative(true);
      setAppVersion(isMobile ? "1.1.2 (Native)" : "1.1.2 (Web-Mobile)");

      if (win.Capacitor?.Plugins?.PushNotifications) {
        win.Capacitor.Plugins.PushNotifications.checkPermissions().then((res: any) => {
          setNotificationsEnabled(res.receive === "granted");
        });
      }
    }
  }, []);

  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    setDarkMode(theme);
    if (typeof window === "undefined") return;

    localStorage.setItem("theme", theme);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (theme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.toggle("dark", prefersDark);
    }
    toast.success("تم تحديث المظهر بنجاح", {
      description: `تم التحويل إلى الوضع ${theme === "dark" ? "الداكن" : theme === "light" ? "الفاتح" : "التلقائي"}`,
    });
  };

  const openNativeSettings = async () => {
    const win = window as any;
    if (win.Capacitor?.Plugins?.App) {
      toast.loading("جاري فتح إعدادات النظام...");
      try {
        await win.Capacitor.Plugins.App.openAppSettings();
      } catch (e) {
        toast.error("تعذر فتح الإعدادات تلقائياً");
      }
    } else {
      toast.info("هذه الميزة متاحة فقط عند تشغيل التطبيق على الجوال بنظام Native");
    }
  };

  const toggleNotifications = async () => {
    const win = window as any;
    if (win.Capacitor?.Plugins?.PushNotifications) {
      const perm = await win.Capacitor.Plugins.PushNotifications.requestPermissions();
      setNotificationsEnabled(perm.receive === "granted");
      if (perm.receive === "granted") {
        toast.success("تم تفعيل الإشعارات بنجاح");
      } else {
        toast.error("تم رفض صلاحية الإشعارات");
      }
    } else {
      toast.info("يرجى تفعيل الإشعارات من إعدادات المتصفح أو الجوال");
    }
  };

  return (
    <AppShell title="الإعدادات" user={{ name: "مستخدم", role: "عضو", initial: "م" }}>
      <div className="max-w-2xl mx-auto space-y-8 pb-12 animate-fade-up">

        {/* Appearance Section */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-primary uppercase tracking-[0.2em] px-2 opacity-70">المظهر العام</h3>
          <div className="card-surface overflow-hidden">
            <div className="p-5 flex items-center justify-between border-b border-border/60">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  {darkMode === "dark" ? <Moon size={20} /> : <Sun size={20} />}
                </div>
                <div>
                  <p className="text-[16px] font-bold text-foreground">الوضع الليلي</p>
                  <p className="text-[12px] text-muted-foreground">اختر النمط المفضل لعينيك</p>
                </div>
              </div>
            </div>
            <div className="p-4 grid grid-cols-3 gap-3">
              <ThemeOption
                active={darkMode === "light"}
                label="فاتح"
                onClick={() => handleThemeChange("light")}
                icon={<Sun size={18} />}
              />
              <ThemeOption
                active={darkMode === "dark"}
                label="داكن"
                onClick={() => handleThemeChange("dark")}
                icon={<Moon size={18} />}
              />
              <ThemeOption
                active={darkMode === "system"}
                label="تلقائي"
                onClick={() => handleThemeChange("system")}
                icon={<Smartphone size={18} />}
              />
            </div>
          </div>
        </section>

        {/* App Specific Settings */}
        <section className="space-y-4 animate-fade-in">
          <h3 className="text-xs font-bold text-primary uppercase tracking-[0.2em] px-2 opacity-70">إعدادات الجوال</h3>
          <div className="card-surface divide-y divide-border/60">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Bell size={20} />
                </div>
                <div>
                  <p className="text-[16px] font-bold text-foreground">إشعارات الجوال</p>
                  <p className="text-[12px] text-muted-foreground">
                    {notificationsEnabled ? "مفعّلة وتعمل بنجاح" : "الإشعارات معطلة حالياً"}
                  </p>
                </div>
              </div>
              {!notificationsEnabled && (
                <button
                  onClick={toggleNotifications}
                  className="text-[12px] bg-primary text-primary-foreground px-4 py-2 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-95"
                >
                  تفعيل
                </button>
              )}
            </div>
            <button
              onClick={openNativeSettings}
              className="w-full p-5 hover:bg-muted/50 transition-colors flex items-center justify-between group text-right"
            >
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Smartphone size={20} />
                </div>
                <div>
                  <p className="text-[16px] font-bold text-foreground">إعدادات النظام</p>
                  <p className="text-[12px] text-muted-foreground">إدارة الصلاحيات والخصوصية</p>
                </div>
              </div>
              <ExternalLink size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </div>
        </section>

        {/* Language Section */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-primary uppercase tracking-[0.2em] px-2 opacity-70">اللغة</h3>
          <div className="card-surface p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Languages size={20} />
              </div>
              <div>
                <p className="text-[16px] font-bold text-foreground">لغة التطبيق</p>
                <p className="text-[12px] text-muted-foreground">التطبيق متوفر حالياً باللغة العربية</p>
              </div>
            </div>
            <span className="text-[14px] font-bold text-primary bg-primary/5 px-5 py-2 rounded-xl border border-primary/20">
              العربية
            </span>
          </div>
        </section>

        {/* About Section */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-primary uppercase tracking-[0.2em] px-2 opacity-70">حول {isNative ? "التطبيق" : "المنصة"}</h3>
          <div className="card-surface divide-y divide-border/60">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Info size={20} />
                </div>
                <div className="text-right">
                  <p className="text-[16px] font-bold text-foreground">إصدار {isNative ? "التطبيق" : "الويب"}</p>
                  <p className="text-[12px] text-muted-foreground font-medium">{appVersion}</p>
                </div>
              </div>
            </div>
            <button className="w-full p-5 hover:bg-muted/50 transition-colors flex items-center justify-between group text-right">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="text-[16px] font-bold text-foreground">سياسة الخصوصية</p>
                  <p className="text-[12px] text-muted-foreground">كيفية حماية بيانات العائلة</p>
                </div>
              </div>
              <ExternalLink size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </div>
        </section>

        <div className="text-center space-y-3 mt-16 pb-8">
          <p className="text-[12px] text-muted-foreground uppercase tracking-[0.4em] font-black opacity-40">
            Alsaif Family Hub
          </p>
          <p className="text-[11px] text-muted-foreground font-medium">
            جميع الحقوق محفوظة &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function ThemeOption({ active, label, onClick, icon }: { active: boolean, label: string, onClick: () => void, icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-6 rounded-[28px] border transition-all duration-300 active:scale-95",
        active
          ? "bg-primary border-primary text-primary-foreground shadow-xl shadow-primary/20"
          : "bg-card border-border text-foreground hover:bg-muted/50 hover:border-primary/30"
      )}
    >
      <div className={cn("size-10 flex items-center justify-center rounded-full transition-all duration-500",
        active ? "bg-primary-foreground/20 scale-110" : "bg-primary/5")}>
        {icon}
      </div>
      <span className="text-[15px] font-bold">{label}</span>
    </button>
  );
}
