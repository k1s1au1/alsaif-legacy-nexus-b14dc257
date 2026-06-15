import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { Loader2, Search, Users } from "lucide-react";
import { PresenceDot, presenceFromLastSeen, type PresenceState } from "@/lib/presence";

export const Route = createFileRoute("/_authenticated/members/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الأعضاء — السيف" },
      { name: "description", content: "تصفح ملفات تعريف جميع أعضاء النظام." },
    ],
  }),
  component: MembersPage,
});

type MemberRow = {
  id: string;
  arabic_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

function MembersPage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [presence, setPresence] = useState<Record<string, string>>({});
  const [, setTick] = useState(0);
  const [q, setQ] = useState("");
  const [me, setMe] = useState<{ name: string; initial: string; avatarPath: string | null }>({
    name: "...",
    initial: "س",
    avatarPath: null,
  });

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, arabic_name, full_name, avatar_url")
        .order("arabic_name", { ascending: true });
      if (!error && data) setMembers(data as MemberRow[]);
      if (u.user) {
        const mine = (data as MemberRow[] | null)?.find((m) => m.id === u.user!.id);
        const name =
          mine?.arabic_name?.trim() ||
          mine?.full_name?.trim() ||
          u.user.email?.split("@")[0] ||
          "عضو";
        setMe({ name, initial: (name[0] ?? "س").toUpperCase(), avatarPath: mine?.avatar_url ?? null });
      }
      setLoading(false);
    })();
  }, []);

  const filtered = members.filter((m) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (
      (m.arabic_name ?? "").toLowerCase().includes(needle) ||
      (m.full_name ?? "").toLowerCase().includes(needle)
    );
  });

  return (
    <AppShell title="الأعضاء" user={{ name: me.name, role: "عضو", initial: me.initial, avatarPath: me.avatarPath }}>
      <div className="max-w-5xl space-y-6">
        <section className="card-surface p-6 space-y-4 animate-fade-up">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-gold-primary" />
              <h2 className="text-xl text-ivory">جميع الأعضاء</h2>
              <span className="text-xs text-muted-foreground">({members.length})</span>
            </div>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث بالاسم..."
                className="w-64 max-w-full pr-9 pl-3 py-2 rounded-lg bg-background border border-border text-sm text-ivory placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-gold-primary/40"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground text-sm">لا يوجد أعضاء مطابقون.</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((m) => {
                const displayName = m.arabic_name?.trim() || m.full_name?.trim() || "عضو";
                return (
                  <li key={m.id}>
                    <Link
                      to="/members/$userId"
                      params={{ userId: m.id }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-background/40 border border-border hover:border-gold-primary/40 hover:bg-background/60 transition"
                    >
                      <div className="size-12 rounded-full ring-1 ring-gold-primary/30 bg-gold-primary/10 grid place-items-center overflow-hidden shrink-0">
                        <UserAvatar
                          path={m.avatar_url}
                          name={displayName}
                          className="size-full"
                          fallbackClassName="text-lg text-gold-primary"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-ivory truncate">{displayName}</p>
                        {m.full_name && m.arabic_name && (
                          <p className="text-[11px] text-muted-foreground truncate">{m.full_name}</p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
