import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "manager" | "member" | "chairman";

export type Section = "meetings" | "tasks" | "trips" | "finance" | "heritage" | "news" | "community";

export const SECTIONS: Section[] = ["meetings", "tasks", "trips", "finance", "heritage", "news", "community"];


export function sectionLabel(section: Section): string {
  switch (section) {
    case "meetings": return "الاجتماعات";
    case "tasks": return "المهام";
    case "trips": return "الترفيه";
    case "finance": return "المالية";
    case "heritage": return "إرث السيف";
    case "news": return "الأخبار";
    case "community": return "ركن الأعضاء";
  }
}

export function roleLabel(role: AppRole | string | null): string {
  switch (role) {
    case "admin": return "مسؤول";
    case "manager": return "مسؤول قسم";
    case "chairman": return "رئيس المجلس";
    default: return "عضو";
  }
}

export function useUserRole() {
  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [sectionHeads, setSectionHeads] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!active) return;
      if (!u.user) {
        setIsLoading(false);
        return;
      }
      setUserId(u.user.id);

      const [{ data: r }, { data: sh }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.from("section_heads" as any).select("section").eq("user_id", u.user.id),
      ]);
      if (!active) return;

      setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
      setSectionHeads(((sh ?? []) as unknown as { section: Section }[]).map((x) => x.section));
      setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager");
  const isChairman = roles.includes("chairman");
  const isPrivileged = isAdmin || isChairman;

  const canManage = (section: Section) => {
    // Technical Admin and Chairman have full access
    if (isAdmin || isChairman) return true;

    // Section Heads only have access to their assigned sections
    // Note: 'events' in UI is 'events' in DB, 'majlis' is 'news'
    const dbSection = section === 'news' ? 'majlis' : section === 'tasks' ? 'events' : section;
    return sectionHeads.includes(dbSection as any);
  };

  const primaryRole: AppRole | null =
    (roles.find((r) =>
      ["admin", "chairman", "manager", "member"].includes(r),
    ) as AppRole) || null;

  return {
    userId,
    roles,
    sectionHeads,
    isLoading,
    isAdmin,
    isManager,
    isChairman,
    isPrivileged,
    canManage,
    primaryRole,
  };
}
