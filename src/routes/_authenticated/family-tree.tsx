import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import Tree from "react-d3-tree";
import type { RawNodeDatum, CustomNodeElementProps } from "react-d3-tree";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import {
  setMemberParent,
  addExtraMember,
  deleteExtraMember,
} from "@/lib/api/family-tree.functions";
import {
  Loader2,
  Pencil,
  Check,
  Trees,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  ShieldCheck,
  UserPlus,
  Trash2,
  UserCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/family-tree")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "شجرة عائلة السيف" },
      {
        name: "description",
        content:
          "عرض هرمي لشجرة عائلة السيف مع روابط واضحة بين الآباء والأبناء.",
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
  kind: "profile" | "extra";
};

const NODE_W = 160;
const NODE_H = 80;

function FamilyTreePage() {
  const router = useRouter();
  const [me, setMe] = useState<{ name: string; role: string; initial: string; avatarPath?: string | null; id?: string } | null>(null);
  const [isPriv, setIsPriv] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftParent, setDraftParent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(0.6);
  const [translate, setTranslate] = useState({ x: 200, y: 100 });
  const [addOpen, setAddOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const setParentFn = useServerFn(setMemberParent);
  const addExtraFn = useServerFn(addExtraMember);
  const deleteExtraFn = useServerFn(deleteExtraMember);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const [{ data: profile }, { data: roles }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", user.id),
        ]);
        const rs = (roles ?? []).map((r) => r.role);
        const isAdmin = rs.includes("admin") || rs.includes("manager");
        const profileName = profile?.arabic_name || profile?.full_name || "عضو";
        setMe({
          name: profileName,
          role: rs.includes("admin") ? "مسؤول النظام" : rs.includes("manager") ? "مشرف" : "عضو",
          initial: (profileName[0] || "ع").toUpperCase(),
          avatarPath: profile?.avatar_url,
          id: user.id,
        });
        setIsPriv(isAdmin);
        await load();
      } catch (err) {
        console.error("Initialization failed", err);
      }
    })();
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      setTranslate({ x: containerRef.current.clientWidth / 2, y: 80 });
    }
  }, [members.length]);

  async function load() {
    setLoading(true);
    try {
      const [profilesRes, extrasRes] = await Promise.all([
        supabase.from("profiles").select("*").order("first_name", { ascending: true }),
        supabase.from("family_tree_extras" as any).select("*").order("first_name", { ascending: true }),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      const profileMembers: Member[] = (profilesRes.data ?? []).map((p: any) => ({
        id: p.id,
        first_name: p.first_name,
        father_name: p.father_name,
        grandfather_name: p.grandfather_name,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        parent_id: p.parent_id,
        kind: "profile",
      }));
      const extraMembers: Member[] = ((extrasRes.data as any[]) ?? []).map((p: any) => ({
        id: p.id,
        first_name: p.first_name,
        father_name: p.father_name,
        grandfather_name: p.grandfather_name,
        full_name: [p.first_name, p.father_name, p.grandfather_name].filter(Boolean).join(" "),
        avatar_url: null,
        parent_id: p.parent_id,
        kind: "extra",
      }));
      setMembers([...profileMembers, ...extraMembers]);
    } catch (e: any) {
      toast.error("حدث خطأ أثناء تحميل البيانات", { description: e?.message });
    } finally {
      setLoading(false);
    }
  }

  const treeData = useMemo<RawNodeDatum[]>(() => {
    if (members.length === 0) return [];
    const byId = new Map<string, Member>();
    const byParent = new Map<string | null, Member[]>();
    for (const m of members) byId.set(m.id, m);
    for (const m of members) {
      const key = m.parent_id && byId.has(m.parent_id) ? m.parent_id : null;
      const arr = byParent.get(key) ?? [];
      arr.push(m);
      byParent.set(key, arr);
    }
    const build = (m: Member): RawNodeDatum => {
      const kids = byParent.get(m.id) ?? [];
      return {
        name: m.first_name || "—",
        attributes: { memberId: m.id } as any,
        children: kids.map(build),
      };
    };
    const roots = byParent.get(null) ?? [];
    if (!roots.length) return [];
    return [
      {
        name: "مجلس آل سيف",
        attributes: { memberId: "__root__" } as any,
        children: roots.map(build),
      },
    ];
  }, [members]);

  async function saveParent(member: Member) {
    setSaving(true);
    try {
      await setParentFn({ data: { userId: member.id, parentId: draftParent, kind: member.kind } });
      toast.success("تم التحديث بنجاح");
      setEditing(null);
      await load();
      router.invalidate();
    } catch (e: any) {
      toast.error("فشل الحفظ", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(member: Member) {
    if (!confirm(`حذف ${member.first_name} من الشجرة؟`)) return;
    try {
      await deleteExtraFn({ data: { id: member.id } });
      toast.success("تم الحذف");
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error("فشل الحذف", { description: e.message });
    }
  }

  const renderNode = ({ nodeDatum, toggleNode }: CustomNodeElementProps) => {
    const memberId = nodeDatum.attributes?.memberId as string | undefined;
    const m = memberId ? members.find((mem) => mem.id === memberId) : null;
    const isRoot = memberId === "__root__";
    const isMe = me?.id && m && m.id === me.id;
    const isSearchMatch =
      search &&
      m &&
      ((m.first_name || "").includes(search) || (m.father_name || "").includes(search));
    const isExtra = m?.kind === "extra";

    return (
      <g className="node-group">
        <foreignObject
          width={NODE_W}
          height={NODE_H}
          x={-NODE_W / 2}
          y={-NODE_H / 2}
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            onClick={toggleNode}
            style={{
              width: `${NODE_W}px`,
              height: `${NODE_H}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              borderRadius: '999px',
              border: '3px solid #E5E4E0',
              backgroundColor: 'white',
              boxSizing: 'border-box',
              cursor: 'pointer'
            }}
            className={cn(
              "tree-node-content",
              isRoot && "is-root",
              isMe && "is-me",
              isSearchMatch && "is-match",
              isExtra && "is-extra"
            )}
          >
            {isRoot ? (
              <div style={{ textAlign: 'center' }}>
                <Trees size={16} color="#D4AF37" />
                <div style={{ fontSize: '11px', fontWeight: 900, color: 'white' }}>{nodeDatum.name}</div>
              </div>
            ) : m ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', overflow: 'hidden' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '1px solid #D4AF37',
                  flexShrink: 0
                }}>
                  {isExtra ? (
                    <UserCircle2 size={40} color="#8E7745" />
                  ) : (
                    <UserAvatar name={m.first_name || "ع"} path={m.avatar_url} className="size-full" userId={m.id} />
                  )}
                </div>
                <div style={{ flex: 1, textAlign: 'right', overflow: 'hidden' }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 900,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: (isMe || isRoot) ? 'white' : '#1B4332'
                  }}>
                    {m.first_name}
                  </div>
                  <div style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    opacity: 0.7,
                    color: (isMe || isRoot) ? 'white' : '#8E7745'
                  }}>
                    {isExtra ? "بدون حساب" : m.father_name || "آل سيف"}
                  </div>
                </div>
                {isPriv && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(m.id);
                      setDraftParent(m.parent_id);
                    }}
                    style={{ padding: '4px', opacity: 0.5 }}
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </foreignObject>
      </g>
    );
  };

  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-10 animate-spin text-gold-primary" />
      </div>
    );
  }

  const editingMember = editing ? members.find((m) => m.id === editing) : null;

  return (
    <AppShell title="شجرة عائلة السيف" user={me}>
      <div className="space-y-4 px-1 md:px-0">
        <header className="flex flex-col gap-4 bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] shadow-sm border border-border">
          <div className="flex items-center gap-3">
            <div className="size-10 md:size-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
              <Trees className="size-6 md:size-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg md:text-2xl font-black text-[#1B4332]">شجرة عائلة السيف</h1>
              <p className="text-[10px] md:text-sm font-bold text-[#8E8E93]">
                استكشف تفرعات وجذور عائلة آل سيف العريقة
              </p>
            </div>
            {isPriv && (
              <button
                onClick={() => setAddOpen(true)}
                className="btn-gold flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-2xl text-xs md:text-sm font-bold shadow-md"
              >
                <UserPlus className="size-4" />
                <span className="hidden md:inline">إضافة فرد</span>
              </button>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-center gap-3 w-full">
            <div className="relative w-full md:w-auto flex-1">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-[#8E8E93]" />
              <input
                type="text"
                placeholder="ابحث عن فرد..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-11 pl-4 py-3 bg-[#F2F2F7] border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-[#1B4332]/10 transition-all"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto justify-center">
              <ControlBtn onClick={() => setZoom((z) => Math.min(2, z + 0.15))} icon={<ZoomIn size={18} />} />
              <ControlBtn onClick={() => setZoom((z) => Math.max(0.1, z - 0.15))} icon={<ZoomOut size={18} />} />
              <ControlBtn
                onClick={() => {
                  setZoom(0.6);
                  if (containerRef.current) {
                    setTranslate({ x: containerRef.current.clientWidth / 2, y: 80 });
                  }
                }}
                icon={<Maximize2 size={18} />}
              />
            </div>
          </div>
        </header>

        <div
          ref={containerRef}
          className="w-full rounded-[32px] md:rounded-[44px] bg-white border border-[#E5E4E0] overflow-hidden shadow-2xl relative"
          style={{ height: "calc(100vh - 240px)", minHeight: 500 }}
        >
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
              <Loader2 className="size-10 animate-spin text-gold-primary" />
            </div>
          ) : treeData.length > 0 ? (
            <Tree
              data={treeData[0]}
              orientation="vertical"
              translate={translate}
              zoom={zoom}
              onUpdate={(state) => {
                if (Math.abs(state.zoom - zoom) > 0.01) setZoom(state.zoom);
                if (
                  Math.abs(state.translate.x - translate.x) > 1 ||
                  Math.abs(state.translate.y - translate.y) > 1
                ) {
                  setTranslate(state.translate);
                }
              }}
              pathFunc="step"
              pathClassFunc={() => "tree-link"}
              nodeSize={{ x: NODE_W + 40, y: NODE_H + 60 }}
              renderCustomNodeElement={renderNode}
              collapsible={false}
              zoomable
              draggable
              transitionDuration={800}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground font-bold">
              لا توجد بيانات لعرضها في الشجرة
            </div>
          )}
        </div>

        {editingMember && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEditing(null)}
          >
            <div
              dir="rtl"
              className="w-full max-w-sm rounded-[28px] border border-[#D4AF37]/30 bg-white p-6 space-y-5 shadow-2xl animate-fade-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full overflow-hidden ring-2 ring-gold-primary/10 bg-[#D4AF37]/20 flex items-center justify-center">
                  {editingMember.kind === "extra" ? (
                    <UserCircle2 className="size-7 text-[#8E7745]" />
                  ) : (
                    <UserAvatar name={editingMember.first_name || "ع"} path={editingMember.avatar_url} className="size-full" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#1B4332]">
                    تعديل ارتباط {editingMember.first_name}
                  </h3>
                  <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 mt-1">
                    {editingMember.kind === "extra" ? "فرد مضاف بدون حساب" : (
                      <>
                        <ShieldCheck size={12} /> حساب معتمد ومرتبط بالنظام
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">
                  والد العضو
                </label>
                <select
                  value={draftParent ?? ""}
                  onChange={(e) => setDraftParent(e.target.value || null)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#F2F2F7] border-none text-xs font-bold text-primary focus:ring-2 focus:ring-primary/10 transition-all"
                >
                  <option value="">— لا أب (رأس شجرة) —</option>
                  {members
                    .filter((x) => x.id !== editingMember.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {(x.full_name || x.first_name) + (x.kind === "extra" ? " (بدون حساب)" : "")}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                {editingMember.kind === "extra" && (
                  <button
                    onClick={() => handleDelete(editingMember)}
                    className="p-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-all"
                    title="حذف"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
                <button
                  onClick={() => setEditing(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:bg-[#F2F2F7] transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => saveParent(editingMember)}
                  disabled={saving}
                  className="flex-[2] btn-gold py-2.5 text-xs font-bold flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} حفظ
                </button>
              </div>
            </div>
          </div>
        )}

        {addOpen && isPriv && (
          <AddMemberDialog
            members={members}
            onClose={() => setAddOpen(false)}
            onSubmit={async (payload) => {
              try {
                await addExtraFn({ data: payload });
                toast.success("تمت الإضافة بنجاح");
                setAddOpen(false);
                await load();
              } catch (e: any) {
                toast.error("فشل الإضافة", { description: e.message });
                throw e;
              }
            }}
          />
        )}
      </div>

      <style>{`
        .tree-link {
          fill: none;
          stroke: #1B4332;
          stroke-width: 2px;
          stroke-dasharray: 6;
          opacity: 0.15;
        }
        .rd3t-tree-container { width: 100%; height: 100%; background: radial-gradient(#F2F2F7 1px, transparent 1px); background-size: 20px 20px; }

        /* iOS Safari Fixes */
        .tree-node-content {
          border-color: #E5E4E0;
          background-color: white;
        }
        .tree-node-content.is-root {
          background-color: #1B4332 !important;
          border-color: #D4AF37 !important;
        }
        .tree-node-content.is-me {
          background-color: #1B4332 !important;
          border-color: #D4AF37 !important;
        }
        .tree-node-content.is-match {
          background-color: #D4AF37 !important;
          border-color: white !important;
        }
        .tree-node-content.is-extra {
          background-color: #FFF8E7 !important;
          border-color: #D4AF37 !important;
        }

        /* Force GPU rendering for SVG nodes on iOS */
        foreignObject {
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
        }
      `}</style>
    </AppShell>
  );
}

function ControlBtn({ onClick, icon }: { onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="size-10 md:size-12 rounded-xl bg-[#F2F2F7] text-[#1B4332] flex items-center justify-center hover:bg-[#1B4332] hover:text-white transition-all shadow-sm shrink-0"
    >
      {icon}
    </button>
  );
}

type AddPayload = {
  firstName: string;
  fatherName?: string | null;
  grandfatherName?: string | null;
  relation: "child" | "father" | "grandfather" | "root";
  targetId?: string | null;
  targetKind?: "profile" | "extra" | null;
};

function AddMemberDialog({
  members,
  onClose,
  onSubmit,
}: {
  members: Member[];
  onClose: () => void;
  onSubmit: (payload: AddPayload) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [grandfatherName, setGrandfatherName] = useState("");
  const [relation, setRelation] = useState<AddPayload["relation"]>("child");
  const [targetId, setTargetId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const target = members.find((m) => m.id === targetId);

  async function handleSubmit() {
    if (!firstName.trim()) return toast.error("الاسم الأول مطلوب");
    if (relation !== "root" && !target) return toast.error("اختر العضو المرجعي");
    setSaving(true);
    try {
      await onSubmit({
        firstName: firstName.trim(),
        fatherName: fatherName.trim() || null,
        grandfatherName: grandfatherName.trim() || null,
        relation,
        targetId: target?.id ?? null,
        targetKind: target?.kind ?? null,
      });
    } catch {
      // toast already shown
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        dir="rtl"
        className="w-full max-w-md rounded-[28px] border border-[#D4AF37]/30 bg-white p-6 space-y-4 shadow-2xl animate-fade-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-primary flex items-center justify-center">
            <UserPlus className="size-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-black text-[#1B4332]">إضافة فرد إلى الشجرة</h3>
            <p className="text-[10px] font-bold text-[#8E7745]">بدون الحاجة لإنشاء حساب</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Field label="الاسم الأول *">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#F2F2F7] border-none text-xs font-bold text-primary"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="اسم الأب">
              <input
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#F2F2F7] border-none text-xs font-bold text-primary"
              />
            </Field>
            <Field label="اسم الجد">
              <input
                value={grandfatherName}
                onChange={(e) => setGrandfatherName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#F2F2F7] border-none text-xs font-bold text-primary"
              />
            </Field>
          </div>

          <Field label="صلة القرابة">
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value as AddPayload["relation"])}
              className="w-full px-4 py-2.5 rounded-xl bg-[#F2F2F7] border-none text-xs font-bold text-primary"
            >
              <option value="child">ابن لـ ...</option>
              <option value="father">أب لـ ...</option>
              <option value="grandfather">جد لـ ...</option>
              <option value="root">رأس شجرة (بدون أب)</option>
            </select>
          </Field>

          {relation !== "root" && (
            <Field label="العضو المرجعي">
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#F2F2F7] border-none text-xs font-bold text-primary"
              >
                <option value="">— اختر —</option>
                {members.map((x) => (
                  <option key={x.id} value={x.id}>
                    {(x.full_name || x.first_name) + (x.kind === "extra" ? " (بدون حساب)" : "")}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <p className="text-[10px] font-bold text-[#8E7745] leading-relaxed bg-[#FFF8E7] rounded-xl p-3">
            {relation === "child" && "سيتم إضافة الفرد الجديد كابن مباشر للعضو المختار."}
            {relation === "father" && "سيتم إضافة الفرد كأب للعضو المختار، وسيرث ارتباط جدّه إن وجد."}
            {relation === "grandfather" && "سيتم إضافة الفرد كجد، أي والداً لأب العضو المختار. يجب أن يكون للعضو أب مسجّل."}
            {relation === "root" && "سيظهر الفرد كرأس شجرة مستقل."}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:bg-[#F2F2F7] transition-all"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-[2] btn-gold py-2.5 text-xs font-bold flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="size-3 animate-spin" /> : <UserPlus className="size-3" />} إضافة
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">{label}</label>
      {children}
    </div>
  );
}
