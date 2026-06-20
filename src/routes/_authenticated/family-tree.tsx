import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import Tree from "react-d3-tree";
import type { RawNodeDatum, CustomNodeElementProps } from "react-d3-tree";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { setMemberParent } from "@/lib/api/family-tree.functions";
import { Loader2, Pencil, Check, X, Users, ZoomIn, ZoomOut, Maximize2, Search, ShieldCheck, UserCircle } from "lucide-react";
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

const NODE_W = 200;
const NODE_H = 100;

function FamilyTreePage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [isPriv, setIsPriv] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftParent, setDraftParent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(0.8);
  const [translate, setTranslate] = useState({ x: 400, y: 100 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const setParentFn = useServerFn(setMemberParent);

  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        const [{ data: profile }, { data: roles }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        ]);
        const rs = (roles ?? []).map((r) => r.role);
        const isAdmin = rs.includes("admin") || rs.includes("manager");
        setMe({ ...profile, role: rs.includes("admin") ? "مسؤول النظام" : "عضو", initial: (profile?.arabic_name || "ع")[0] });
        setIsPriv(isAdmin);
        await load();
      } catch (err) {
        console.error("Initialization failed", err);
      }
    })();
  }, []);

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
      toast.success("تم تحديث موقع العضو في الشجرة");
      setEditing(null);
      await load();
      router.invalidate();
    } catch (e: any) {
      toast.error("فشل الحفظ", { description: e.message });
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
    // In this logic, if they exist in profiles table, they have an account
    const hasAccount = m && !!m.id && !isRoot;

    return (
      <g>
        <foreignObject width={NODE_W} height={NODE_H} x={-NODE_W / 2} y={-NODE_H / 2} style={{ overflow: "visible" }}>
          <div
            onClick={toggleNode}
            className={cn(
              "relative w-full h-full rounded-full border-4 p-2 flex items-center justify-center gap-3 transition-all duration-500 cursor-pointer shadow-xl",
              isRoot ? "bg-[#1B4332] border-[#D4AF37] text-white" :
              isMe ? "bg-[#1B4332] border-[#D4AF37] ring-8 ring-[#1B4332]/10" :
              isSearchMatch ? "bg-[#D4AF37] border-white ring-8 ring-[#D4AF37]/20 scale-110" :
              "bg-white border-[#E5E4E0] hover:border-[#1B4332]"
            )}
          >
            {isRoot ? (
              <div className="flex flex-col items-center">
                 <Users className="size-6 text-[#D4AF37] mb-1" />
                 <span className="text-[14px] font-black uppercase tracking-tighter">{nodeDatum.name}</span>
              </div>
            ) : m ? (
              <>
                <div className="relative size-16 rounded-full overflow-hidden border-2 border-[#D4AF37]/30 shadow-inner">
                  <UserAvatar name={m.first_name || "ع"} path={m.avatar_url} className="size-full" userId={m.id} />
                  {hasAccount && (
                    <div className="absolute top-0 right-0 bg-white rounded-full p-0.5 shadow-sm border border-border translate-x-1/4 -translate-y-1/4">
                       <ShieldCheck className="size-3 text-emerald-600" />
                    </div>
                  )}
                </div>
                <div className="flex-1 text-right overflow-hidden">
                  <p className={cn("text-[16px] font-black truncate leading-tight", (isMe || isRoot) ? "text-white" : "text-[#1B4332]")}>
                    {m.first_name}
                  </p>
                  <p className={cn("text-[10px] font-bold opacity-60 truncate", (isMe || isRoot) ? "text-white" : "text-[#8E7745]")}>
                    {[m.father_name, m.grandfather_name].filter(Boolean).join(" • ")}
                  </p>
                </div>
                {isPriv && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(m.id);
                      setDraftParent(m.parent_id);
                    }}
                    className={cn("p-1.5 rounded-lg opacity-0 hover:bg-gold-primary/10 transition-all",
                      (isMe || isRoot) ? "text-white/60 hover:text-white" : "text-muted-foreground hover:text-gold-primary",
                      "group-hover:opacity-100"
                    )}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
              </>
            ) : null}
          </div>
        </foreignObject>
      </g>
    );
  };

  const editingMember = editing ? members.find(m => m.id === editing) : null;

  return (
    <AppShell title="شجرة العائلة" user={me}>
      <div className="space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[32px] shadow-sm border border-border">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-[#1B4332] flex items-center justify-center shadow-lg shadow-[#1B4332]/20">
              <Users className="size-8 text-[#D4AF37]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#1B4332]">شجرة النسب الملكية</h1>
              <p className="text-sm font-bold text-[#8E8E93]">استكشف تفرعات وجذور عائلة آل سيف العريقة</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="relative">
               <Search className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-[#8E8E93]" />
               <input
                 type="text"
                 placeholder="ابحث عن فرد..."
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="pr-11 pl-4 py-3 bg-[#F2F2F7] border-none rounded-2xl text-sm font-bold w-64 focus:ring-2 focus:ring-[#1B4332]/10 transition-all"
               />
             </div>
             <div className="h-10 w-px bg-border mx-2 hidden md:block" />
             <div className="flex gap-2">
                <ControlBtn onClick={() => setZoom(z => Math.min(2, z + 0.2))} icon={<ZoomIn size={20} />} />
                <ControlBtn onClick={() => setZoom(z => Math.max(0.2, z - 0.2))} icon={<ZoomOut size={20} />} />
                <ControlBtn onClick={() => {
                  setZoom(0.8);
                  if (containerRef.current) {
                    setTranslate({ x: containerRef.current.clientWidth / 2, y: 100 });
                  }
                }} icon={<Maximize2 size={20} />} />
             </div>
          </div>
        </header>

        <div
          ref={containerRef}
          className="w-full rounded-[44px] bg-white border border-[#E5E4E0] overflow-hidden shadow-2xl relative"
          style={{ height: "calc(100vh - 280px)", minHeight: 600 }}
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
                if (state.zoom !== zoom) setZoom(state.zoom);
                if (state.translate.x !== translate.x || state.translate.y !== translate.y) setTranslate(state.translate);
              }}
              pathFunc="step"
              pathClassFunc={() => "tree-link"}
              nodeSize={{ x: NODE_W + 100, y: NODE_H + 120 }}
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
            <div dir="rtl" className="w-full max-w-md rounded-[32px] border border-[#D4AF37]/30 bg-white p-8 space-y-6 shadow-2xl animate-fade-up" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-4">
                 <div className="size-16 rounded-full overflow-hidden ring-4 ring-gold-primary/10">
                    <UserAvatar name={editingMember.first_name || "ع"} path={editingMember.avatar_url} className="size-full" />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-[#1B4332]">تعديل ارتباط {editingMember.first_name}</h3>
                    <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 mt-1">
                       <ShieldCheck size={14} /> حساب معتمد ومرتبط بالنظام
                    </p>
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[12px] font-black text-primary uppercase tracking-widest px-1">والد العضو (الارتباط الهرمي)</label>
                 <select
                  value={draftParent ?? ""}
                  onChange={(e) => setDraftParent(e.target.value || null)}
                  className="w-full px-4 py-3 rounded-2xl bg-[#F2F2F7] border-none text-sm font-bold text-primary focus:ring-2 focus:ring-primary/10 transition-all"
                >
                  <option value="">— لا أب (رأس شجرة) —</option>
                  {members.filter((x) => x.id !== editingMember.id).map((x) => (
                    <option key={x.id} value={x.id}>{x.full_name || x.first_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={() => setEditing(null)} className="px-6 py-3 rounded-xl text-sm font-bold text-muted-foreground hover:bg-[#F2F2F7] transition-all">إلغاء</button>
                <button onClick={() => saveParent(editingMember.id)} disabled={saving} className="btn-gold px-8 py-3 text-sm font-bold flex items-center gap-2">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} حفظ التغييرات
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
          stroke-width: 4px;
          stroke-dasharray: 8;
          opacity: 0.2;
          transition: all 0.5s ease;
        }
        .rd3t-tree-container { width: 100%; height: 100%; background: radial-gradient(#F2F2F7 1px, transparent 1px); background-size: 30px 30px; }
      `}</style>
    </AppShell>
  );
}

function ControlBtn({ onClick, icon }: { onClick: () => void, icon: React.ReactNode }) {
  return (
    <button onClick={onClick} className="size-12 rounded-xl bg-[#F2F2F7] text-[#1B4332] flex items-center justify-center hover:bg-[#1B4332] hover:text-white transition-all shadow-sm">
      {icon}
    </button>
  );
}
