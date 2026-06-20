import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import Tree from "react-d3-tree";
import type { RawNodeDatum, CustomNodeElementProps } from "react-d3-tree";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { setMemberParent } from "@/lib/api/family-tree.functions";
import { Loader2, Pencil, Check, X, Users, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/family-tree")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "شجرة العائلة — السيف" },
      {
        name: "description",
        content: "عرض هرمي لشجرة عائلة السيف مع روابط واضحة بين الآباء والأبناء.",
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

type NodeAttrs = {
  member: Member;
};

const NODE_W = 180;
const NODE_H = 90;

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
  const [zoom, setZoom] = useState(0.8);
  const [translate, setTranslate] = useState({ x: 400, y: 80 });
  const containerRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth;
    setTranslate((t) => ({ ...t, x: w / 2 }));
  }, [members.length]);

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

  const treeData = useMemo<RawNodeDatum[]>(() => {
    const byId = new Map<string, Member>();
    const byParent = new Map<string | null, Member[]>();
    for (const m of members) byId.set(m.id, m);
    for (const m of members) {
      const key = m.parent_id && byId.has(m.parent_id) ? m.parent_id : null;
      const arr = byParent.get(key) ?? [];
      arr.push(m);
      byParent.set(key, arr);
    }
    for (const arr of byParent.values()) {
      arr.sort((a, b) =>
        (a.first_name ?? "").localeCompare(b.first_name ?? "", "ar"),
      );
    }

    const build = (m: Member): RawNodeDatum => {
      const kids = byParent.get(m.id) ?? [];
      return {
        name: m.first_name || m.full_name || "—",
        attributes: { memberId: m.id } as unknown as Record<string, string>,
        children: kids.map(build),
        // stash member via name + attributes; we'll resolve from members list in renderer
      };
    };

    const roots = byParent.get(null) ?? [];
    if (roots.length === 0) return [];
    if (roots.length === 1) return [build(roots[0])];
    // multiple roots: wrap in synthetic root to keep one tree
    return [
      {
        name: "آل السيف",
        attributes: { memberId: "__root__" } as unknown as Record<string, string>,
        children: roots.map(build),
      },
    ];
  }, [members]);

  const memberById = useMemo(() => {
    const map = new Map<string, Member>();
    for (const m of members) map.set(m.id, m);
    return map;
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

  const renderNode = ({ nodeDatum, toggleNode }: CustomNodeElementProps) => {
    const memberId = (nodeDatum.attributes?.memberId as string) ?? "";
    const m = memberById.get(memberId);
    const isSynthetic = memberId === "__root__";

    return (
      <g>
        <foreignObject
          width={NODE_W}
          height={NODE_H}
          x={-NODE_W / 2}
          y={-NODE_H / 2}
          style={{ overflow: "visible" }}
        >
          <div
            dir="rtl"
            onClick={toggleNode}
            className={cn(
              "group relative w-full h-full rounded-[24px] border p-3 flex items-center gap-3 transition-all duration-500 cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1",
              isSynthetic
                ? "bg-primary border-primary text-primary-foreground"
                : m && me && m.id === me.id
                  ? "bg-primary/5 border-primary ring-4 ring-primary/20"
                  : "bg-card border-border hover:border-primary/40"
            )}
          >
            {m ? (
              <>
                <div className="relative shrink-0">
                  <UserAvatar
                    name={displayName(m)}
                    path={m.avatar_url}
                    className="size-12 rounded-2xl ring-2 ring-primary/10 group-hover:ring-primary/40 transition-all shadow-inner"
                  />
                  {m.id === me.id && (
                    <div className="absolute -top-1 -right-1 size-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center border-2 border-white">
                      <Check className="size-2.5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-right space-y-0.5">
                  <div className={cn("text-[15px] font-bold truncate", isSynthetic ? "text-primary-foreground" : "text-foreground")}>
                    {m.first_name || "—"}
                  </div>
                  {(m.father_name || m.grandfather_name) && (
                    <div className={cn("text-[10px] font-medium truncate opacity-70", isSynthetic ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {[m.father_name, m.grandfather_name].filter(Boolean).join(" • ")}
                    </div>
                  )}
                </div>
                {isPriv && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(m.id);
                      setDraftParent(m.parent_id);
                    }}
                    className={cn(
                      "opacity-0 group-hover:opacity-100 transition p-2 rounded-xl",
                      isSynthetic ? "bg-white/10 hover:bg-white/20 text-white" : "bg-primary/5 hover:bg-primary/10 text-primary"
                    )}
                    aria-label="تعديل الأب"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
              </>
            ) : (
              <div className="w-full text-center text-base font-black tracking-widest uppercase">
                {nodeDatum.name}
              </div>
            )}
          </div>
        </foreignObject>
      </g>
    );
  };

  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-gold-primary" />
      </div>
    );
  }

  const editingMember = editing ? memberById.get(editing) : null;

  return (
    <AppShell user={me} title="شجرة العائلة">
      <div className="space-y-4">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gold-primary/10 border border-gold-primary/30 flex items-center justify-center">
              <Users className="size-5 text-gold-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-ivory">شجرة العائلة</h1>
              <p className="text-xs text-muted-foreground">
                اسحب للتنقل • استخدم العجلة أو الأزرار للتكبير
                {isPriv ? " • يمكنك تعديل أي ارتباط" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
              className="p-2 rounded-lg border border-border bg-card/60 hover:border-gold-primary/40 text-ivory transition"
              aria-label="تكبير"
            >
              <ZoomIn className="size-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}
              className="p-2 rounded-lg border border-border bg-card/60 hover:border-gold-primary/40 text-ivory transition"
              aria-label="تصغير"
            >
              <ZoomOut className="size-4" />
            </button>
            <button
              onClick={() => {
                setZoom(0.8);
                if (containerRef.current) {
                  setTranslate({ x: containerRef.current.clientWidth / 2, y: 80 });
                }
              }}
              className="p-2 rounded-lg border border-border bg-card/60 hover:border-gold-primary/40 text-ivory transition"
              aria-label="إعادة التوسيط"
            >
              <Maximize2 className="size-4" />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-gold-primary" />
          </div>
        ) : treeData.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-16">
            لا توجد بيانات لعرضها بعد.
          </div>
        ) : (
          <div
            ref={containerRef}
            className="relative w-full rounded-2xl border border-border bg-gradient-to-b from-navy-base/40 to-background/40 overflow-hidden"
            style={{ height: "calc(100vh - 220px)", minHeight: 520 }}
          >
            <Tree
              data={treeData[0]}
              orientation="vertical"
              translate={translate}
              zoom={zoom}
              onUpdate={(state) => {
                // keep local zoom/translate in sync with user pan/zoom
                if (
                  state.zoom !== zoom ||
                  state.translate.x !== translate.x ||
                  state.translate.y !== translate.y
                ) {
                  setZoom(state.zoom);
                  setTranslate(state.translate);
                }
              }}
              pathFunc="step"
              pathClassFunc={() => "family-tree-link"}
              separation={{ siblings: 1.2, nonSiblings: 1.6 }}
              nodeSize={{ x: NODE_W + 40, y: NODE_H + 70 }}
              renderCustomNodeElement={renderNode}
              collapsible={false}
              zoomable
              draggable
              enableLegacyTransitions
              transitionDuration={500}
            />
          </div>
        )}

        {editingMember && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEditing(null)}
          >
            <div
              dir="rtl"
              className="w-full max-w-md rounded-2xl border border-gold-primary/30 bg-card p-5 space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h3 className="text-base font-semibold text-ivory">
                  تعديل والد {displayName(editingMember)}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  اختر الوالد الجديد من قائمة الأعضاء
                </p>
              </div>
              <select
                value={draftParent ?? ""}
                onChange={(e) => setDraftParent(e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-input/60 border border-border text-sm text-ivory"
              >
                <option value="">— لا أب (جذر) —</option>
                {members
                  .filter((x) => x.id !== editingMember.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {displayName(x)}
                    </option>
                  ))}
              </select>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setEditing(null)}
                  className="px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-ivory"
                >
                  <X className="size-4 inline" /> إلغاء
                </button>
                <button
                  onClick={() => saveParent(editingMember.id)}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-gold-primary text-navy-base text-sm font-medium disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="size-4 inline animate-spin" />
                  ) : (
                    <Check className="size-4 inline" />
                  )}{" "}
                  حفظ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .family-tree-link {
          fill: none;
          stroke: var(--primary);
          stroke-width: 2.5px;
          stroke-linecap: round;
          stroke-linejoin: round;
          opacity: 0.4;
          transition: all 0.3s ease;
        }
        .rd3t-tree-container { width: 100%; height: 100%; }
        .rd3t-grabbable { cursor: grab; }
        .rd3t-grabbable:active { cursor: grabbing; }

        /* Animation for drawing links */
        @keyframes dash {
          to { stroke-dashoffset: 0; }
        }
        .family-tree-link {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: dash 1.5s ease forwards;
        }
      `}</style>

    </AppShell>
  );
}
