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
import { Capacitor } from "@capacitor/core";
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

    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    if (savedTheme) setDarkMode(savedTheme);

    const native = Capacitor.isNativePlatform();
    setIsNative(native);

    if (native) {
      // Lazy load Capacitor plugins to avoid SSR issues
      Promise.all([
        import("@capacitor/app"),
        import("@capacitor/push-notifications")
      ]).then(([{ App }, { PushNotifications }]) => {
        App.getInfo().then(info => {
          setAppVersion(`${info.version} (${info.build})`);
        });

        PushNotifications.checkPermissions().then(res => {
          setNotificationsEnabled(res.receive === "granted");
        });
      }).catch(err => {
        console.warn("Capacitor plugins could not be loaded", err);
      });
    }
  }, []);

  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    setDarkMode(theme);
    if (typeof window === "undefined") return;

    localStorage.setItem("theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (theme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    }
    toast.success("تم تحديث المظهر بنجاح");
  };

  const openNativeSettings = async () => {
    if (Capacitor.isNativePlatform()) {
      toast.info("جاري فتح إعدادات النظام الخاص بالتطبيق...");
      // In a real app, this would use a native settings plugin
    } else {
      toast.error("هذه الميزة متاحة فقط على تطبيق الجوال");
    }
  };

  return (
    <AppShell title="الإعدادات" user={{ name: "مستخدم", role: "عضو", initial: "م" }}>
      <div className="max-w-2xl mx-auto space-y-8 pb-12 animate-fade-up">

        {/* Appearance Section */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-gold-primary uppercase tracking-[0.2em] px-2">المظهر العام</h3>
          <div className="card-surface overflow-hidden">
            <div className="p-5 flex items-center justify-between border-b border-border/40">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary">
                  {darkMode === "dark" ? <Moon size={20} /> : <Sun size={20} />}
                </div>
                <div>
                  <p className="text-[15px] font-bold text-ivory">الوضع الليلي</p>
                  <p className="text-[12px] text-muted-foreground">اختر النمط المفضل لعينيك</p>
                </div>
              </div>
            </div>
            <div className="p-4 grid grid-cols-3 gap-3">
              <ThemeOption
                active={darkMode === "light"}
                label="فاتح"
                onClick={() => handleThemeChange("light")}
                icon={<Sun size={16} />}
              />
              <ThemeOption
                active={darkMode === "dark"}
                label="داكن"
                onClick={() => handleThemeChange("dark")}
                icon={<Moon size={16} />}
              />
              <ThemeOption
                active={darkMode === "system"}
                label="تلقائي"
                onClick={() => handleThemeChange("system")}
                icon={<Smartphone size={16} />}
              />
            </div>
          </div>
        </section>

        {/* App Specific Settings - Only show on Native */}
        {isNative && (
          <section className="space-y-4 animate-fade-in">
            <h3 className="text-xs font-bold text-gold-primary uppercase tracking-[0.2em] px-2">إعدادات الجوال</h3>
            <div className="card-surface divide-y divide-border/40">
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary">
                    <Bell size={20} />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-ivory">إشعارات الجوال</p>
                    <p className="text-[12px] text-muted-foreground">
                      {notificationsEnabled ? "مفعّلة وتعمل بنجاح" : "الإشعارات معطلة حالياً"}
                    </p>
                  </div>
                </div>
                {!notificationsEnabled && (
                  <button
                    onClick={openNativeSettings}
                    className="text-[11px] bg-gold-primary text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-gold-primary/20 transition-transform active:scale-95"
                  >
                    تفعيل
                  </button>
                )}
              </div>
              <button
                onClick={openNativeSettings}
                className="w-full p-5 hover:bg-gold-primary/5 transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary">
                    <Smartphone size={20} />
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-bold text-ivory">إعدادات النظام</p>
                    <p className="text-[12px] text-muted-foreground">إدارة الصلاحيات والخصوصية</p>
                  </div>
                </div>
                <ExternalLink size={16} className="text-muted-foreground group-hover:text-gold-primary transition-colors" />
              </button>
            </div>
          </section>
        )}

        {/* Language Section */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-gold-primary uppercase tracking-[0.2em] px-2">اللغة</h3>
          <div className="card-surface p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary">
                <Languages size={20} />
              </div>
              <div>
                <p className="text-[15px] font-bold text-ivory">لغة التطبيق</p>
                <p className="text-[12px] text-muted-foreground">التطبيق متوفر حالياً باللغة العربية</p>
              </div>
            </div>
            <span className="text-[13px] font-bold text-gold-primary bg-gold-primary/5 px-4 py-2 rounded-xl border border-gold-primary/20">
              العربية
            </span>
          </div>
        </section>

        {/* About Section */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-gold-primary uppercase tracking-[0.2em] px-2">حول {isNative ? "التطبيق" : "المنصة"}</h3>
          <div className="card-surface divide-y divide-border/40">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary">
                  <Info size={20} />
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-bold text-ivory">إصدار {isNative ? "التطبيق" : "الويب"}</p>
                  <p className="text-[12px] text-muted-foreground">{appVersion}</p>
                </div>
              </div>
            </div>
            <button className="w-full p-5 hover:bg-gold-primary/5 transition-colors flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary">
                  <ShieldCheck size={20} />
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-bold text-ivory">سياسة الخصوصية</p>
                  <p className="text-[12px] text-muted-foreground">كيفية حماية بيانات العائلة</p>
                </div>
              </div>
              <ExternalLink size={16} className="text-muted-foreground group-hover:text-gold-primary transition-colors" />
            </button>
          </div>
        </section>

        <div className="text-center space-y-2 mt-12">
          <p className="text-[11px] text-muted-foreground uppercase tracking-[0.3em] font-bold opacity-60">
            Alsaif Family Hub
          </p>
          <p className="text-[10px] text-muted-foreground">
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
        "flex flex-col items-center justify-center gap-2 py-4 rounded-[20px] border transition-all duration-300 active:scale-95",
        active
          ? "bg-gold-primary/10 border-gold-primary/40 text-gold-primary shadow-[0_8px_20px_-8px_rgba(212,175,55,0.4)]"
          : "bg-background/40 border-border/50 text-muted-foreground hover:bg-background/60"
      )}
    >
      <div className={cn("size-8 rounded-full flex items-center justify-center transition-transform duration-500", active && "scale-110")}>
        {icon}
      </div>
      <span className="text-[12px] font-bold">{label}</span>
    </button>
  );
}
