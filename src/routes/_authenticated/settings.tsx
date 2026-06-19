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

    // Completely avoid explicit imports of Capacitor to fix Build error
    const win = window as any;
    const Capacitor = win.Capacitor;

    if (Capacitor?.isNativePlatform()) {
      setIsNative(true);

      // Attempt to get app info using a safe dynamic pattern
      const initNativeData = async () => {
        try {
          const plugins = win.Capacitor?.Plugins;
          if (plugins?.App) {
            const info = await plugins.App.getInfo();
            setAppVersion(`${info.version} (${info.build})`);
          }
          if (plugins?.PushNotifications) {
            const res = await plugins.PushNotifications.checkPermissions();
            setNotificationsEnabled(res.receive === "granted");
          }
        } catch (e) {
          console.warn("Native plugin access failed", e);
        }
      };
      initNativeData();
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
    toast.info("جاري فتح إعدادات النظام الخاص بالتطبيق...");
  };

  return (
    <AppShell title="الإعدادات" user={{ name: "مستخدم", role: "عضو", initial: "م" }}>
      <div className="max-w-2xl mx-auto space-y-8 pb-12 animate-fade-up">

        {/* Appearance Section */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-[#1B4332] uppercase tracking-[0.2em] px-2 opacity-70">المظهر العام</h3>
          <div className="card-surface overflow-hidden">
            <div className="p-5 flex items-center justify-between border-b border-border/60">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-2xl bg-[#1B4332]/5 flex items-center justify-center text-[#1B4332]">
                  {darkMode === "dark" ? <Moon size={20} /> : <Sun size={20} />}
                </div>
                <div>
                  <p className="text-[16px] font-bold text-[#0A0A0B]">الوضع الليلي</p>
                  <p className="text-[12px] text-[#4B5563]">اختر النمط المفضل لعينيك</p>
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

        {/* App Specific Settings - Only show on Native */}
        {isNative && (
          <section className="space-y-4 animate-fade-in">
            <h3 className="text-xs font-bold text-[#1B4332] uppercase tracking-[0.2em] px-2 opacity-70">إعدادات الجوال</h3>
            <div className="card-surface divide-y divide-border/60">
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-2xl bg-[#1B4332]/5 flex items-center justify-center text-[#1B4332]">
                    <Bell size={20} />
                  </div>
                  <div>
                    <p className="text-[16px] font-bold text-[#0A0A0B]">إشعارات الجوال</p>
                    <p className="text-[12px] text-[#4B5563]">
                      {notificationsEnabled ? "مفعّلة وتعمل بنجاح" : "الإشعارات معطلة حالياً"}
                    </p>
                  </div>
                </div>
                {!notificationsEnabled && (
                  <button
                    onClick={openNativeSettings}
                    className="text-[12px] bg-[#1B4332] text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-[#1B4332]/20 transition-transform active:scale-95"
                  >
                    تفعيل
                  </button>
                )}
              </div>
              <button
                onClick={openNativeSettings}
                className="w-full p-5 hover:bg-[#F2F2F7] transition-colors flex items-center justify-between group text-right"
              >
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-2xl bg-[#1B4332]/5 flex items-center justify-center text-[#1B4332]">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <p className="text-[16px] font-bold text-[#0A0A0B]">إعدادات النظام</p>
                    <p className="text-[12px] text-[#4B5563]">إدارة الصلاحيات والخصوصية</p>
                  </div>
                </div>
                <ExternalLink size={18} className="text-[#8E8E93] group-hover:text-[#1B4332] transition-colors" />
              </button>
            </div>
          </section>
        )}

        {/* Language Section */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-[#1B4332] uppercase tracking-[0.2em] px-2 opacity-70">اللغة</h3>
          <div className="card-surface p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-2xl bg-[#1B4332]/5 flex items-center justify-center text-[#1B4332]">
                <Languages size={20} />
              </div>
              <div>
                <p className="text-[16px] font-bold text-[#0A0A0B]">لغة التطبيق</p>
                <p className="text-[12px] text-[#4B5563]">التطبيق متوفر حالياً باللغة العربية</p>
              </div>
            </div>
            <span className="text-[14px] font-bold text-[#1B4332] bg-[#1B4332]/5 px-5 py-2 rounded-xl border border-[#1B4332]/20">
              العربية
            </span>
          </div>
        </section>

        {/* About Section */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-[#1B4332] uppercase tracking-[0.2em] px-2 opacity-70">حول {isNative ? "التطبيق" : "المنصة"}</h3>
          <div className="card-surface divide-y divide-border/60">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-2xl bg-[#1B4332]/5 flex items-center justify-center text-[#1B4332]">
                  <Info size={20} />
                </div>
                <div className="text-right">
                  <p className="text-[16px] font-bold text-[#0A0A0B]">إصدار {isNative ? "التطبيق" : "الويب"}</p>
                  <p className="text-[12px] text-[#4B5563] font-medium">{appVersion}</p>
                </div>
              </div>
            </div>
            <button className="w-full p-5 hover:bg-[#F2F2F7] transition-colors flex items-center justify-between group text-right">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-2xl bg-[#1B4332]/5 flex items-center justify-center text-[#1B4332]">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="text-[16px] font-bold text-[#0A0A0B]">سياسة الخصوصية</p>
                  <p className="text-[12px] text-[#4B5563]">كيفية حماية بيانات العائلة</p>
                </div>
              </div>
              <ExternalLink size={18} className="text-[#8E8E93] group-hover:text-[#1B4332] transition-colors" />
            </button>
          </div>
        </section>

        <div className="text-center space-y-3 mt-16 pb-8">
          <p className="text-[12px] text-[#8E8E93] uppercase tracking-[0.4em] font-black opacity-40">
            Alsaif Family Hub
          </p>
          <p className="text-[11px] text-[#8E8E93] font-medium">
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
        "flex flex-col items-center justify-center gap-3 py-5 rounded-[24px] border transition-all duration-300 active:scale-95",
        active
          ? "bg-[#1B4332] border-[#1B4332] text-white shadow-xl shadow-[#1B4332]/20"
          : "bg-white border-[#E5E4E0] text-[#4A4A4A] hover:bg-[#F2F2F7] hover:border-[#1B4332]/30"
      )}
    >
      <div className={cn("size-8 flex items-center justify-center transition-transform duration-500", active && "scale-110")}>
        {icon}
      </div>
      <span className="text-[14px] font-bold">{label}</span>
    </button>
  );
}
