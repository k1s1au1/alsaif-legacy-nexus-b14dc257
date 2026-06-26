import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Award,
  History,
  Wallet,
  Users,
  CheckCircle2,
  Trophy
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type BadgeType = "attender" | "storyteller" | "supporter" | "initiator" | "achiever";

interface BadgeMeta {
  id: BadgeType;
  label: string;
  description: string;
  icon: any;
  color: string;
}

const BADGES: Record<BadgeType, BadgeMeta> = {
  attender: { id: "attender", label: "وسام الحضور", description: "حضر العديد من الاجتماعات العائلية", icon: Users, color: "text-blue-500 bg-blue-500/10" },
  storyteller: { id: "storyteller", label: "وسام الراوي", description: "ساهم في تدوين إرث وتاريخ العائلة", icon: History, color: "text-emerald-500 bg-emerald-500/10" },
  supporter: { id: "supporter", label: "وسام الداعم", description: "مساهم فعال في صندوق العائلة", icon: Wallet, color: "text-amber-500 bg-amber-500/10" },
  initiator: { id: "initiator", label: "وسام المبادرة", description: "قدم أفكاراً ومبادرات تطويرية", icon: Award, color: "text-purple-500 bg-purple-500/10" },
  achiever: { id: "achiever", label: "وسام الإنجاز", description: "أنجز كافة المهام المسندة إليه", icon: CheckCircle2, color: "text-rose-500 bg-rose-500/10" },
};

export function AchievementBadges({ userId, size = "sm" }: { userId?: string | null, size?: "sm" | "md" }) {
  const [activeBadges, setActiveBadges] = useState<BadgeType[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    // Simple logic to determine badges based on counts
    const fetchStats = async () => {
      setLoading(true);
      const badges: BadgeType[] = [];

      try {
        const [
          { count: attCount },
          { count: herCount },
          { count: taskCount },
          { count: iniCount }
        ] = await Promise.all([
          supabase.from("meeting_attendees").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("rsvp", "going"),
          supabase.from("majlis_posts").select("*", { count: "exact", head: true }).eq("author_id", userId).ilike("title", "[إرث]%"),
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assignee_id", userId).eq("status", "done"),
          supabase.from("majlis_posts").select("*", { count: "exact", head: true }).eq("author_id", userId).ilike("title", "[مبادرة]%")
        ]);

        if ((attCount || 0) >= 3) badges.push("attender");
        if ((herCount || 0) >= 2) badges.push("storyteller");
        if ((taskCount || 0) >= 3) badges.push("achiever");
        if ((iniCount || 0) >= 1) badges.push("initiator");

        // For supporter, we'd check bank_transfers, but for now let's assume if they have any approved transfer
        const { count: transCount } = await supabase.from("bank_transfers").select("*", { count: "exact", head: true }).eq("submitted_by", userId).eq("status", "approved");
        if ((transCount || 0) >= 1) badges.push("supporter");

        setActiveBadges(badges);
      } catch (e) {
        console.error("Badges error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userId]);

  if (loading || activeBadges.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-1", size === "md" ? "gap-2" : "gap-1")}>
      <TooltipProvider>
        {activeBadges.map(b => {
          const meta = BADGES[b];
          return (
            <Tooltip key={b}>
              <TooltipTrigger asChild>
                <div className={cn(
                  "rounded-full flex items-center justify-center border border-white/20 shadow-sm",
                  meta.color,
                  size === "sm" ? "size-5 p-0.5" : "size-8 p-1.5"
                )}>
                  <meta.icon className="size-full" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-primary border-gold-primary/20 text-white p-3 rounded-2xl shadow-2xl">
                <div className="flex items-center gap-3">
                   <div className={cn("size-8 rounded-xl flex items-center justify-center", meta.color)}>
                      <meta.icon className="size-5" />
                   </div>
                   <div>
                      <p className="text-xs font-black">{meta.label}</p>
                      <p className="text-[10px] font-bold opacity-60">{meta.description}</p>
                   </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>
    </div>
  );
}
