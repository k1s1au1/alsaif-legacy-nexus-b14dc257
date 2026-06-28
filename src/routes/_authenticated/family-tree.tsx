import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  History,
  Eye,
  Camera,
  X,
  Plus
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useSiteLogo } from "@/hooks/use-site-logo";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";

export const Route = createFileRoute("/_authenticated/family-tree")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "شجرة عائلة السيف — المخطوطة الحية" },
      {
        name: "description",
        content: "عرض هرمي تفاعلي لشجرة عائلة السيف بنمط المخطوطات الملكية.",
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

const NODE_W = 180;
const NODE_H = 100;

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
  const [zoom, setZoom] = useState(0.8);
  const [translate, setTranslate] = useState({ x: 400, y: 100 });
  const [addOpen, setAddOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dynamicLogo = useSiteLogo();

  const setParentFn = useServerFn(setMemberParent);
  const addExtraFn = useServerFn(addExtraMember);
  const deleteExtraFn = useServerFn(deleteExtraMember);

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
        const isAdmin = rs.includes("admin") || rs.includes("manager") || rs.includes("chairman");
        const profileName = profile?.arabic_name || profile?.full_name || "عضو";
        setMe({
          name: profileName,
          role: rs.includes("chairman") ? "رئيس المجلس" : rs.includes("admin") ? "مسؤول تقني" : "عضو",
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

  const load = useCallback(async () => {
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
      toast.error("فشل مزامنة الشجرة");
    } finally {
      setLoading(false);
    }
  }, []);

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
        name: "جذور السيف",
        attributes: { memberId: "__root__" } as any,
        children: roots.map(build),
      },
    ];
  }, [members]);

  useEffect(() => {
    if (containerRef.current && treeData.length > 0) {
      setTranslate({ x: containerRef.current.clientWidth / 2, y: 120 });
    }
  }, [treeData]);

  async function saveParent(member: Member) {
    setSaving(true);
    try {
      await setParentFn({ data: { userId: member.id, parentId: draftParent, kind: member.kind } });
      toast.success("تم ربط الغصن بنجاح");
      setEditing(null);
      await load();
      router.invalidate();
    } catch (e: any) {
      toast.error("فشل الربط");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(member: Member) {
    if (!confirm(`هل تريد استئصال ${member.first_name} من الشجرة؟`)) return;
    try {
      await deleteExtraFn({ data: { id: member.id } });
      toast.success("تم الحذف");
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error("فشل الحذف");
    }
  }

  const renderNode = ({ nodeDatum, toggleNode }: CustomNodeElementProps) => {
    const memberId = nodeDatum.attributes?.memberId as string | undefined;
    const m = memberId ? members.find((mem) => mem.id === memberId) : null;
    const isRoot = memberId === "__root__";
    const isMe = me?.id && m && m.id === me.id;
    const isSearchMatch = search && m && (m.full_name || "").includes(search);
    const isExtra = m?.kind === "extra";
    const hasChildren = nodeDatum.children && nodeDatum.children.length > 0;

    return (
      <g className="node-group">
        <foreignObject width={NODE_W} height={NODE_H} x={-NODE_W / 2} y={-NODE_H / 2}>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            onClick={toggleNode}
            className={cn(
              "relative flex flex-col items-center justify-center p-4 transition-all cursor-pointer group",
              "manuscript-node"
            )}
          >
             {/* Decorative Background (Leaf/Shield Shape) */}
             <div className={cn(
               "absolute inset-0 z-0 transition-all duration-700 rounded-[30%_70%_70%_30%/30%_30%_70%_70%] border-2 shadow-2xl",
               isRoot ? "bg-primary border-gold-primary scale-110 shadow-gold-primary/20" :
               isMe ? "bg-[#064E3B] border-gold-primary shadow-emerald-900/50" :
               isSearchMatch ? "bg-gold-primary border-white scale-110 shadow-xl" :
               "bg-white/95 dark:bg-[#1a1c20] border-border dark:border-white/10"
             )} />

             {/* Leaf sway animation for non-root nodes */}
             {!isRoot && <div className="absolute inset-0 leaf-sway pointer-events-none opacity-20" />}

             <div className="relative z-10 flex flex-col items-center gap-1 text-center">
                {isRoot ? (
                   <>
                     <div className="size-10 rounded-full bg-gold-primary/20 flex items-center justify-center mb-1"><Trees className="size-6 text-gold-primary" /></div>
                     <span className="text-sm font-black text-white uppercase tracking-widest">{nodeDatum.name}</span>
                   </>
                ) : m ? (
                   <>
                      <div className="size-12 rounded-full border-2 border-gold-primary/30 p-0.5 mb-1 bg-background relative overflow-hidden group-hover:border-gold-primary transition-colors">
                         {isExtra ? <UserCircle2 className="size-full text-muted-foreground/40" /> : <UserAvatar path={m.avatar_url} name={m.first_name || "ع"} className="size-full" userId={m.id} />}
                      </div>
                      <span className={cn("text-lg font-black tracking-tight leading-none", (isMe || isSearchMatch) ? "text-white" : "text-primary dark:text-gold-primary")}>{m.first_name}</span>
                      <span className={cn("text-[9px] font-bold opacity-60", (isMe || isSearchMatch) ? "text-white" : "text-muted-foreground")}>{m.father_name || "السيف"}</span>

                      {isPriv && (
                         <button onClick={(e) => { e.stopPropagation(); setEditing(m.id); setDraftParent(m.parent_id); }} className="absolute -top-1 -right-1 size-8 rounded-full bg-white dark:bg-card border border-border shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-gold-primary hover:text-black">
                            <Pencil size={12} />
                         </button>
                      )}
                   </>
                ) : null}

                {hasChildren && !isRoot && (
                   <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      <div className="size-1 rounded-full bg-gold-primary animate-bounce" />
                      <div className="size-1 rounded-full bg-gold-primary animate-bounce [animation-delay:200ms]" />
                   </div>
                )}
             </div>
          </motion.div>
        </foreignObject>
      </g>
    );
  };

  return (
    <AppShell title="المخطوطة العائلية" user={me!}>
      <div className="max-w-7xl mx-auto space-y-8 pb-20" dir="rtl">
        <QuickActionsBanner />

        {/* Enhanced Interactive Header */}
        <section className="animate-fade-up">
           <div className="relative overflow-hidden rounded-[44px] md:rounded-[56px] glass-surface border border-white/5 shadow-2xl p-8 md:p-14 group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-gold-primary/5 pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
                 <div className="space-y-4 text-center md:text-right">
                    <div className="flex items-center justify-center md:justify-start gap-4">
                       <History className="size-5 text-gold-primary" />
                       <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.5em] text-gold-primary">شجرة السيف التفاعلية</span>
                    </div>
                    <h2 className="text-4xl md:text-7xl font-black tracking-tighter leading-tight text-primary dark:text-white drop-shadow-2xl">
                       المخطوطة<br />
                       <span className="text-gold-primary/40">الحية</span>
                    </h2>
                    <p className="text-sm md:text-xl font-bold text-muted-foreground max-w-lg leading-relaxed italic">
                       "من لا يعرف أصله، لا يعرف حاضره.. استكشف أغصان عائلتنا العريقة بنمط المخطوطات الملكية."
                    </p>
                 </div>

                 <div className="flex flex-col items-center gap-4">
                    {isPriv && (
                      <button onClick={() => setAddOpen(true)} className="btn-gold px-10 py-5 rounded-[24px] font-black text-lg shadow-2xl shadow-gold-primary/20 flex items-center gap-3 active:scale-95 transition-all">
                         <UserPlus size={24} strokeWidth={3} /> إضافة غصن جديد
                      </button>
                    )}
                    <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md px-6 py-2 rounded-2xl border border-white/10">
                       <span className="text-[10px] font-black uppercase tracking-widest text-primary/40">إجمالي الأغصان: {members.length}</span>
                    </div>
                 </div>
              </div>

              {/* Search & Controls Floating Bar */}
              <div className="mt-12 flex flex-col md:flex-row items-center gap-4 bg-muted/40 p-2 rounded-[32px] border border-border/40 backdrop-blur-3xl shadow-inner">
                 <div className="relative flex-1 w-full">
                    <Search className="absolute right-6 top-1/2 -translate-y-1/2 size-5 text-muted-foreground opacity-40" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن فرد في الشجرة..." className="w-full h-14 pr-16 pl-8 bg-transparent border-none font-bold text-base focus:ring-0 placeholder:text-muted-foreground/30" />
                 </div>
                 <div className="flex items-center gap-2 p-1">
                    <ControlBtn onClick={() => setZoom(z => Math.min(2, z + 0.2))} icon={<ZoomIn size={20} />} label="تكبير" />
                    <ControlBtn onClick={() => setZoom(z => Math.max(0.1, z - 0.2))} icon={<ZoomOut size={20} />} label="تصغير" />
                    <ControlBtn onClick={() => { setZoom(0.8); if(containerRef.current) setTranslate({ x: containerRef.current.clientWidth/2, y: 120 }); }} icon={<Maximize2 size={20} />} label="توسيط" />
                 </div>
              </div>
           </div>
        </section>

        {/* Tree Canvas with Parchment Effect */}
        <div
          ref={containerRef}
          className="relative w-full rounded-[60px] border-4 border-[#e5e7eb] dark:border-[#1a1c20] overflow-hidden shadow-[inset_0_0_100px_rgba(0,0,0,0.1)] group/canvas"
          style={{ height: "calc(100vh - 280px)", minHeight: 600 }}
        >
           {/* Parchment Background Layer */}
           <div className="absolute inset-0 bg-[#f9f7f2] dark:bg-[#0c0d10] transition-colors duration-1000 z-0">
              <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/parchment.png')" }} />
              <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
              <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
           </div>

           {loading ? (
             <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/40 backdrop-blur-md">
                <div className="relative">
                   <Loader2 className="size-16 animate-spin text-gold-primary" strokeWidth={3} />
                   <Trees className="absolute inset-0 m-auto size-6 text-primary" />
                </div>
                <p className="mt-4 font-black text-primary tracking-[0.3em] uppercase text-xs">جاري خط المخطوطة...</p>
             </div>
           ) : treeData.length > 0 ? (
             <Tree
               data={treeData[0]}
               orientation="vertical"
               translate={translate}
               zoom={zoom}
               onUpdate={(s) => { setZoom(s.zoom); setTranslate(s.translate); }}
               pathFunc="step"
               pathClassFunc={() => "manuscript-link"}
               nodeSize={{ x: NODE_W + 60, y: NODE_H + 100 }}
               renderCustomNodeElement={renderNode}
               collapsible={false}
               zoomable
               draggable
               transitionDuration={1000}
             />
           ) : (
             <div className="absolute inset-0 flex items-center justify-center z-10 text-muted-foreground font-black italic">لا توجد بيانات للعرض</div>
           )}

           {/* Decorative Corner Ornaments */}
           <div className="absolute top-10 right-10 size-20 border-t-4 border-r-4 border-gold-primary/20 rounded-tr-3xl pointer-events-none group-hover/canvas:border-gold-primary/40 transition-all duration-1000" />
           <div className="absolute bottom-10 left-10 size-20 border-b-4 border-l-4 border-gold-primary/20 rounded-bl-3xl pointer-events-none group-hover/canvas:border-gold-primary/40 transition-all duration-1000" />
        </div>

        {/* Editing Dialog (Unchanged Logic, Enhanced UI) */}
        <AnimatePresence>
           {editing && (
             <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setEditing(null)}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-card w-full max-w-md rounded-[40px] p-10 border border-gold-primary/20 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                   <div className="flex flex-col items-center text-center gap-6 mb-10">
                      <div className="size-24 rounded-[32px] bg-primary flex items-center justify-center text-white shadow-xl relative">
                         <History className="size-10" />
                         <div className="absolute -bottom-2 -right-2 size-10 rounded-2xl bg-gold-primary flex items-center justify-center text-black border-4 border-card"><Plus size={20} strokeWidth={3} /></div>
                      </div>
                      <div>
                         <h3 className="text-2xl font-black text-primary">تعديل الغصن</h3>
                         <p className="text-sm font-bold text-muted-foreground mt-1">تغيير ارتباط {members.find(m => m.id === editing)?.first_name} في الشجرة.</p>
                      </div>
                   </div>

                   <div className="space-y-6">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">ارتباط الأب</label>
                         <select value={draftParent ?? ""} onChange={e => setDraftParent(e.target.value || null)} className="w-full h-14 px-6 rounded-2xl bg-muted/40 border border-border/60 font-bold text-sm focus:ring-4 focus:ring-primary/5 transition-all appearance-none outline-none">
                            <option value="">— جذر مستقل (بدون أب) —</option>
                            {members.filter(x => x.id !== editing).map(x => (
                               <option key={x.id} value={x.id}>{(x.full_name || x.first_name) + (x.kind === 'extra' ? ' (مضاف)' : '')}</option>
                            ))}
                         </select>
                      </div>

                      <div className="flex gap-3">
                         {members.find(m => m.id === editing)?.kind === 'extra' && (
                           <button onClick={() => handleDelete(members.find(m => m.id === editing)!)} className="size-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><Trash2 size={24} /></button>
                         )}
                         <button onClick={() => setEditing(null)} className="flex-1 py-4 rounded-2xl font-black text-muted-foreground hover:bg-muted transition-all">تراجع</button>
                         <button disabled={saving} onClick={() => saveParent(members.find(m => m.id === editing)!)} className="flex-[2] btn-gold py-4 rounded-2xl font-black text-lg shadow-xl shadow-gold-primary/20 flex items-center justify-center gap-2">
                            {saving ? <Loader2 className="size-5 animate-spin" /> : <Check size={20} strokeWidth={3} />} حفظ
                         </button>
                      </div>
                   </div>
                </motion.div>
             </div>
           )}
        </AnimatePresence>

        {addOpen && isPriv && (
          <AddMemberDialog
            members={members}
            onClose={() => setAddOpen(false)}
            onSubmit={async (payload) => {
              try {
                await addExtraFn({ data: payload });
                toast.success("تم إضافة الغصن للمخطوطة");
                setAddOpen(false);
                await load();
              } catch (e: any) { throw e; }
            }}
          />
        )}
      </div>

      <style>{`
        /* Living Manuscript Styles */
        .rd3t-tree-container { width: 100%; height: 100%; cursor: grab; }
        .rd3t-tree-container:active { cursor: grabbing; }

        .manuscript-link {
          fill: none;
          stroke: #D4AF37;
          stroke-width: 1.5px;
          stroke-opacity: 0.3;
          stroke-dasharray: 2000;
          stroke-dashoffset: 2000;
          animation: drawPath 3s ease forwards;
          transition: all 0.5s ease;
        }

        .manuscript-node:hover ~ .manuscript-link {
           stroke-opacity: 0.8;
           stroke-width: 2.5px;
        }

        @keyframes drawPath {
          to { stroke-dashoffset: 0; }
        }

        .leaf-sway {
          animation: sway 10s ease-in-out infinite alternate;
          transform-origin: top center;
        }

        @keyframes sway {
          from { transform: rotate(-1deg) translateX(-1px); }
          to { transform: rotate(1deg) translateX(1px); }
        }

        .node-group foreignObject { overflow: visible; }

        /* Calligraphic Fonts */
        .manuscript-node span {
           font-family: 'Amiri', serif;
        }
      `}</style>
    </AppShell>
  );
}

function ControlBtn({ onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-card border border-border/40 hover:bg-primary hover:text-white transition-all shadow-sm group">
       {icon}
       <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">{label}</span>
    </button>
  );
}

// AddMemberDialog remains similar but with updated colors to match the manuscript theme
function AddMemberDialog({ members, onClose, onSubmit }: any) {
  const [firstName, setFirstName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [grandfatherName, setGrandfatherName] = useState("");
  const [relation, setRelation] = useState("child");
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!firstName.trim()) return toast.error("الاسم الأول مطلوب");
    setSaving(true);
    try {
      await onSubmit({
        firstName: firstName.trim(),
        fatherName: fatherName.trim() || null,
        grandfatherName: grandfatherName.trim() || null,
        relation,
        targetId: targetId || null,
      });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4" onClick={onClose}>
       <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card w-full max-w-xl rounded-[40px] p-8 md:p-12 border border-gold-primary/20 shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-10">
             <div className="flex items-center gap-4">
                <div className="size-14 rounded-2xl bg-primary flex items-center justify-center text-white"><UserPlus size={28} /></div>
                <h3 className="text-2xl font-black text-primary">إضافة غصن جديد</h3>
             </div>
             <button onClick={onClose} className="size-12 rounded-full bg-muted flex items-center justify-center"><X size={24} /></button>
          </div>

          <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="الاسم الأول *"><input value={firstName} onChange={e => setFirstName(e.target.value)} className="input-fancier" placeholder="مثال: خالد" /></Field>
                <Field label="صلة القرابة">
                   <select value={relation} onChange={e => setRelation(e.target.value)} className="input-fancier">
                      <option value="child">ابن لـ ...</option>
                      <option value="father">أب لـ ...</option>
                      <option value="root">جذر جديد</option>
                   </select>
                </Field>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="اسم الأب"><input value={fatherName} onChange={e => setFatherName(e.target.value)} className="input-fancier" /></Field>
                <Field label="اسم الجد"><input value={grandfatherName} onChange={e => setGrandfatherName(e.target.value)} className="input-fancier" /></Field>
             </div>
             {relation !== "root" && (
                <Field label="المرجع في الشجرة">
                   <select value={targetId} onChange={e => setTargetId(e.target.value)} className="input-fancier">
                      <option value="">— اختر العضو المرجعي —</option>
                      {members.map((m: any) => <option key={m.id} value={m.id}>{m.full_name || m.first_name}</option>)}
                   </select>
                </Field>
             )}

             <div className="flex gap-4 pt-6">
                <button onClick={onClose} className="flex-1 py-5 rounded-3xl font-black text-muted-foreground hover:bg-muted transition-all">تراجع</button>
                <button disabled={saving} onClick={handleSubmit} className="flex-[2] btn-gold py-5 rounded-3xl font-black text-xl shadow-2xl flex items-center justify-center gap-3">
                   {saving ? <Loader2 className="animate-spin size-6" /> : <><Plus size={24} strokeWidth={3} /> إضافة</>}
                </button>
             </div>
          </div>
       </motion.div>
    </div>
  );
}

function Field({ label, children }: any) {
  return (
    <div className="space-y-2">
       <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">{label}</label>
       {children}
    </div>
  );
}
