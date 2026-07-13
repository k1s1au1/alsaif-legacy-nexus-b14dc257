import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gold-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">حدث خطأ غير متوقع</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          يمكنك المحاولة مرة أخرى أو العودة للصفحة الرئيسية.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            إعادة المحاولة
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // T-Notify: Full Feature Restoration
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "السيف — Alsaif" },
      {
        name: "description",
        content:
          "السيف — منصة العائلة الخاصة للتواصل والتنظيم وحفظ الإرث. Private family & community headquarters.",
      },
      { name: "theme-color", content: "#0F5A3A" },
      { property: "og:title", content: "السيف — Alsaif" },
      { property: "og:description", content: "نصل العائلة، نحفظ الإرث، نبني المجتمع." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Tajawal:wght@400;500;700;800&family=Amiri:wght@400;700&family=Reem+Kufi:wght@400;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }

      const savedFont = localStorage.getItem("font-style") as "modern" | "royal" | null;
      if (savedFont === "royal") {
        document.documentElement.classList.add("font-royal-mode");
      } else {
        document.documentElement.classList.remove("font-royal-mode");
      }

      // Font Size Magnification
      const savedScale = localStorage.getItem("app-font-scale");
      if (savedScale) {
        document.documentElement.style.setProperty("--app-font-scale", savedScale);
        document.documentElement.style.fontSize = `calc(16px * ${savedScale})`;
      }

      // Restore custom theme colors
      const savedColor = localStorage.getItem("app-theme-color-id");
      if (savedColor) {
        // We only have the ID, we need the colors.
        // For simplicity, we can fetch from a static list or just wait for the user to visit settings.
        // Better: store the colors themselves or use a mapping.
        const themes: Record<string, any> = {
          emerald: {
            p: "#064E3B",
            s: "#D4AF37",
            dp: "#064E3B",
            m: ["rgba(212, 175, 55, 0.1)", "rgba(6, 78, 59, 0.08)"],
          },
          midnight: {
            p: "#1E293B",
            s: "#94A3B8",
            dp: "#334155",
            m: ["rgba(148, 163, 184, 0.1)", "rgba(30, 41, 59, 0.1)"],
          },
          burgundy: {
            p: "#4C0519",
            s: "#D4AF37",
            dp: "#800000",
            m: ["rgba(212, 175, 55, 0.1)", "rgba(76, 5, 25, 0.1)"],
          },
          "pure-white": {
            p: "#FDFCF7",
            s: "#8E7745",
            dp: "#F1F5F9",
            m: ["rgba(142, 119, 69, 0.1)", "rgba(253, 252, 247, 0.1)"],
          },
          sand: {
            p: "#C2B280",
            s: "#451A03",
            dp: "#D2B48C",
            m: ["rgba(69, 26, 3, 0.1)", "rgba(194, 178, 128, 0.1)"],
          },
        };
        const c = themes[savedColor];
        if (c) {
          const root = document.documentElement;
          root.style.setProperty("--primary", root.classList.contains("dark") ? c.dp : c.p);
          root.style.setProperty("--gold-primary", c.s);
          if (c.m) {
            root.style.setProperty("--mesh-color-1", c.m[0]);
            root.style.setProperty("--mesh-color-2", c.m[1]);
          }
        }
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        // Try to save FCM token if we have one stored
        const storedToken = localStorage.getItem("fcm_token");
        if (storedToken && session?.user) {
          try {
            const { Capacitor } = await import("@capacitor/core");
            await supabase.from("push_tokens").upsert(
              {
                user_id: session.user.id,
                token: storedToken,
                platform: Capacitor.getPlatform() || "android",
                is_active: true,
              },
              { onConflict: "token" },
            );
          } catch (e) {
            console.warn("[Push] Failed to save stored token on login:", e);
          }
        }
      }

      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="dark" position="top-center" richColors />
    </QueryClientProvider>
  );
}
