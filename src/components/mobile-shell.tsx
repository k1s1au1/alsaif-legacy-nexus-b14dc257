import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { Home, Users, FileText, Grid3x3, Bell, Menu } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

type User = { name: string; role: string; initial: string; avatarPath?: string | null };

const tabs = [
  { to: "/dashboard", label: "الرئيسية", icon: Home },
  { to: "/family-tree", label: "العائلة", icon: Users },
  { to: "/archive", label: "المستندات", icon: FileText },
  { to: "/profile", label: "المزيد", icon: Grid3x3 },
] as const;

export function MobileShell({
  children,
  title,
  user,
  showHeader = true,
  unreadCount = 0,
}: {
  children: ReactNode;
  title: string;
  user?: User;
  showHeader?: boolean;
  unreadCount?: number;
}) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="mx-auto w-full max-w-[420px] min-h-screen flex flex-col relative">
        {showHeader && (
          <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md px-5 pt-[max(env(safe-area-inset-top),12px)] pb-3">
            <div className="flex items-center justify-between gap-3">
              {/* right (RTL start): avatar + bell */}
              <div className="flex items-center gap-3">
                {user && (
                  <button
                    onClick={() => navigate({ to: "/profile" })}
                    className="size-10 rounded-full overflow-hidden ring-1 ring-border bg-secondary"
                    aria-label="الملف الشخصي"
                  >
                    <UserAvatar
                      path={user.avatarPath ?? null}
                      name={user.name}
                      initial={user.initial}
                      className="size-full"
                      fallbackClassName="grid place-items-center size-full text-primary font-semibold"
                    />
                  </button>
                )}
                <button
                  className="relative size-10 grid place-items-center rounded-full"
                  aria-label="الإشعارات"
                >
                  <Bell className="size-5 text-foreground" strokeWidth={1.7} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 left-1.5 size-2 rounded-full bg-[var(--saudi-red)] ring-2 ring-background" />
                  )}
                </button>
              </div>
              <h1 className="text-base font-bold tracking-tight text-foreground">{title}</h1>
              <button className="size-10 grid place-items-center rounded-full" aria-label="القائمة">
                <Menu className="size-5 text-foreground" strokeWidth={1.7} />
              </button>
            </div>
          </header>
        )}

        <main className="flex-1 px-5 pb-32">{children}</main>

        {/* Bottom Navigation */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
        >
          <div className="mx-auto w-full max-w-[420px] px-4">
            <div
              className="pointer-events-auto bg-card rounded-[24px] flex items-center justify-around px-2 py-2"
              style={{ boxShadow: "0 8px 28px -8px rgba(0,0,0,0.12), 0 2px 8px -2px rgba(0,0,0,0.06)" }}
            >
              {tabs.map(({ to, label, icon: Icon }) => {
                const active = path === to || path.startsWith(to + "/");
                return (
                  <Link
                    key={to}
                    to={to}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl min-w-[64px] transition-all",
                      active
                        ? "bg-[var(--primary)] text-white"
                        : "text-[#666666]",
                    )}
                  >
                    <Icon className="size-5" strokeWidth={1.8} />
                    <span className="text-[11px] font-medium">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
