import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الإدارة — السيف" },
      { name: "description", content: "لوحة إدارة النظام والأعضاء." },
    ],
  }),
  component: AdminPage,
});

function roleLabel(role: string | null) {
  if (role === "admin") return "مسؤول النظام";
  if (role === "manager") return "مدير";
  return "عضو";
}

function AdminPage() {
  const [profile, setProfile] = useState({
    name: "عضو العائلة",
    role: "عضو",
    initial: "ص",
    avatarPath: null as string | null,
  });

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("arabic_name, full_name, avatar_url").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id).order("role").limit(1).maybeSingle(),
      ]);
      const name = p?.arabic_name?.trim() || p?.full_name?.trim() || u.user.email?.split("@")[0] || "عضو العائلة";
      setProfile({
        name,
        role: roleLabel(r?.role ?? null),
        initial: (name[0] ?? "س").toUpperCase(),
        avatarPath: p?.avatar_url ?? null,
      });
    })();
  }, []);

  return (
    <AppShell title="الإدارة" user={profile}>
      <div className="max-w-5xl mx-auto text-center py-24">
        <Shield className="size-12 text-gold-primary mx-auto mb-6" strokeWidth={1.2} />
        <h2 className="text-2xl font-medium text-ivory mb-2">لوحة الإدارة</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          لوحة الإدارة قيد التطوير. سيتم تفعيلها قريباً لإدارة الأعضاء والأدوار والإعدادات.
        </p>
      </div>
    </AppShell>
  );
}
