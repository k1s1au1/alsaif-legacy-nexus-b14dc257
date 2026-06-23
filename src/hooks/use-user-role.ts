import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "admin"
  | "manager"
  | "member"
  | "chairman"
  | "head_meetings"
  | "head_events"
  | "head_trips"
  | "head_finance";

export type Section = "meetings" | "events" | "trips" | "finance";

const HEAD: Record<Section, AppRole> = {
  meetings: "head_meetings",
  events: "head_events",
  trips: "head_trips",
  finance: "head_finance",
};

export function roleLabel(role: AppRole | string | null): string {
  switch (role) {
    case "admin": return "مسؤول النظام";
    case "manager": return "مدير";
    case "chairman": return "رئيس المجلس";
    case "head_meetings": return "مسؤول الاجتماعات";
    case "head_events": return "مسؤول الفعاليات";
    case "head_trips": return "مسؤول الرحلات";
    case "head_finance": return "مسؤول المالية";
    default: return "عضو";
  }
}

export function useUserRole() {
  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
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
      const { data: r } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      if (!active) return;
      setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
      setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager");
  const isChairman = roles.includes("chairman");

  const canManage = (section: Section) =>
    isAdmin || isManager || isChairman || roles.includes(HEAD[section]);

  const primaryRole: AppRole | null =
    (roles.find((r) =>
      ["admin", "chairman", "manager", "head_meetings", "head_events", "head_trips", "head_finance", "member"].includes(r),
    ) as AppRole) || null;

  return { userId, roles, isLoading, isAdmin, isManager, isChairman, canManage, primaryRole };
}
