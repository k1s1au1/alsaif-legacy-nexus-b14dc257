import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import Tree from "react-d3-tree";
import type { RawNodeDatum, CustomNodeElementProps } from "react-d3-tree";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { setMemberParent, addFamilyMember } from "@/lib/api/family-tree.functions";
import { Loader2, Pencil, Check, X, Trees, ZoomIn, ZoomOut, Maximize2, Search, ShieldCheck, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

// Smaller node size for mobile compatibility
const NODE_W = 160;
const NODE_H = 80;

function FamilyTreePage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [isPriv, setIsPriv] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newChildName, setNewChildName] = useState("");
  const [draftParent, setDraftParent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(0.6); // Slightly zoomed out by default for mobile
  const [translate, setTranslate] = useState({ x: 200, y: 100 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const setParentFn = useServerFn(setMemberParent);
  const addChildFn = useServerFn(addFamilyMember);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [{ data: profile }, { data: roles }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", user.id),
        ]);

        const rs = (roles ?? []).map((r) => r.role);
        const isAdmin = rs.includes("admin") || rs.includes("manager");

        const name = profile?.arabic_name || profile?.full_name || "عضو";
        setMe({
          ...profile,
          name,
          role: rs.includes("admin") ? "مسؤول النظام" : "عضو",
          initial: name[0],
          avatarPath: profile?.avatar_url
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
      const { data, error } = await supabase.from("profiles").select("*").order("first_name", { ascending: true });
      if (error) throw error;
      setMembers((data ?? []) as any);
    } catch (e) {
      toast.error("حدث خطأ أثناء تحميل البيانات");
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
    return [{
      name: "مجلس آل سيف",
      attributes: { memberId: "__root__" } as any,
      children: roots.map(build),
    }];
  }, [members]);

  async function saveParent(userId: string) {
    setSaving(true);
    try {
      await setParentFn({ data: { userId, parentId: draftParent } });
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

  async function handleAddChild() {
    if (!addingTo || !newChildName.trim()) return;
    setSaving(true);
    try {
      await addChildFn({ data: { parentId: addingTo === "__root__" ? null : addingTo, firstName: newChildName.trim() } });
      toast.success("تمت إضافة العضو بنجاح");
      setAddingTo(null);
      setNewChildName("");
      await load();
      router.invalidate();
    } catch (e: any) {
      toast.error("فشل إضافة العضو", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  const renderNode = ({ nodeDatum, toggleNode }: CustomNodeElementProps) => {
    const memberId = (nodeDatum.attributes?.memberId as string);
    const m = members.find(mem => mem.id === memberId);
    const isRoot = memberId === "__root__";
    const isMe = me && m && m.id === me.id;
    const isSearchMatch = search && m && (
      (m.first_name || "").includes(search) ||
      (m.father_name || "").includes(search)
    );
    const hasAccount = m && !!m.id && !isRoot;

    return (
      <g>
        <foreignObject width={NODE_W} height={NODE_H} x={-NODE_W / 2} y={-NODE_H / 2} style={{ overflow: "visible" }}>
          <div
            onClick={toggleNode}
            className={cn(
              "relative w-full h-full rounded-full border-[3px] p-1.5 flex items-center justify-center gap-2 transition-all duration-500 cursor-pointer shadow-lg",
              isRoot ? "bg-[#1B4332] border-[#D4AF37] text-white" :
              isMe ? "bg-[#1B4332] border-[#D4AF37] ring-4 ring-[#1B4332]/10" :
              isSearchMatch ? "bg-[#D4AF37] border-white ring-4 ring-[#D4AF37]/20 scale-110" :
              "bg-white border-[#E5E4E0] hover:border-[#1B4332]"
            )}
          >
            {isRoot ? (
              <div className="flex flex-col items-center">
                 <Trees className="size-4 text-[#D4AF37] mb-0.5" />
                 <span className="text-[11px] font-black uppercase tracking-tighter">{nodeDatum.name}</span>
                 {isPriv && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddingTo("__root__");
                      }}
                      className="mt-1 size-5 rounded-full bg-[#D4AF37] text-[#1B4332] flex items-center justify-center shadow-md hover:scale-110 transition-all"
                    >
                      <Plus className="size-3" strokeWidth={4} />
                    </button>
                 )}
              </div>
            ) : m ? (
              <>
                <div className="relative size-10 rounded-full overflow-hidden border border-[#D4AF37]/30 shadow-inner shrink-0">
                  <UserAvatar name={m.first_name || "ع"} path={m.avatar_url} className="size-full" userId={m.id} />
                  {hasAccount && (
                    <div className="absolute top-0 right-0 bg-white rounded-full p-0.5 shadow-sm border border-border translate-x-1/4 -translate-y-1/4">
                       <ShieldCheck className="size-2.5 text-emerald-600" />
                    </div>
                  )}
                </div>
                <div className="flex-1 text-right overflow-hidden">
                  <p className={cn("text-[13px] font-black truncate leading-tight", (isMe || isRoot) ? "text-white" : "text-[#1B4332]")}>
                    {m.first_name}
                  </p>
                  <p className={cn("text-[8px] font-bold opacity-60 truncate", (isMe || isRoot) ? "text-white" : "text-[#8E7745]")}>
                    {m.father_name || "آل سيف"}
                  </p>
                </div>
                {isPriv && (
                  <div className="flex flex-col gap-1 items-center opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddingTo(m.id);
                      }}
                      className={cn("p-1 rounded-full bg-[#D4AF37] text-[#1B4332] shadow-sm hover:scale-110 transition-all")}
                      title="إضافة ولد"
                    >
                      <Plus className="size-2.5" strokeWidth={4} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(m.id);
                        setDraftParent(m.parent_id);
                      }}
                      className={cn("p-1 rounded-lg hover:bg-gold-primary/10 transition-all",
                        (isMe || isRoot) ? "text-white/60 hover:text-white" : "text-muted-foreground hover:text-gold-primary"
                      )}
                    >
                      <Pencil className="size-2.5" />
                    </button>
                  </div>
                )}
              </>
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

  const editingMember = editing ? members.find(m => m.id === editing) : null;

  return (
    <AppShell title="شجرة العائلة" user={me}>
      <div className="space-y-4 px-1 md:px-0">

        {/* Responsive Mobile Header */}
        <header className="flex flex-col gap-4 bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] shadow-sm border border-border">
          <div className="flex items-center gap-3">
            <div className="size-10 md:size-14 rounded-2xl bg-[#1B4332] flex items-center justify-center shadow-lg shadow-[#1B4332]/20 shrink-0">
              <Trees className="size-5 md:size-8 text-[#D4AF37]" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-black text-[#1B4332]">شجرة النسب الملكية</h1>
              <p className="text-[10px] md:text-sm font-bold text-[#8E8E93]">استكشف تفرعات وجذور عائلة آل سيف العريقة</p>
            </div>
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
                <ControlBtn onClick={() => setZoom(z => Math.min(2, z + 0.15))} icon={<ZoomIn size={18} />} />
                <ControlBtn onClick={() => setZoom(z => Math.max(0.1, z - 0.15))} icon={<ZoomOut size={18} />} />
                <ControlBtn onClick={() => {
                  setZoom(0.6);
                  if (containerRef.current) {
                    setTranslate({ x: containerRef.current.clientWidth / 2, y: 80 });
                  }
                }} icon={<Maximize2 size={18} />} />
             </div>
          </div>
        </header>

        {/* Optimized Tree Container for Mobile */}
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
                if (Math.abs(state.translate.x - translate.x) > 1 || Math.abs(state.translate.y - translate.y) > 1) {
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
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditing(null)}>
            <div dir="rtl" className="w-full max-w-sm rounded-[28px] border border-[#D4AF37]/30 bg-white p-6 space-y-5 shadow-2xl animate-fade-up" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                 <div className="size-12 rounded-full overflow-hidden ring-2 ring-gold-primary/10">
                    <UserAvatar name={editingMember.first_name || "ع"} path={editingMember.avatar_url} className="size-full" />
                 </div>
                 <div>
                    <h3 className="text-lg font-black text-[#1B4332]">تعديل ارتباط {editingMember.first_name}</h3>
                    <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 mt-1">
                       <ShieldCheck size={12} /> حساب معتمد ومرتبط بالنظام
                    </p>
                 </div>
              </div>

              <div className="space-y-1.5">
                 <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">والد العضو</label>
                 <select
                  value={draftParent ?? ""}
                  onChange={(e) => setDraftParent(e.target.value || null)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#F2F2F7] border-none text-xs font-bold text-primary focus:ring-2 focus:ring-primary/10 transition-all"
                >
                  <option value="">— لا أب (رأس شجرة) —</option>
                  {members.filter((x) => x.id !== editingMember.id).map((x) => (
                    <option key={x.id} value={x.id}>{x.full_name || x.first_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:bg-[#F2F2F7] transition-all">إلغاء</button>
                <button onClick={() => saveParent(editingMember.id)} disabled={saving} className="flex-[2] btn-gold py-2.5 text-xs font-bold flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} حفظ
                </button>
              </div>
            </div>
          </div>
        )}

        {addingTo && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setAddingTo(null)}>
            <div dir="rtl" className="w-full max-w-sm rounded-[28px] border border-border bg-white p-8 space-y-6 shadow-2xl animate-fade-up" onClick={(e) => e.stopPropagation()}>
               <div className="space-y-2">
                  <div className="flex items-center gap-3">
                     <div className="size-1 w-8 bg-gold-primary rounded-full" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-gold-primary">إضافة فرع جديد</span>
                  </div>
                  <h3 className="text-2xl font-black text-primary tracking-tight">إضافة فرد للشجرة</h3>
                  <p className="text-xs font-bold text-muted-foreground">أدخل الاسم الأول للفرد الجديد لربطه بوالده.</p>
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">الاسم الأول</label>
                  <input
                    autoFocus
                    value={newChildName}
                    onChange={(e) => setNewChildName(e.target.value)}
                    placeholder="مثال: سعود"
                    className="w-full px-5 py-4 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                  />
               </div>

               <div className="flex gap-3 pt-2">
                 <button onClick={() => setAddingTo(null)} className="flex-1 py-4 rounded-2xl font-black text-sm text-muted-foreground hover:bg-muted transition-all">إلغاء</button>
                 <button
                  onClick={handleAddChild}
                  disabled={saving || !newChildName.trim()}
                  className="flex-[2] btn-gold py-4 rounded-2xl font-black text-sm shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-2"
                 >
                   {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" strokeWidth={3} />}
                   إضافة للشجرة
                 </button>
               </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .tree-link {
          fill: none;
          stroke: #1B4332;
          stroke-width: 2px;
          stroke-dasharray: 6;
          opacity: 0.15;
          transition: all 0.5s ease;
        }
        .rd3t-tree-container { width: 100%; height: 100%; background: radial-gradient(#F2F2F7 1px, transparent 1px); background-size: 20px 20px; }
      `}</style>
    </AppShell>
  );
}

function ControlBtn({ onClick, icon }: { onClick: () => void, icon: React.ReactNode }) {
  return (
    <button onClick={onClick} className="size-10 md:size-12 rounded-xl bg-[#F2F2F7] text-[#1B4332] flex items-center justify-center hover:bg-[#1B4332] hover:text-white transition-all shadow-sm shrink-0">
      {icon}
    </button>
  );
}
