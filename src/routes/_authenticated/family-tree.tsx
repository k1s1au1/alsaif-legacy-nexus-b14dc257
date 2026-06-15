import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { setMemberParent } from "@/lib/api/family-tree.functions";
import { Loader2, Pencil, Check, X, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/family-tree")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "شجرة العائلة — السيف" },
      {
        name: "description",
        content: "عرض شجرة عائلة السيف بترتيب تلقائي حسب الآباء والأجداد.",
      },
    ],
  }),
  component: FamilyTreePage,
});

type Member = {
  id: string;
  first_name: string | null;
  father_name: string | null;
  grandfather_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  parent_id: string | null;
};

function FamilyTreePage() {
  const router = useRouter();
  const [me, setMe] = useState<{
    id: string;
    name: string;
    role: string;
    initial: string;
    avatarPath?: string | null;
  } | null>(null);
  const [isPriv, setIsPriv] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftParent, setDraftParent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const setParentFn = useServerFn(setMemberParent);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, arabic_name, avatar_url, first_name")
          .eq("id", u.user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      const rs = (roles ?? []).map((r) => r.role);
      const role = rs.includes("admin")
        ? "مسؤول النظام"
        : rs.includes("manager")
          ? "مشرف"
          : "عضو";
      const name =
        profile?.arabic_name ||
        profile?.full_name ||
        profile?.first_name ||
        u.user.email ||
        "";
      setMe({
        id: u.user.id,
        name,
        role,
        initial: name.charAt(0) || "ع",
        avatarPath: profile?.avatar_url ?? null,
      });
      setIsPriv(rs.includes("admin") || rs.includes("manager"));
      await load();
    })();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, first_name, father_name, grandfather_name, full_name, avatar_url, parent_id" as any,
      )
      .order("first_name", { ascending: true });
    if (error) {
      toast.error("تعذّر تحميل الأعضاء", { description: error.message });
    } else {
      setMembers((data ?? []) as unknown as Member[]);
    }
    setLoading(false);
  }

  const { roots, byParent, byId } = useMemo(() => {
    const byId = new Map<string, Member>();
    const byParent = new Map<string | null, Member[]>();
    for (const m of members) byId.set(m.id, m);
    for (const m of members) {
      const key = m.parent_id && byId.has(m.parent_id) ? m.parent_id : null;
      const arr = byParent.get(key) ?? [];
      arr.push(m);
      byParent.set(key, arr);
    }
    // sort siblings by name
    for (const [k, arr] of byParent) {
      arr.sort((a, b) =>
        (a.first_name ?? "").localeCompare(b.first_name ?? "", "ar"),
      );
      byParent.set(k, arr);
    }
    return { roots: byParent.get(null) ?? [], byParent, byId };
  }, [members]);

  async function saveParent(userId: string) {
    setSaving(true);
    try {
      await setParentFn({ data: { userId, parentId: draftParent } });
      toast.success("تم تحديث موقع العضو في الشجرة");
      setEditing(null);
      await load();
      router.invalidate();
    } catch (e) {
      toast.error("تعذّر الحفظ", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  function displayName(m: Member) {
    return (
      [m.first_name, m.father_name, m.grandfather_name]
        .filter(Boolean)
        .join(" ") ||
      m.full_name ||
      "بدون اسم"
    );
  }

  function Node({ m, depth }: { m: Member; depth: number }) {
    const children = byParent.get(m.id) ?? [];
    const isEditing = editing === m.id;
    return (
      <li className="relative pt-4">
        <div
          className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-sm hover:border-gold-primary/40 transition"
        >
          <UserAvatar
            name={displayName(m)}
            avatarPath={m.avatar_url}
            size="sm"
          />
          <div className="flex flex-col text-right">
            <span className="text-sm font-medium text-ivory leading-tight">
              {m.first_name || "—"}
            </span>
            {(m.father_name || m.grandfather_name) && (
              <span className="text-[10px] text-muted-foreground">
                {[m.father_name, m.grandfather_name].filter(Boolean).join(" • ")}
              </span>
            )}
          </div>
          {isPriv && !isEditing && (
            <button
              onClick={() => {
                setEditing(m.id);
                setDraftParent(m.parent_id);
              }}
              className="ms-2 text-muted-foreground hover:text-gold-primary"
              aria-label="تعديل الأب"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
        </div>

        {isEditing && (
          <div className="mt-2 flex items-center gap-2 p-2 rounded-lg border border-gold-primary/30 bg-background/60">
            <select
              value={draftParent ?? ""}
              onChange={(e) => setDraftParent(e.target.value || null)}
              className="flex-1 px-2 py-1.5 rounded bg-input/60 border border-border text-xs text-ivory"
            >
              <option value="">— لا أب (جذر) —</option>
              {members
                .filter((x) => x.id !== m.id)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {displayName(x)}
                  </option>
                ))}
            </select>
            <button
              onClick={() => saveParent(m.id)}
              disabled={saving}
              className="p-1.5 rounded bg-gold-primary text-navy-base disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="p-1.5 rounded border border-border text-muted-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {children.length > 0 && (
          <ul className="tree-children mt-4 flex justify-center gap-6 flex-wrap relative">
            {children.map((c) => (
              <Node key={c.id} m={c} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-gold-primary" />
      </div>
    );
  }

  return (
    <AppShell user={me} title="شجرة العائلة">
      <div className="space-y-6">
        <header className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gold-primary/10 border border-gold-primary/30 flex items-center justify-center">
            <Users className="size-5 text-gold-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-ivory">شجرة العائلة</h1>
            <p className="text-xs text-muted-foreground">
              يتم ترتيب الأعضاء تلقائياً عند تسجيل حساباتهم بناءً على اسم الأب
              والجد
              {isPriv ? " — يمكنك تعديل أي ارتباط" : ""}.
            </p>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-gold-primary" />
          </div>
        ) : roots.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-16">
            لا توجد بيانات لعرضها بعد.
          </div>
        ) : (
          <div className="overflow-x-auto pb-8">
            <ul className="tree-root flex justify-center gap-10 flex-wrap min-w-fit px-4">
              {roots.map((r) => (
                <Node key={r.id} m={r} depth={0} />
              ))}
            </ul>
          </div>
        )}
      </div>

      <style>{`
        .tree-root, .tree-children { list-style: none; padding: 0; margin: 0; }
        .tree-children > li { position: relative; }
        .tree-children > li::before {
          content: "";
          position: absolute;
          top: 0;
          right: 50%;
          width: 1px;
          height: 1rem;
          background: hsl(var(--border));
        }
        .tree-children::before {
          content: "";
          display: block;
          width: 1px;
          height: 1rem;
          background: hsl(var(--border));
          margin: 0 auto;
        }
      `}</style>
    </AppShell>
  );
}
