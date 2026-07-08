import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  Lock,
  ShieldCheck,
  FileText,
  Key,
  Plus,
  Search,
  Eye,
  Trash2,
  Clock,
  Download,
  X,
  FileWarning,
  History,
  ShieldAlert,
  Loader2,
  MoreVertical,
  ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { QuickActionsBanner } from "@/components/quick-actions-banner";

export const Route = createFileRoute("/_authenticated/vault")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "خزنة الوثائق والوصايا — السيف" },
      { name: "description", content: "خزنة رقمية آمنة لحفظ الوثائق العائلية والوصايا." },
    ],
  }),
  component: SecureVaultPage,
});

interface VaultItem {
  id: string;
  title: string;
  description: string | null;
  category: VaultCategory;
  storage_path: string;
  owner_id: string;
  is_encrypted: boolean;
  unlock_at: string | null;
  created_at: string;
  uploader?: {
    arabic_name: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

const CATEGORIES: { key: VaultCategory; label: string; icon: any; color: string; desc: string }[] = [
  { key: "will", label: "الوصايا", icon: FileText, color: "bg-amber-600", desc: "رسائل ووصايا موجهة للمستقبل." },
  { key: "deed", label: "الصكوك والوثائق", icon: ShieldCheck, color: "bg-emerald-700", desc: "صكوك ملكية ووثائق رسمية عائلية." },
  { key: "heritage", label: "مخطوطات تاريخية", icon: History, color: "bg-gold-primary", desc: "وثائق ومراسلات تاريخية قديمة." },
  { key: "private", label: "خاص وسري", icon: Lock, color: "bg-rose-800", desc: "مستندات خاصة لا يراها إلا أشخاص محددون." },
];

function SecureVaultPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [activeTab, setActiveTab] = useState<VaultCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Upload Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCat, setNewCat] = useState<VaultCategory>("will");
  const [newUnlockAt, setNewUnlockAt] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("secure_vault" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setItems([]);
      } else {
        const vaultItems = (data || []) as VaultItem[];

        // Fetch uploader profiles
        const uploaderIds = [...new Set(vaultItems.map(it => it.owner_id))];
        if (uploaderIds.length > 0) {
           const { data: profs } = await supabase
             .from("profiles")
             .select("id, arabic_name, full_name, avatar_url")
             .in("id", uploaderIds);

           const profMap: Record<string, any> = {};
           profs?.forEach(p => profMap[p.id] = p);

           setItems(vaultItems.map(it => ({
             ...it,
             uploader: profMap[it.owner_id]
           })));
        } else {
           setItems(vaultItems);
        }
      }
    } catch (err) {
      console.error("Vault load error", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredItems = items.filter(it =>
    (activeTab === "all" || it.category === activeTab) &&
    (it.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
     (it.description?.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error("حجم الملف كبير جداً (الأقصى 20MB)");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!newTitle || !selectedFile) {
      toast.error("يرجى إكمال البيانات واختيار ملف");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading("جاري تشفير وإيداع الوثيقة...");

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Unauthorized");

      // Check if file is selected
      if (!selectedFile) throw new Error("لم يتم اختيار ملف");

      // Get project URL for debugging
      const projectUrl = (supabase as any).supabaseUrl || "غير معروف";
      console.log("Connecting to Supabase at:", projectUrl);

      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${userData.user.id}/${crypto.randomUUID()}.${fileExt}`;

      // Debugging logs to verify project connection
      console.log("Vault: Attempting upload...");
      console.log("Bucket Name:", "vault-media");
      console.log("File Path:", filePath);

      // 1. Upload to Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("vault-media")
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error("Supabase Storage Full Error:", uploadError);
        throw new Error(`عذراً، خطأ في الرفع: ${uploadError.message || JSON.stringify(uploadError)}`);
      }

      // 2. Insert into DB
      const { error: dbError } = await supabase.from("secure_vault" as any).insert({
        title: newTitle,
        description: newDesc || null,
        category: newCat,
        storage_path: filePath,
        owner_id: userData.user.id,
        unlock_at: newUnlockAt || null,
        is_encrypted: true
      });

      if (dbError) {
        console.error("Database Error Object:", dbError);
        const errorMsg = dbError.message || JSON.stringify(dbError);
        throw new Error(`خطأ في الحفظ: ${errorMsg}`);
      }

      toast.success("تم الإيداع في الخزنة بنجاح ✨", { id: toastId });
      setShowAdd(false);
      resetForm();
      load();
    } catch (err: any) {
      console.error("Upload error details:", err);
      toast.error(err.message || "فشل الإيداع: تأكد من صلاحيات الخزنة", { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setNewTitle("");
    setNewDesc("");
    setNewCat("will");
    setNewUnlockAt("");
    setSelectedFile(null);
  };

  const handleDownload = async (item: VaultItem) => {
    if (item.unlock_at && new Date(item.unlock_at) > new Date()) {
      toast.error("هذه الوثيقة لا تزال مقفلة زمنياً");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from("vault-media")
        .createSignedUrl(item.storage_path, 60);

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      toast.error("تعذر فتح الوثيقة");
    }
  };

  const handleDelete = async (item: VaultItem) => {
    if (!confirm("هل أنت متأكد من حذف هذه الوثيقة نهائياً؟")) return;

    try {
      const { error: dbError } = await supabase.from("secure_vault" as any).delete().eq("id", item.id);
      if (dbError) throw dbError;

      await supabase.storage.from("vault-media").remove([item.storage_path]);

      toast.success("تم حذف الوثيقة بنجاح");
      load();
    } catch (err) {
      toast.error("فشل في حذف الوثيقة");
    }
  };

  const meId = supabase.auth.getUser().then(({data}) => data.user?.id);

  return (
    <AppShell title="خزنة الوثائق والوصايا" user={{ name: "الخزنة الرقمية", role: "خصوصية فائقة", initial: "خ" }}>
      <div className="max-w-7xl mx-auto space-y-12 pb-24 px-4 md:px-0" dir="rtl">

        {/* Prestige Header */}
        <section className="animate-fade-up">
           <div className="relative overflow-hidden rounded-[40px] md:rounded-[60px] bg-gradient-to-br from-[#0a1a16] via-[#051410] to-black border border-white/5 shadow-2xl p-8 md:p-20 flex flex-col md:flex-row items-center justify-between gap-12 group">
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
                   style={{ backgroundImage: `url("https://www.transparenttextures.com/patterns/carbon-fibre.png")` }} />

              <div className="relative z-10 space-y-6 text-center md:text-right flex-1">
                 <div className="flex items-center justify-center md:justify-start gap-4">
                    <div className="h-0.5 w-12 bg-gold-primary" />
                    <span className="text-[10px] font-black uppercase tracking-[0.5em] text-gold-primary">النظام الأمني المشفر</span>
                 </div>
                 <div className="space-y-3">
                    <h2 className="text-4xl md:text-7xl font-black tracking-tighter text-white drop-shadow-2xl">خزنة<br /><span className="text-white/20">الوصايا والوثائق</span></h2>
                    <p className="text-sm md:text-2xl font-bold text-white/50 max-w-2xl leading-relaxed">المكان الأكثر أماناً لحفظ أسرار العائلة، صكوكها، ووصاياها الموجهة للمستقبل.</p>
                 </div>
              </div>

              <div className="relative z-10 shrink-0 flex flex-col items-center gap-6">
                 <div className="relative group/vault">
                    <div className="absolute inset-0 bg-gold-primary/20 rounded-full blur-3xl animate-pulse group-hover/vault:bg-gold-primary/40 transition-colors" />
                    <div className="relative size-32 md:size-48 rounded-[48px] bg-white/5 backdrop-blur-2xl border border-white/10 flex items-center justify-center text-gold-primary shadow-2xl transition-transform duration-700 group-hover/vault:rotate-[10deg] group-hover/vault:scale-105">
                       <Lock size={64} strokeWidth={1} className="md:size-24" />
                    </div>
                 </div>
                 <button
                   onClick={() => setShowAdd(true)}
                   className="btn-gold px-10 py-5 rounded-[24px] text-lg font-black flex items-center gap-3 shadow-xl hover:scale-105 active:scale-95 transition-all"
                 >
                    <Plus size={24} strokeWidth={3} /> إضافة وثيقة جديدة
                 </button>
              </div>
           </div>
        </section>

        <QuickActionsBanner />

        {/* Filter & Search */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 animate-fade-up" style={{ animationDelay: "100ms" }}>
           <div className="flex items-center gap-2 p-1.5 bg-muted/40 backdrop-blur-xl rounded-[28px] border border-border/40 overflow-x-auto no-scrollbar w-full md:w-auto shadow-inner">
              <button
                onClick={() => setActiveTab("all")}
                className={cn("px-6 py-3 rounded-2xl text-xs font-black transition-all", activeTab === "all" ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:bg-muted")}
              >الكل</button>
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => setActiveTab(c.key)}
                  className={cn("px-6 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0", activeTab === c.key ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:bg-muted")}
                >
                  <c.icon size={14} /> {c.label}
                </button>
              ))}
           </div>

           <div className="relative w-full md:w-80 group">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث في الخزنة..."
                className="w-full bg-card border border-border rounded-2xl pr-12 pl-4 py-4 text-sm font-bold focus:ring-2 focus:ring-primary/10 outline-none transition-all shadow-sm"
              />
           </div>
        </div>

        {/* Instructions/Empty State for Missing Table */}
        {loading ? (
          <div className="py-40 text-center opacity-30">
             <Loader2 className="size-16 animate-spin mx-auto mb-4" />
             <p className="font-black uppercase tracking-widest text-xs">جاري فتح الخزنة...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="animate-fade-up py-32 md:py-48 flex flex-col items-center text-center gap-8 card-surface border-dashed border-2 p-10">
             <div className="size-32 rounded-[50px] bg-gold-primary/5 border border-gold-primary/10 flex items-center justify-center text-gold-primary/30">
                <ShieldAlert size={60} />
             </div>
             <div className="space-y-4 max-w-lg">
                <h3 className="text-3xl font-black text-primary">الخزنة فارغة أو غير مفعلة</h3>
                <p className="text-muted-foreground font-bold leading-relaxed">
                   لم نجد أي وثائق في خزنتك الخاصة. ابدأ برفع أول وثيقة ملكية أو وصية لتكون محفوظة بأعلى درجات الخصوصية.
                </p>
                <div className="pt-6 flex flex-col items-center gap-4">
                   <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gold-primary tracking-widest opacity-60">
                      <ShieldCheck size={14} /> حماية مشفرة 256-bit
                   </div>
                </div>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-up" style={{ animationDelay: "200ms" }}>
             {filteredItems.map(item => (
                <VaultCard
                  key={item.id}
                  item={item}
                  onDownload={() => handleDownload(item)}
                  onDelete={() => handleDelete(item)}
                  isOwner={item.owner_id === (supabase.auth.getSession() as any)?.data?.session?.user?.id}
                />
             ))}
          </div>
        )}

        {/* Security Notice Footer */}
        <section className="pt-20 opacity-40 hover:opacity-100 transition-opacity">
           <div className="flex flex-col items-center gap-6 p-10 border-t border-border/40 text-center">
              <ShieldCheck className="size-12 text-primary" />
              <div className="space-y-2">
                 <h4 className="text-sm font-black text-primary uppercase tracking-[0.4em]">Family Security Protocol</h4>
                 <p className="text-xs font-bold text-muted-foreground max-w-md">كافة الوثائق المرفوعة في هذه الخزنة تخضع لقوانين الخصوصية العائلية المشددة ولا يحق لأي جهة برمجية الاطلاع على محتواها.</p>
              </div>
           </div>
        </section>

      </div>

      <AnimatePresence>
         {showAdd && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-card border border-border rounded-[48px] w-full max-w-xl p-10 space-y-8 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 size-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />

                  <div className="flex items-center justify-between relative z-10">
                     <div className="space-y-1">
                        <h3 className="text-2xl font-black text-primary tracking-tight">إيداع وثيقة جديدة</h3>
                        <p className="text-xs font-bold text-muted-foreground opacity-60">سيتم حفظ الملف في الخزنة المشفرة</p>
                     </div>
                     <button onClick={() => setShowAdd(false)} className="size-12 rounded-full bg-muted flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm"><X size={24} /></button>
                  </div>

                  <div className="space-y-6 relative z-10">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-primary/40 mr-1 tracking-widest">عنوان الوثيقة</label>
                        <input
                          value={newTitle}
                          onChange={e => setNewTitle(e.target.value)}
                          placeholder="مثلاً: وصية الجد خالد، صك مزرعة القصيم..."
                          className="w-full h-16 bg-muted/40 border border-border rounded-2xl px-6 font-bold text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                        />
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-primary/40 mr-1 tracking-widest">وصف مختصر (اختياري)</label>
                        <input
                          value={newDesc}
                          onChange={e => setNewDesc(e.target.value)}
                          placeholder="اكتب وصفاً بسيطاً لمحتوى الوثيقة..."
                          className="w-full h-16 bg-muted/40 border border-border rounded-2xl px-6 font-bold text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                        />
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase text-primary/40 mr-1 tracking-widest">التصنيف</label>
                           <select
                             value={newCat}
                             onChange={e => setNewCat(e.target.value as VaultCategory)}
                             className="w-full h-16 bg-muted/40 border border-border rounded-2xl px-6 font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                           >
                              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                           </select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase text-primary/40 mr-1 tracking-widest">تاريخ الفتح (اختياري)</label>
                           <input
                             type="date"
                             value={newUnlockAt}
                             onChange={e => setNewUnlockAt(e.target.value)}
                             className="w-full h-16 bg-muted/40 border border-border rounded-2xl px-6 font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                           />
                        </div>
                     </div>

                     <label className="flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed border-border/60 rounded-[32px] cursor-pointer hover:bg-primary/5 transition-all bg-muted/10 group">
                        <div className="size-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                           <Download size={32} className="rotate-180" />
                        </div>
                        <div className="text-center">
                           <p className="font-black text-primary">{selectedFile ? selectedFile.name : "اسحب الملف هنا"}</p>
                           <p className="text-[10px] font-bold text-muted-foreground opacity-60 mt-1">{selectedFile ? `(${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)` : "PDF, JPG, PNG (حد أقصى 20MB)"}</p>
                        </div>
                        <input type="file" hidden accept=".pdf,image/*" onChange={handleFileSelect} />
                     </label>
                  </div>

                  <button
                    onClick={handleUpload}
                    disabled={isUploading || !newTitle || !selectedFile}
                    className="w-full btn-gold py-6 rounded-[24px] text-lg font-black shadow-xl shadow-gold-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                     {isUploading ? <Loader2 className="size-6 animate-spin mx-auto" /> : "تأكيد الإيداع في الخزنة"}
                  </button>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
    </AppShell>
  );
}

function VaultCard({ item, onDownload, onDelete, isOwner }: { item: VaultItem, onDownload: () => void, onDelete: () => void, isOwner: boolean }) {
  const cat = CATEGORIES.find(c => c.key === item.category) || CATEGORIES[0];
  const isLocked = item.unlock_at && new Date(item.unlock_at) > new Date();

  return (
    <motion.div
      whileHover={{ y: -5 }}
      onClick={onDownload}
      className="card-surface p-8 space-y-6 group cursor-pointer relative overflow-hidden"
    >
       <div className={cn("absolute top-0 right-0 w-1.5 h-full", cat.color)} />

       <div className="flex items-start justify-between">
          <div className={cn("size-14 rounded-2xl flex items-center justify-center text-white shadow-lg", cat.color)}>
             {isLocked ? <Clock size={28} /> : <cat.icon size={28} />}
          </div>

          <div className="flex items-center gap-2">
            {isOwner && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="size-10 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button className="size-10 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground transition-all"><MoreVertical size={20} /></button>
          </div>
       </div>

       <div className="space-y-2">
          <div className="flex items-center gap-2">
             <h4 className="text-xl font-black text-primary tracking-tight truncate">{item.title}</h4>
             {item.is_encrypted && <Key size={14} className="text-gold-primary" />}
          </div>
          <p className="text-xs font-bold text-muted-foreground opacity-60 line-clamp-2 leading-relaxed">{item.description || "لا يوجد وصف لهذه الوثيقة."}</p>
       </div>

       <div className="pt-4 flex items-center justify-between border-t border-border/40">
          <div className="flex items-center gap-4">
             <div className="size-8 rounded-full border border-white/10 overflow-hidden bg-emerald-950">
                <img src={item.uploader?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + (item.uploader?.arabic_name || "V")} alt="" className="size-full object-cover" />
             </div>
             <div className="text-right">
                <p className="text-[8px] font-black uppercase text-primary/40 tracking-widest leading-none">المودع</p>
                <span className="text-[10px] font-black text-primary/70">{item.uploader?.arabic_name || item.uploader?.full_name || "عضو العائلة"}</span>
             </div>
          </div>
          <div className="flex items-center gap-2 text-gold-primary">
             <span className="text-[10px] font-black uppercase tracking-widest">{isLocked ? "مغلق" : "عرض"}</span>
             <ChevronLeft size={14} />
          </div>
       </div>

       {isLocked && (
          <div className="absolute inset-0 bg-[#051410]/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center space-y-4 z-20">
             <Lock size={40} className="text-gold-primary animate-bounce" />
             <div className="space-y-1">
                <p className="text-sm font-black text-white">وثيقة موقوتة</p>
                <p className="text-[10px] font-bold text-white/40">تفتح في: {new Date(item.unlock_at!).toLocaleDateString("ar-SA")}</p>
             </div>
          </div>
       )}
    </motion.div>
  );
}
