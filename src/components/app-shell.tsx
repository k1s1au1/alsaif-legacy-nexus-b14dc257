import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  MessageCircle,
  CalendarDays,
  Plane,
  Wallet,
  ListChecks,
  Sparkles,
  Megaphone,
  Archive,
  Shield,
  Bell,
  LogOut,
  User,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

const navItems = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/chat", label: "المحادثات", icon: MessageCircle },
  { to: "/meetings", label: "الاجتماعات", icon: CalendarDays },
  { to: "/trips", label: "الرحلات", icon: Plane },
  { to: "/finance", label: "الصندوق المالي", icon: Wallet },
  { to: "/tasks", label: "المهام", icon: ListChecks },
  { to: "/events", label: "المناسبات", icon: Sparkles },
  { to: "/majlis", label: "المجلس", icon: Megaphone },
  { to: "/archive", label: "الأرشيف", icon: Archive },
  { to: "/admin", label: "الإدارة", icon: Shield },
] as const;

export function AppShell({
  children,
  title,
  user,
}: {
  children: ReactNode;
  title: string;
  user: { name: string; role: string; initial: string };
}) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Right Navigation Rail (RTL) */}
      <aside className="fixed inset-y-0 right-0 w-20 lg:w-64 bg-card/60 border-l border-border backdrop-blur-xl z-50 flex flex-col">
        <div className="h-20 flex items-center justify-center lg:justify-start lg:px-8 border-b border-border">
          <div className="size-10 bg-gold-primary/10 ring-1 ring-gold-primary/30 rounded-lg grid place-items-center">
            <span className="text-gold-primary text-xl font-semibold select-none">ص</span>
          </div>
          <span className="hidden lg:block mr-4 text-xl font-medium tracking-wide text-gold-primary">
            الصيف
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = path === to || path.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center justify-center lg:justify-start lg:px-4 py-3 rounded-xl text-sm transition-colors ${
                  active
                    ? "bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20"
                    : "text-ivory/55 hover:text-gold-primary hover:bg-secondary/40"
                }`}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.5} />
                <span className="hidden lg:block mr-3 font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center lg:justify-start lg:px-3 py-2 text-xs text-muted-foreground hover:text-gold-primary transition-colors rounded-lg"
          >
            <LogOut className="size-4" strokeWidth={1.5} />
            <span className="hidden lg:block mr-3">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="mr-20 lg:mr-64 min-h-screen pb-16">
        <header className="h-20 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40 px-6 lg:px-10 flex items-center justify-between">
          <h1 className="text-lg font-medium tracking-tight">{title}</h1>
          <div className="flex items-center gap-6">
            <button className="relative p-2 text-muted-foreground hover:text-gold-primary transition">
              <Bell className="size-5" strokeWidth={1.5} />
              <span className="absolute top-2 right-2 size-1.5 bg-gold-primary rounded-full" />
            </button>
            <div className="flex items-center gap-3 pr-6 border-r border-border">
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-ivory">{user.name}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  {user.role}
                </p>
              </div>
              <div className="size-10 rounded-full bg-gold-primary/20 ring-1 ring-gold-primary/30 grid place-items-center text-gold-primary font-semibold">
                {user.initial}
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 lg:p-10 max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
