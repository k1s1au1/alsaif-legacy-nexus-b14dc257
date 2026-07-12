import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import Tree from "react-d3-tree";
import type { RawNodeDatum, CustomNodeElementProps } from "react-d3-tree";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
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
  kind: "profile" | "extra";
};

const NODE_W = 160;
const NODE_H = 80;

function FamilyTreePage() {
  const router = useRouter();
  const [me, setMe] = useState<{
    name: string;
    role: string;
    initial: string;
    avatarPath?: string | null;
    id?: string;
  } | null>(null);
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
          supabase
            .from("profiles")
            .select(
              "id, arabic_name, full_name, avatar_url, is_active, created_at, updated_at, first_name, father_name, grandfather_name, parent_id, terms_accepted_at",
            )
            .eq("id", user.id)
            .maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", user.id),
        ]);
        const rs = (roles ?? []).map((r) => r.role);
        const isAdmin = rs.includes("admin") || rs.includes("manager") || rs.includes("chairman");
        const profileName = profile?.arabic_name || profile?.full_name || "عضو";
        setMe({
          name: profileName,
          role: rs.includes("admin")
            ? "مسؤول تقني"
            : rs.includes("chairman")
              ? "رئيس المجلس"
              : rs.includes("manager")
                ? "مسؤول قسم"
                : "عضو",
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
        supabase
          .from("profiles")
          .select(
            "id, arabic_name, full_name, avatar_url, is_active, created_at, updated_at, first_name, father_name, grandfather_name, parent_id, terms_accepted_at",
          )
          .order("first_name", { ascending: true }),
        supabase
          .from("family_tree_extras" as any)
          .select("*")
          .order("first_name", { ascending: true }),
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
        name: "مجلس السيف",
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
        <foreignObject width={NODE_W} height={NODE_H} x={-NODE_W / 2} y={-NODE_H / 2}>
          <div
            onClick={toggleNode}
            style={{
              width: `${NODE_W}px`,
              height: `${NODE_H}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px",
              borderRadius: "24px",
              border: "1.5px solid rgba(212, 175, 55, 0.3)",
              backgroundColor: "rgba(5, 20, 16, 0.8)",
              backdropFilter: "blur(12px)",
              boxSizing: "border-box",
              cursor: "pointer",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            }}
            className={cn(
              "tree-node-content group/node transition-all duration-500",
              isRoot && "is-root scale-110",
              isMe && "is-me",
              isSearchMatch && "is-match ring-4 ring-gold-primary shadow-[0_0_20px_rgba(212,175,55,0.4)]",
              isExtra && "is-extra border-white/10",
            )}
          >
            {isRoot ? (
              <div className="flex flex-col items-center gap-1">
                <div className="size-8 rounded-full bg-gold-primary/20 flex items-center justify-center border border-gold-primary/30">
                  <Trees size={16} className="text-gold-primary animate-pulse" />
                </div>
                <div className="text-[11px] font-black text-white uppercase tracking-widest">
                  {nodeDatum.name}
                </div>
              </div>
            ) : m ? (
              <div className="flex items-center gap-3 w-full overflow-hidden">
                <div className="size-11 rounded-xl ring-2 ring-gold-primary/20 group-hover/node:ring-gold-primary transition-all overflow-hidden flex-shrink-0 bg-emerald-950 shadow-lg">
                  {isExtra ? (
                    <div className="size-full flex items-center justify-center bg-white/5">
                       <UserCircle2 size={24} className="text-gold-primary/40" />
                    </div>
                  ) : (
                    <UserAvatar
                      name={m.first_name || "ع"}
                      path={m.avatar_url}
                      className="size-full object-cover"
                      userId={m.id}
                    />
                  )}
                </div>
                <div className="flex-1 text-right overflow-hidden">
                  <div className="text-sm font-black text-white truncate leading-tight drop-shadow-md">
                    {m.first_name}
                  </div>
                  <div className="text-[9px] font-bold text-gold-primary/60 truncate uppercase tracking-widest mt-0.5">
                    {isExtra ? "مضاف يدوياً" : m.father_name || "آل سيف"}
                  </div>
                </div>
                {isPriv && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(m.id);
                      setDraftParent(m.parent_id);
                    }}
                    className="p-2 rounded-lg bg-white/5 text-gold-primary/40 hover:text-gold-primary hover:bg-gold-primary/10 transition-all opacity-0 group-hover/node:opacity-100"
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
    <AppShell title="شجرة العائلة" user={me}>
      <div className="max-w-7xl mx-auto space-y-8 pb-24 px-4 md:px-0" dir="rtl">
        <QuickActionsBanner />

        {/* Premium Emerald Header */}
        <section className="animate-fade-up">
          <div className="relative overflow-hidden rounded-[32px] md:rounded-[48px] bg-[#051410] p-8 md:p-12 text-white shadow-2xl border border-white/5 group">
            {/* Background Zakhrafa */}
            <div className="absolute left-0 top-0 bottom-0 w-1/2 opacity-[0.03] pointer-events-none overflow-hidden">
               <Trees size={400} className="absolute -left-20 -top-20 -rotate-12" />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-0.5 w-12 bg-gold-primary shadow-[0_0_15px_rgba(212,175,55,0.5)]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary">
                    جذور السيف الأصيلة
                  </span>
                </div>
                <h2 className="text-4xl md:text-6xl font-black tracking-tighter drop-shadow-2xl">
                  شجرة العائلة
                </h2>
                <p className="text-white/60 font-bold text-sm md:text-lg max-w-xl leading-relaxed">
                  استكشف روابط الدم وتاريخ الأجيال في عرض هرمي تفاعلي يربط الحاضر بالماضي العريق.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                 {isPriv && (
                   <button
                     onClick={() => setAddOpen(true)}
                     className="btn-gold px-8 py-4 rounded-2xl flex items-center gap-3 shadow-[0_15px_30px_-5px_rgba(212,175,55,0.3)] hover:scale-105 active:scale-95 transition-all font-black text-sm"
                   >
                     <UserPlus size={20} strokeWidth={3} />
                     <span>إضافة فرد جديد</span>
                   </button>
                 )}
                 <div className="bg-white/5 backdrop-blur-md border border-white/10 px-6 py-4 rounded-2xl flex items-center gap-4 shadow-xl">
                    <Users className="size-6 text-gold-primary" />
                    <div className="text-right">
                       <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">إجمالي المسجلين</p>
                       <p className="text-xl font-black text-white leading-none">{members.length}</p>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tree Controls & Search */}
        <section className="animate-fade-up grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ animationDelay: "100ms" }}>
           <div className="lg:col-span-2 relative group">
              <Search className="absolute right-6 top-1/2 -translate-y-1/2 size-5 text-gold-primary/40 group-focus-within:text-gold-primary transition-colors" strokeWidth={2.5} />
              <input
                type="text"
                placeholder="ابحث عن فرد بالاسم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-16 pr-16 pl-8 rounded-[24px] bg-card border border-border shadow-xl focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-bold text-lg"
              />
           </div>
           <div className="flex items-center justify-between gap-3 bg-muted/40 p-2 rounded-[24px] border border-border/40">
              <div className="flex gap-2 pr-2">
                 <ControlBtn onClick={() => setZoom((z) => Math.min(2, z + 0.2))} icon={<ZoomIn size={20} />} />
                 <ControlBtn onClick={() => setZoom((z) => Math.max(0.1, z - 0.2))} icon={<ZoomOut size={20} />} />
                 <ControlBtn
                   onClick={() => {
                     setZoom(0.6);
                     if (containerRef.current) setTranslate({ x: containerRef.current.clientWidth / 2, y: 100 });
                   }}
                   icon={<Maximize2 size={20} />}
                 />
              </div>
              <div className="h-8 w-px bg-border/60 mx-1" />
              <div className="pl-4 flex flex-col items-end">
                 <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">مستوى التكبير</p>
                 <p className="text-sm font-black text-primary">{Math.round(zoom * 100)}%</p>
              </div>
           </div>
        </section>

        {/* Tree Canvas */}
        <div
          ref={containerRef}
          className="w-full rounded-[40px] md:rounded-[56px] bg-[#051410] border-4 border-white/5 overflow-hidden shadow-2xl relative group/canvas transition-all duration-700 hover:border-gold-primary/10"
          style={{ height: "calc(100vh - 280px)", minHeight: 600 }}
        >
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#051410]/80 backdrop-blur-xl z-20 space-y-4">
              <div className="size-16 rounded-full border-4 border-gold-primary/20 border-t-gold-primary animate-spin" />
              <p className="text-gold-primary font-black tracking-widest uppercase text-xs animate-pulse">جاري بناء شجرة العائلة...</p>
            </div>
          ) : treeData.length > 0 ? (
            <Tree
              data={treeData[0]}
              orientation="vertical"
              translate={translate}
              zoom={zoom}
              onUpdate={(state) => {
                if (Math.abs(state.zoom - zoom) > 0.01) setZoom(state.zoom);
                if (Math.abs(state.translate.x - translate.x) > 1 || Math.abs(state.translate.y - translate.y) > 1) {
                  setTranslate(state.translate);
                }
              }}
              pathFunc="step"
              pathClassFunc={() => "tree-link"}
              nodeSize={{ x: NODE_W + 60, y: NODE_H + 80 }}
              renderCustomNodeElement={renderNode}
              collapsible={false}
              zoomable
              draggable
              transitionDuration={1000}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 font-black gap-4 uppercase tracking-[0.4em]">
               <Trees size={80} strokeWidth={1} />
               <span>لا توجد بيانات متاحة</span>
            </div>
          )}

          {/* Canvas Decoration Overlay */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />
        </div>

        {editingMember && (
          <div
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setEditing(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              dir="rtl"
              className="w-full max-w-sm rounded-[32px] border border-white/10 bg-[#051410] p-8 space-y-6 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Decoration */}
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                 <Pencil size={120} />
              </div>

              <div className="flex items-center gap-4 relative z-10">
                <div className="size-16 rounded-2xl overflow-hidden ring-4 ring-gold-primary/10 bg-emerald-950 flex items-center justify-center shrink-0 shadow-xl">
                  {editingMember.kind === "extra" ? (
                    <UserCircle2 className="size-8 text-gold-primary/40" />
                  ) : (
                    <UserAvatar
                      name={editingMember.first_name || "ع"}
                      path={editingMember.avatar_url}
                      className="size-full"
                      userId={editingMember.id}
                    />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">
                    تعديل الارتباط
                  </h3>
                  <p className="text-[10px] font-bold text-gold-primary/60 uppercase tracking-widest mt-1">
                    {editingMember.first_name} {editingMember.father_name}
                  </p>
                </div>
              </div>

              <div className="space-y-2 relative z-10">
                <label className="text-[10px] font-black text-gold-primary uppercase tracking-[0.3em] px-1 block">
                  والد العضو المرجعي
                </label>
                <select
                  value={draftParent ?? ""}
                  onChange={(e) => setDraftParent(e.target.value || null)}
                  className="w-full h-14 px-6 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold text-white focus:ring-4 focus:ring-gold-primary/5 transition-all outline-none"
                >
                  <option value="" className="bg-emerald-950">— لا أب (رأس شجرة) —</option>
                  {members
                    .filter((x) => x.id !== editingMember.id)
                    .map((x) => (
                      <option key={x.id} value={x.id} className="bg-emerald-950 text-white">
                        {(x.full_name || x.first_name) + (x.kind === "extra" ? " (بدون حساب)" : "")}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-4 relative z-10">
                {editingMember.kind === "extra" && (
                  <button
                    onClick={() => handleDelete(editingMember)}
                    className="size-14 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-lg border border-rose-500/10 shrink-0"
                    title="حذف الفرد"
                  >
                    <Trash2 className="size-5" />
                  </button>
                )}
                <button
                  onClick={() => setEditing(null)}
                  className="flex-1 h-14 rounded-2xl bg-white/5 text-white font-black text-sm hover:bg-white/10 transition-all border border-white/10"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => saveParent(editingMember)}
                  disabled={saving}
                  className="flex-[2] btn-gold h-14 rounded-2xl text-sm font-black flex items-center justify-center gap-3 shadow-xl"
                >
                  {saving ? <Loader2 className="size-5 animate-spin" /> : <Check size={20} strokeWidth={3} />}
                  <span>حفظ التعديل</span>
                </button>
              </div>
            </motion.div>
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
          stroke: #D4AF37;
          stroke-width: 1.5px;
          stroke-opacity: 0.2;
          transition: all 0.5s ease;
        }
        .node-group:hover .tree-link {
          stroke-opacity: 0.6;
          stroke-width: 2.5px;
        }

        .rd3t-tree-container {
          width: 100%;
          height: 100%;
          background: radial-gradient(circle at center, #0a261f 0%, #051410 100%);
        }

        .tree-node-content {
          transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
        }

        .tree-node-content:hover {
          transform: translateY(-5px) scale(1.05);
          border-color: #D4AF37 !important;
          background-color: rgba(6, 78, 59, 0.9) !important;
        }

        .tree-node-content.is-root {
          background: linear-gradient(135deg, #064E3B 0%, #051410 100%) !important;
          border-color: #D4AF37 !important;
          box-shadow: 0 0 30px rgba(212, 175, 55, 0.2);
        }

        .tree-node-content.is-me {
          border-color: #D4AF37 !important;
          box-shadow: 0 0 40px rgba(212, 175, 55, 0.3), inset 0 0 20px rgba(212, 175, 55, 0.1);
          animation: me-pulse 3s infinite ease-in-out;
        }

        @keyframes me-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(212, 175, 55, 0.3); }
          50% { box-shadow: 0 0 40px rgba(212, 175, 55, 0.5); }
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
      className="size-11 rounded-xl bg-white/5 text-white/60 flex items-center justify-center hover:bg-gold-primary hover:text-emerald-950 transition-all shadow-lg active:scale-95 shrink-0 border border-white/10"
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
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        dir="rtl"
        className="w-full max-w-md rounded-[40px] border border-white/10 bg-[#051410] p-8 md:p-12 space-y-6 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar-pane"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-5 relative z-10">
          <div className="size-16 rounded-[22px] bg-gold-primary text-emerald-950 flex items-center justify-center shadow-xl shadow-gold-primary/20 shrink-0">
            <UserPlus size={28} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-white tracking-tight">إضافة فرد جديد</h3>
            <p className="text-[10px] font-bold text-gold-primary/60 uppercase tracking-widest mt-1">توسيع جذور عائلة السيف</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 relative z-10 pt-4">
          <Field label="الاسم الشخصي *">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="مثال: إبراهيم"
              className="w-full h-14 px-6 rounded-2xl bg-white/5 border border-white/10 text-white font-bold placeholder:text-white/20 focus:ring-4 focus:ring-gold-primary/5 transition-all outline-none shadow-inner"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="اسم الأب">
              <input
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
                placeholder="الأب"
                className="w-full h-14 px-6 rounded-2xl bg-white/5 border border-white/10 text-white font-bold placeholder:text-white/20 focus:ring-4 focus:ring-gold-primary/5 transition-all outline-none shadow-inner"
              />
            </Field>
            <Field label="اسم الجد">
              <input
                value={grandfatherName}
                onChange={(e) => setGrandfatherName(e.target.value)}
                placeholder="الجد"
                className="w-full h-14 px-6 rounded-2xl bg-white/5 border border-white/10 text-white font-bold placeholder:text-white/20 focus:ring-4 focus:ring-gold-primary/5 transition-all outline-none shadow-inner"
              />
            </Field>
          </div>

          <Field label="نوع الارتباط في الشجرة">
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value as AddPayload["relation"])}
              className="w-full h-14 px-6 rounded-2xl bg-white/5 border border-white/10 text-white font-bold focus:ring-4 focus:ring-gold-primary/5 transition-all outline-none appearance-none"
            >
              <option value="child" className="bg-emerald-950">ابن لـ (سليل) ...</option>
              <option value="father" className="bg-emerald-950">أب لـ (أصل) ...</option>
              <option value="grandfather" className="bg-emerald-950">جد لـ (جذع) ...</option>
              <option value="root" className="bg-emerald-950">رأس شجرة مستقل</option>
            </select>
          </Field>

          {relation !== "root" && (
            <Field label="اختر العضو المرجعي">
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full h-14 px-6 rounded-2xl bg-white/5 border border-white/10 text-white font-bold focus:ring-4 focus:ring-gold-primary/5 transition-all outline-none"
              >
                <option value="" className="bg-emerald-950">🔍 ابحث في القائمة...</option>
                {members.map((x) => (
                  <option key={x.id} value={x.id} className="bg-emerald-950">
                    {(x.full_name || x.first_name) + (x.kind === "extra" ? " (مضاف يدوياً)" : "")}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="bg-gold-primary/5 border border-gold-primary/10 rounded-[24px] p-5">
            <p className="text-[11px] font-bold text-gold-primary leading-relaxed opacity-80">
              {relation === "child" && "سيتم إدراج العضو الجديد كفرع مباشر تحت العضو الذي اخترته."}
              {relation === "father" && "سيتم إدراج العضو الجديد كأصل (أب) للعضو المختار."}
              {relation === "grandfather" && "سيتم ربط العضو الجديد كجد للعضو المختار."}
              {relation === "root" && "سيظهر العضو في أعلى مستوى كأصل جديد للعائلة."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-6 relative z-10">
          <button
            onClick={onClose}
            className="flex-1 h-14 rounded-2xl bg-white/5 text-white font-black text-sm hover:bg-white/10 transition-all border border-white/10"
          >
            تراجع
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-[2] btn-gold h-14 rounded-2xl text-sm font-black flex items-center justify-center gap-3 shadow-xl"
          >
            {saving ? <Loader2 className="size-5 animate-spin" /> : <UserPlus size={20} strokeWidth={3} />}
            <span>إضافة للفروع</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-gold-primary uppercase tracking-[0.3em] px-2 block">
        {label}
      </label>
      {children}
    </div>
  );
}
