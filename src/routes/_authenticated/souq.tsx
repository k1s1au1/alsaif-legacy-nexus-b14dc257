import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import {
  Store,
  Plus,
  Search,
  ExternalLink,
  Instagram,
  MessageCircle,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  Loader2,
  Image as ImageIcon,
  Tag,
  User as UserIcon,
  Globe
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { UserAvatar } from "@/components/user-avatar";

export const Route = createFileRoute("/_authenticated/souq")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "سوق السيف — السيف" },
      { name: "description", content: "دليل أعمال وأنشطة أبناء عائلة السيف." },
    ],
  }),
  component: SouqPage,
});

const CATEGORIES = [
  { id: "all", label: "الكل", icon: Store },
  { id: "retail", label: "تجزئة وتسوق", icon: Tag },
  { id: "food", label: "مطاعم وأغذية", icon: Tag },
  { id: "professional", label: "خدمات مهنية", icon: UserIcon },
  { id: "creative", label: "إبداع وتصميم", icon: ImageIcon },
  { id: "tech", label: "تقنية وبرمجة", icon: Globe },
];

interface Business {
  id: string;
  owner_id: string;
  name: string;
  category: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  whatsapp_number: string | null;
  instagram_handle: string | null;
  created_at: string;
  owner?: {
    arabic_name: string | null;
    full_name: string | null;
  }
}

function SouqPage() {
  const [meId, setMeId] = useState<string | null>(null);
  const [profile, setProfile] = useState({ name: "...", role: "...", initial: "س" });
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const dynamicLogo = useSiteLogo();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMeId(user.id);

      const [{ data: p }, { data: r }, { data: biz }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("family_businesses").select("*, owner:profiles(arabic_name, full_name)").order("created_at", { ascending: false })
      ]);

      const rs = (r ?? []).map(x => x.role);
      if (p) {
        setProfile({
          name: p.arabic_name || p.full_name || "عضو",
          role: rs.includes("chairman") ? "رئيس المجلس" : rs.includes("admin") ? "مسؤول النظام" : "عضو المجلس",
          initial: (p.arabic_name?.[0] || "ع").toUpperCase()
        });
      }

      setBusinesses((biz || []) as any);
    } catch (err) {
      console.error("Souq error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = businesses.filter(b => {
    const c = activeCategory === "all" || b.category === activeCategory;
    const s = !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.description?.toLowerCase().includes(search.toLowerCase());
    return c && s;
  });

  return (
    <AppShell title="سوق السيف" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-24" dir="rtl">
        <QuickActionsBanner />

        {/* Hero Header */}
        <section className="animate-fade-up px-4 md:px-0">
          <div className="relative overflow-hidden rounded-[32px] md:rounded-[48px] bg-gradient-to-br from-[#064E3B] via-[#0d2620] to-black p-6 md:p-12 text-white shadow-2xl border border-white/5 group">
            <div className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none z-1 transition-transform duration-1000 group-hover:scale-110 group-hover:opacity-40">
              <div className="size-28 md:size-64 logo-alsaif-banner" style={{ "--logo-url": `url(${dynamicLogo || alsaifMark.url})` } as any} />
            </div>
            <div className="absolute top-0 right-0 size-64 bg-gold-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
              <div className="space-y-3 md:space-y-5 text-center md:text-right">
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <div className="h-0.5 w-8 md:w-12 bg-gold-primary shadow-[0_0_10px_rgba(212,175,55,0.6)]" />
                  <span className="text-[9px] md:text-xs font-black uppercase tracking-[0.4em] text-gold-primary">دليل أعمال العائلة</span>
                </div>
                <h2 className="text-3xl md:text-6xl font-black tracking-tighter leading-tight drop-shadow-2xl">سوق السيف</h2>
                <p className="text-white/60 font-bold text-sm md:text-xl max-w-xl">اكتشف وادعم مشاريع وأعمال أبناء وبنات عائلة السيف.</p>
              </div>
              <div className="size-16 md:size-28 rounded-2xl md:rounded-[36px] bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-2xl self-center md:self-auto shrink-0 group-hover:rotate-12 transition-transform duration-700">
                <Store className="size-8 md:size-14 text-gold-primary" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </section>

        {/* Filters & Actions */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-4 md:px-0">
          <div className="flex items-center gap-2 p-1.5 bg-muted/40 rounded-3xl border border-border/40 overflow-x-auto no-scrollbar w-full md:w-auto">
             {CATEGORIES.map(c => (
               <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={cn(
                  "px-6 py-3 rounded-[22px] text-xs font-black transition-all flex items-center gap-2 shrink-0 border-2",
                  activeCategory === c.id
                    ? "bg-primary text-white border-primary shadow-lg scale-105"
                    : "bg-card text-muted-foreground border-transparent hover:bg-muted"
                )}
               >
                 <c.icon size={14} /> <span>{c.label}</span>
               </button>
             ))}
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="relative flex-1 md:w-64">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن نشاط..." className="w-full h-12 pr-11 pl-4 rounded-2xl bg-card border border-border/60 font-bold text-xs focus:ring-4 focus:ring-primary/5 transition-all" />
             </div>
             <button onClick={() => setShowAdd(true)} className="btn-gold size-12 rounded-2xl flex items-center justify-center shadow-xl shrink-0 active:scale-95 transition-all">
                <Plus size={24} strokeWidth={3} />
             </button>
          </div>
        </div>

        {/* Business Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-4 md:px-0">
           {loading ? (
             <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin size-12 mx-auto text-primary opacity-20" /></div>
           ) : filtered.length === 0 ? (
             <div className="col-span-full p-20 text-center bg-muted/20 rounded-[48px] border-4 border-dashed italic text-muted-foreground">
                لا توجد أعمال في هذا التصنيف حالياً. كن أول من يضيف مشروعه!
             </div>
           ) : (
             filtered.map(b => <BusinessCard key={b.id} biz={b} meId={meId} onEdit={setEditingBusiness} onDelete={async () => { if(confirm("حذف النشاط؟")) { await supabase.from("family_businesses").delete().eq("id", b.id); loadData(); } }} />)
           )}
        </div>
      </div>

      <AnimatePresence>
        {(showAdd || editingBusiness) && (
          <BusinessDialog
            biz={editingBusiness}
            meId={meId}
            onClose={() => { setShowAdd(false); setEditingBusiness(null); }}
            onSaved={loadData}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function BusinessCard({ biz, meId, onEdit, onDelete }: any) {
  const isOwner = biz.owner_id === meId;
  const category = CATEGORIES.find(c => c.id === biz.category);

  return (
    <motion.div layout className="card-surface p-8 relative overflow-hidden group transition-all duration-500 hover:shadow-2xl hover:-translate-y-1">
       <div className="flex items-start justify-between mb-6">
          <div className="size-20 rounded-[28px] bg-primary/5 border border-primary/10 flex items-center justify-center text-primary shadow-inner overflow-hidden">
             {biz.logo_url ? <img src={biz.logo_url} className="size-full object-cover" alt="" /> : <Store size={32} strokeWidth={1.5} />}
          </div>
          {isOwner && (
            <div className="flex gap-2">
               <button onClick={() => onEdit(biz)} className="size-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all"><Pencil size={16} /></button>
               <button onClick={onDelete} className="size-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button>
            </div>
          )}
       </div>

       <div className="space-y-3 mb-8">
          <div className="flex items-center gap-2 text-gold-primary text-[10px] font-black uppercase tracking-widest">
             <category.icon size={12} /> <span>{category?.label}</span>
          </div>
          <h3 className="text-2xl font-black text-primary leading-tight">{biz.name}</h3>
          <p className="text-sm font-bold text-muted-foreground/80 line-clamp-3 leading-relaxed">{biz.description || "لا يوجد وصف متوفر."}</p>
       </div>

       <div className="flex items-center gap-3 pt-6 border-t border-border/40">
          {biz.whatsapp_number && (
            <a href={`https://wa.me/${biz.whatsapp_number}`} target="_blank" className="flex-1 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center gap-2 hover:bg-emerald-500 hover:text-white transition-all font-black text-xs shadow-sm">
               <MessageCircle size={16} /> تواصل
            </a>
          )}
          {biz.instagram_handle && (
            <a href={`https://instagram.com/${biz.instagram_handle}`} target="_blank" className="size-12 rounded-xl bg-pink-500/10 text-pink-600 flex items-center justify-center hover:bg-pink-500 hover:text-white transition-all shadow-sm">
               <Instagram size={20} />
            </a>
          )}
          {biz.website_url && (
            <a href={biz.website_url} target="_blank" className="size-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all shadow-sm">
               <ExternalLink size={20} />
            </a>
          )}
       </div>

       <div className="mt-4 flex items-center gap-2 opacity-40">
          <UserAvatar name={biz.owner?.arabic_name} className="size-4 rounded-full" />
          <span className="text-[10px] font-bold">{biz.owner?.arabic_name || "عضو"}</span>
       </div>
    </motion.div>
  );
}

function BusinessDialog({ biz, meId, onClose, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: biz?.name ?? "",
    category: biz?.category ?? "retail",
    description: biz?.description ?? "",
    whatsapp_number: biz?.whatsapp_number ?? "",
    instagram_handle: biz?.instagram_handle ?? "",
    website_url: biz?.website_url ?? "",
    logo_url: biz?.logo_url ?? ""
  });

  const submit = async (e: any) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("الاسم مطلوب");
    setSaving(true);

    try {
      if (biz) {
        await supabase.from("family_businesses").update(form).eq("id", biz.id);
      } else {
        await supabase.from("family_businesses").insert({ ...form, owner_id: meId });
      }
      toast.success("تم حفظ النشاط بنجاح");
      onSaved();
      onClose();
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl" dir="rtl">
       <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-[#0D0F14] w-full max-w-2xl rounded-[48px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
          <header className="p-8 border-b border-border/40 flex items-center justify-between">
             <h3 className="text-2xl font-black text-primary">{biz ? "تعديل النشاط" : "إضافة نشاط تجاري"}</h3>
             <button onClick={onClose} className="size-12 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-all"><X size={24} /></button>
          </header>

          <form onSubmit={submit} className="p-8 space-y-6 overflow-y-auto no-scrollbar">
             <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">اسم النشاط</label>
                      <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="مثال: مخبز السيف..." className="w-full h-14 px-6 rounded-2xl bg-muted/30 border border-border font-black text-base focus:ring-4 focus:ring-primary/5 transition-all" required />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">التصنيف</label>
                      <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full h-14 px-6 rounded-2xl bg-muted/30 border border-border font-black text-base focus:ring-4 focus:ring-primary/5 transition-all">
                         {CATEGORIES.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">وصف الخدمة أو المتجر</label>
                   <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="ماذا تقدم للعائلة؟" rows={3} className="w-full p-6 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:ring-4 focus:ring-primary/5 transition-all resize-none" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">رقم الواتساب</label>
                      <input value={form.whatsapp_number} onChange={e => setForm({...form, whatsapp_number: e.target.value})} placeholder="9665xxxxxxxx" className="w-full h-12 px-5 rounded-xl bg-muted/30 border border-border font-bold text-xs focus:ring-4 focus:ring-primary/5 transition-all" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">يوزر إنستقرام</label>
                      <input value={form.instagram_handle} onChange={e => setForm({...form, instagram_handle: e.target.value})} placeholder="alsaif.shop" className="w-full h-12 px-5 rounded-xl bg-muted/30 border border-border font-bold text-xs focus:ring-4 focus:ring-primary/5 transition-all" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">الموقع الإلكتروني</label>
                      <input value={form.website_url} onChange={e => setForm({...form, website_url: e.target.value})} placeholder="https://..." className="w-full h-12 px-5 rounded-xl bg-muted/30 border border-border font-bold text-xs focus:ring-4 focus:ring-primary/5 transition-all" />
                   </div>
                </div>
             </div>

             <div className="flex gap-4 pt-6">
                <button type="button" onClick={onClose} className="flex-1 py-5 rounded-[28px] font-black text-muted-foreground hover:bg-muted transition-all">تراجع</button>
                <button disabled={saving} type="submit" className="flex-[2] btn-gold py-5 rounded-[28px] font-black text-xl shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]">
                   {saving ? <Loader2 className="animate-spin size-6" /> : <><Store size={24} /> <span>حفظ النشاط</span></>}
                </button>
             </div>
          </form>
       </motion.div>
    </div>
  );
}
