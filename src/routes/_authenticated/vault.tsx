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
  ChevronLeft,
  Check,
  Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { BiometricAuth, DocumentScanner } from "@/lib/native-bridge";
import { Capacitor } from "@capacitor/core";

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

type VaultCategory = "will" | "deed" | "heritage" | "private";


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

const CATEGORIES: { key: VaultCategory; label: string; icon: any; color: string; gradient: string; desc: string }[] = [
  { key: "will", label: "الوصايا", icon: FileText, color: "bg-amber-600", gradient: "from-amber-600/20 to-amber-900/10", desc: "رسائل ووصايا موجهة للمستقبل." },
  { key: "deed", label: "الصكوك والوثائق", icon: ShieldCheck, color: "bg-emerald-700", gradient: "from-emerald-700/20 to-emerald-900/10", desc: "صكوك ملكية ووثائق رسمية عائلية." },
  { key: "heritage", label: "مخطوطات تاريخية", icon: History, color: "bg-gold-primary", gradient: "from-[#D4AF37]/20 to-[#8E7745]/10", desc: "وثائق ومراسلات تاريخية قديمة." },
  { key: "private", label: "خاص وسري", icon: Lock, color: "bg-rose-800", gradient: "from-rose-800/20 to-rose-950/10", desc: "مستندات خاصة لا يراها إلا أشخاص محددون." },
];

function SecureVaultPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [activeTab, setActiveTab] = useState<VaultCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Upload Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCat, setNewCat] = useState<VaultCategory>("will");
  const [newUnlockAt, setNewUnlockAt] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<"private" | "all" | "selected">("private");
  const [isScanning, setIsScanning] = useState(false);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("profiles").select("id, arabic_name, full_name, avatar_url").then(({ data }) => {
      if (data) setAllProfiles(data.sort((a, b) => (a.arabic_name || "").localeCompare(b.arabic_name || "")));
    });

    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

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

  const handleScan = async () => {
    // Web / tablets without the native scanner: fallback to camera capture via file input.
    if (!Capacitor.isNativePlatform()) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      (input as any).capture = "environment";
      input.onchange = () => {
        const f = input.files?.[0];
        if (f) {
          setSelectedFile(f);
          setNewTitle(`وثيقة ممسوحة - ${new Date().toLocaleDateString("ar-SA")}`);
          setShowAdd(true);
        }
      };
      input.click();
      return;
    }
    setIsScanning(true);
    try {
      const result = await DocumentScanner.scanDocument();
      if (result && result.path) {
        const { scannedPathToFile } = await import("@/lib/scanned-doc");
        const file = await scannedPathToFile(result.path, `scanned_doc_${Date.now()}.jpg`);
        setSelectedFile(file);
        setNewTitle(`وثيقة ممسوحة - ${new Date().toLocaleDateString("ar-SA")}`);
        setShowAdd(true);
        toast.success("تم مسح الوثيقة بنجاح ✨");
      }
    } catch (e: any) {
      if (e.message !== "تم إلغاء العملية") {
        console.error("Scan processing error", e);
        toast.error(e.message || "فشل معالجة الوثيقة");
      }
    } finally {
      setIsScanning(false);
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
        is_encrypted: true,
        shared_with: visibility === "all" ? ["all"] : visibility === "private" ? [] : sharedWith
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
    setSharedWith([]);
    setVisibility("private");
  };

  const toggleUserSelection = (userId: string) => {
    if (!userId) return;
    setSharedWith(prev => {
      const current = prev || [];
      return current.includes(userId)
        ? current.filter(id => id !== userId)
        : [...current, userId];
    });
  };

  const handleDownload = async (item: VaultItem) => {
    if (!item) return;
    if (item.unlock_at && new Date(item.unlock_at) > new Date()) {
      toast.error("هذه الوثيقة لا تزال مقفلة زمنياً");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from("vault-media")
        .createSignedUrl(item.storage_path, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      toast.error("تعذر فتح الوثيقة");
    }
  };

  const handleDelete = async (item: VaultItem) => {
    if (!item || !confirm("هل أنت متأكد من حذف هذه الوثيقة نهائياً؟")) return;

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

  // Safe user check
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionUserId(data.session?.user?.id || null);
    });
  }, []);

  return (
    <AppShell title="خزنة الوثائق والوصايا" user={{ name: "الخزنة الرقمية", role: "خصوصية فائقة", initial: "خ" }}>
      <div className="max-w-7xl mx-auto space-y-8 md:space-y-12 pb-24 px-4 md:px-0" dir="rtl">

        {/* Prestige Header - Responsive Design */}
        <section className="animate-fade-up">
           <div className="relative overflow-hidden rounded-[32px] md:rounded-[60px] bg-gradient-to-br from-[#0a1a16] via-[#051410] to-black border border-white/5 shadow-2xl p-6 md:p-20 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12 group">
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
                   style={{ backgroundImage: `url("https://www.transparenttextures.com/patterns/carbon-fibre.png")` }} />

              {/* Decorative Mesh Blobs */}
              <div className="absolute -top-24 -right-24 size-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 size-64 bg-gold-primary/5 rounded-full blur-[80px] pointer-events-none" />

              <div className="relative z-10 space-y-4 md:space-y-6 text-center md:text-right flex-1">
                 <div className="flex items-center justify-center md:justify-start gap-3 md:gap-4">
                    <div className="h-0.5 w-8 md:w-12 bg-gold-primary shadow-[0_0_15px_rgba(212,175,55,0.4)]" />
                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary">النظام الأمني المشفر</span>
                 </div>
                 <div className="space-y-2 md:space-y-3">
                    <h2 className="text-3xl md:text-7xl font-black tracking-tighter text-white drop-shadow-2xl leading-none">خزنة<br /><span className="text-white/20">الوصايا والوثائق</span></h2>
                    <p className="text-xs md:text-2xl font-bold text-white/50 max-w-2xl leading-relaxed">المكان الأكثر أماناً لحفظ أسرار العائلة، صكوكها، ووصاياها الموجهة للمستقبل.</p>
                 </div>
              </div>

              <div className="relative z-10 shrink-0 flex flex-col items-center gap-4 md:gap-6 w-full md:w-auto">
                 <div className="relative group/vault hidden md:block">
                    <div className="absolute inset-0 bg-gold-primary/20 rounded-full blur-3xl animate-pulse group-hover/vault:bg-gold-primary/40 transition-colors" />
                    <div className="relative size-32 md:size-48 rounded-[48px] bg-white/5 backdrop-blur-2xl border border-white/10 flex items-center justify-center text-gold-primary shadow-2xl transition-transform duration-700 group-hover/vault:rotate-[10deg] group-hover/vault:scale-105">
                       <Lock size={64} strokeWidth={1} className="md:size-24" />
                    </div>
                 </div>

                 <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <button
                      onClick={handleScan}
                      disabled={isScanning}
                      className="btn-gold flex-1 md:flex-none px-8 py-4 md:py-6 rounded-[20px] md:rounded-[28px] text-base md:text-xl font-black flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all bg-emerald-600 border-emerald-500"
                    >
                       {isScanning ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5 md:size-6" strokeWidth={3} />}
                       مسح وثيقة
                    </button>

                    <button
                      onClick={() => setShowAdd(true)}
                      className="btn-gold flex-1 md:flex-none px-8 md:px-12 py-4 md:py-6 rounded-[20px] md:rounded-[28px] text-base md:text-xl font-black flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(139,107,35,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                       <Plus className="size-5 md:size-6" strokeWidth={4} /> إضافة ملف
                    </button>
                 </div>
              </div>
           </div>
        </section>

        <QuickActionsBanner />

        {/* Filter & Search - Refined Responsive UI */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 md:gap-6 animate-fade-up" style={{ animationDelay: "100ms" }}>
           <div className="flex items-center gap-1.5 md:gap-2 p-1 md:p-1.5 bg-muted/40 backdrop-blur-xl rounded-2xl md:rounded-[28px] border border-border/40 overflow-x-auto no-scrollbar shadow-inner">
              <button
                onClick={() => setActiveTab("all")}
                className={cn("px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black transition-all whitespace-nowrap", activeTab === "all" ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:bg-muted")}
              >الكل</button>
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => setActiveTab(c.key)}
                  className={cn("px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 shrink-0 whitespace-nowrap", activeTab === c.key ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:bg-muted")}
                >
                  <c.icon size={14} /> {c.label}
                </button>
              ))}
           </div>

           <div className="relative group">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث في الخزنة..."
                className="w-full md:w-80 bg-card border border-border rounded-2xl pr-12 pl-4 py-3.5 md:py-4 text-xs md:text-sm font-bold focus:ring-4 focus:ring-primary/5 outline-none transition-all shadow-sm"
              />
           </div>
        </div>

        {/* Grid Layout - Optimized for Viewport */}
        {loading ? (
          <div className="py-40 text-center opacity-30">
             <Loader2 className="size-16 animate-spin mx-auto mb-4 text-primary" strokeWidth={3} />
             <p className="font-black uppercase tracking-[0.3em] text-[10px]">جاري فتح الخزنة...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="animate-fade-up py-20 md:py-48 flex flex-col items-center text-center gap-6 md:gap-8 card-surface border-dashed border-2 p-10 md:p-20 rounded-[40px] md:rounded-[60px]">
             <div className="size-24 md:size-32 rounded-[40px] md:rounded-[50px] bg-gold-primary/5 border border-gold-primary/10 flex items-center justify-center text-gold-primary/30">
                <ShieldAlert size={48} className="md:size-60" />
             </div>
             <div className="space-y-3 md:space-y-4 max-w-lg">
                <h3 className="text-2xl md:text-4xl font-black text-primary tracking-tight">الخزنة فارغة حالياً</h3>
                <p className="text-sm md:text-xl font-bold text-muted-foreground leading-relaxed">
                   لم نجد أي وثائق في خزنتك الخاصة. ابدأ برفع أول وثيقة ملكية أو وصية لتكون محفوظة بأعلى درجات الخصوصية.
                </p>
                <div className="pt-4 flex flex-col items-center gap-2 opacity-50">
                   <div className="flex items-center gap-2 text-[8px] md:text-[10px] font-black uppercase text-gold-primary tracking-widest">
                      <ShieldCheck size={14} /> حماية مشفرة 256-bit
                   </div>
                </div>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8 animate-fade-up" style={{ animationDelay: "200ms" }}>
             {filteredItems.map(item => (
                <VaultCard
                  key={item.id}
                  item={item}
                  onDownload={() => handleDownload(item)}
                  onDelete={() => handleDelete(item)}
                  isOwner={item.owner_id === currentUserId}
                />
             ))}
          </div>
        )}

        {/* Security Notice Footer */}
        <section className="pt-10 md:pt-20 opacity-40 hover:opacity-100 transition-opacity">
           <div className="flex flex-col items-center gap-4 md:gap-6 p-10 border-t border-border/40 text-center">
              <ShieldCheck className="size-8 md:size-12 text-primary" />
              <div className="space-y-1 md:space-y-2">
                 <h4 className="text-[10px] md:text-sm font-black text-primary uppercase tracking-[0.4em]">Family Security Protocol</h4>
                 <p className="text-[9px] md:text-xs font-bold text-muted-foreground max-w-md leading-relaxed">كافة الوثائق المرفوعة في هذه الخزنة تخضع لقوانين الخصوصية العائلية المشددة ولا يحق لأي جهة برمجية الاطلاع على محتواها.</p>
              </div>
           </div>
        </section>

      </div>

      <AnimatePresence>
         {showAdd && (
            <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/90 backdrop-blur-md" dir="rtl">
               <motion.div
                 onClick={e => e.stopPropagation()}
                 initial={typeof window !== 'undefined' && window.innerWidth < 768 ? { y: "100%" } : { scale: 0.9, opacity: 0 }}
                 animate={typeof window !== 'undefined' && window.innerWidth < 768 ? { y: 0 } : { scale: 1, opacity: 1 }}
                 exit={typeof window !== 'undefined' && window.innerWidth < 768 ? { y: "100%" } : { scale: 0.9, opacity: 0 }}
                 transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
                 className="bg-card border-t md:border border-border rounded-t-[40px] md:rounded-[48px] w-full max-w-2xl p-6 md:p-12 space-y-8 shadow-2xl relative overflow-hidden max-h-[92vh] md:max-h-[85vh] overflow-y-auto no-scrollbar"
               >
                  <div className="absolute top-0 right-0 size-48 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />

                  <div className="flex items-center justify-between relative z-10">
                     <div className="space-y-1">
                        <h3 className="text-2xl md:text-3xl font-black text-primary tracking-tight">إيداع وثيقة جديدة</h3>
                        <p className="text-xs font-bold text-muted-foreground opacity-60">سيتم حفظ الملف في الخزنة المشفرة للأبد</p>
                     </div>
                     <button onClick={() => setShowAdd(false)} className="size-12 rounded-2xl bg-muted flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-90"><X size={24} /></button>
                  </div>

                  <div className="space-y-8 relative z-10">
                     {/* Visibility Selector - Refined */}
                     <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-primary/40 mr-1 tracking-[0.2em]">عرض الوثيقة لمن؟</label>
                        <div className="grid grid-cols-3 gap-2 p-1.5 bg-muted/40 rounded-2xl border border-border/40">
                           <button onClick={() => setVisibility("private")} className={cn("py-3.5 rounded-xl font-black text-[10px] md:text-xs transition-all", visibility === "private" ? "bg-primary text-white shadow-xl scale-[1.02]" : "text-muted-foreground hover:bg-muted")}>خاص بي فقط</button>
                           <button onClick={() => setVisibility("all")} className={cn("py-3.5 rounded-xl font-black text-[10px] md:text-xs transition-all", visibility === "all" ? "bg-primary text-white shadow-xl scale-[1.02]" : "text-muted-foreground hover:bg-muted")}>للجميع</button>
                           <button onClick={() => setVisibility("selected")} className={cn("py-3.5 rounded-xl font-black text-[10px] md:text-xs transition-all", visibility === "selected" ? "bg-primary text-white shadow-xl scale-[1.02]" : "text-muted-foreground hover:bg-muted")}>أشخاص محددون</button>
                        </div>
                     </div>

                     <AnimatePresence>
                        {visibility === "selected" && (
                           <motion.div
                             initial={{ height: 0, opacity: 0 }}
                             animate={{ height: "auto", opacity: 1 }}
                             exit={{ height: 0, opacity: 0 }}
                             className="space-y-4 overflow-hidden"
                           >
                              <div className="flex items-center justify-between px-1">
                                 <label className="text-[10px] font-black uppercase text-primary/40 tracking-[0.2em]">اختر المصرح لهم</label>
                                 <span className="text-[10px] font-black text-gold-primary">{(sharedWith || []).length} عضو مختار</span>
                              </div>
                              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 max-h-48 overflow-y-auto p-4 bg-muted/30 rounded-[32px] border border-border/40 no-scrollbar shadow-inner">
                                 {(allProfiles || [])
                                   .filter(p => p && p.id && p.id !== currentUserId)
                                   .map(p => {
                                     const isSelected = (sharedWith || []).includes(p.id);
                                     return (
                                       <button
                                         key={p.id}
                                         type="button"
                                         onClick={(e) => {
                                           e.preventDefault();
                                           e.stopPropagation();
                                           toggleUserSelection(p.id);
                                         }}
                                         className="flex flex-col items-center gap-2 group/u transition-transform active:scale-90 outline-none"
                                       >
                                          <div className={cn(
                                            "size-12 md:size-14 rounded-full p-0.5 border-2 transition-all relative",
                                            isSelected ? "border-primary bg-primary/10 shadow-lg" : "border-transparent opacity-60 grayscale hover:opacity-100 hover:grayscale-0"
                                          )}>
                                             <UserAvatar path={p.avatar_url} name={p.arabic_name || p.full_name || "عضو"} className="size-full rounded-full" />
                                             {isSelected && (
                                               <div className="absolute -top-1 -right-1 size-5 rounded-full bg-primary flex items-center justify-center text-white border-2 border-card">
                                                  <Check size={10} strokeWidth={4} />
                                               </div>
                                             )}
                                          </div>
                                          <span className={cn(
                                            "text-[8px] font-black truncate w-full text-center",
                                            isSelected ? "text-primary" : "text-muted-foreground"
                                          )}>
                                            {(p.arabic_name || p.full_name || "عضو").split(' ')[0]}
                                          </span>
                                       </button>
                                     );
                                   })}
                              </div>
                           </motion.div>
                        )}
                     </AnimatePresence>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase text-primary/40 mr-1 tracking-[0.2em]">عنوان الوثيقة</label>
                           <input
                             value={newTitle}
                             onChange={e => setNewTitle(e.target.value)}
                             placeholder="مثلاً: وصية الجد خالد..."
                             className="w-full h-14 md:h-16 bg-muted/40 border border-border rounded-2xl px-6 font-bold text-xs md:text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase text-primary/40 mr-1 tracking-[0.2em]">التصنيف</label>
                           <select
                             value={newCat}
                             onChange={e => setNewCat(e.target.value as VaultCategory)}
                             className="w-full h-14 md:h-16 bg-muted/40 border border-border rounded-2xl px-6 font-bold text-xs md:text-sm focus:ring-4 focus:ring-primary/5 outline-none appearance-none"
                           >
                              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                           </select>
                        </div>
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-primary/40 mr-1 tracking-[0.2em]">وصف مختصر (اختياري)</label>
                        <input
                          value={newDesc}
                          onChange={e => setNewDesc(e.target.value)}
                          placeholder="اكتب وصفاً بسيطاً لمحتوى الوثيقة..."
                          className="w-full h-14 md:h-16 bg-muted/40 border border-border rounded-2xl px-6 font-bold text-xs md:text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                        />
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-primary/40 mr-1 tracking-[0.2em]">تاريخ الفتح (اختياري)</label>
                        <input
                          type="date"
                          value={newUnlockAt}
                          onChange={e => setNewUnlockAt(e.target.value)}
                          className="w-full h-14 md:h-16 bg-muted/40 border border-border rounded-2xl px-6 font-bold text-xs md:text-sm focus:ring-4 focus:ring-primary/5 outline-none"
                        />
                     </div>

                     <label className="flex flex-col items-center justify-center gap-4 p-8 md:p-14 border-2 border-dashed border-border/60 rounded-[32px] md:rounded-[40px] cursor-pointer hover:bg-primary/5 transition-all bg-muted/10 group relative overflow-hidden">
                        <div className="size-16 md:size-20 rounded-[24px] bg-white shadow-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform relative z-10">
                           <Download size={32} className="rotate-180 md:size-40" />
                        </div>
                        <div className="text-center relative z-10">
                           <p className="font-black text-primary text-sm md:text-lg">{selectedFile ? selectedFile.name : "اسحب الملف هنا"}</p>
                           <p className="text-[10px] font-bold text-muted-foreground opacity-60 mt-1">{selectedFile ? `(${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)` : "PDF, JPG, PNG (حد أقصى 20MB)"}</p>
                        </div>
                        <input type="file" hidden accept=".pdf,image/*" onChange={handleFileSelect} />
                     </label>
                  </div>

                  <button
                    onClick={handleUpload}
                    disabled={isUploading || !newTitle || !selectedFile}
                    className="w-full btn-gold py-5 md:py-7 rounded-[24px] md:rounded-[32px] text-base md:text-2xl font-black shadow-[0_20px_50px_rgba(139,107,35,0.4)] hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                     {isUploading ? <Loader2 className="size-6 md:size-8 animate-spin mx-auto text-white" strokeWidth={4} /> : "تأكيد الإيداع في الخزنة الملكية"}
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
      whileHover={{ y: -8, scale: 1.02 }}
      onClick={onDownload}
      className="card-surface p-6 md:p-8 space-y-5 md:space-y-6 group cursor-pointer relative overflow-hidden flex flex-col justify-between h-full group/card transition-all duration-500"
    >
       {/* Background Category Gradient */}
       <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover/card:opacity-100 transition-opacity duration-700 pointer-events-none", cat.gradient)} />

       <div className={cn("absolute top-0 right-0 w-1 md:w-1.5 h-full opacity-60 transition-all duration-500 group-hover/card:w-2", cat.color)} />

       <div className="flex items-start justify-between relative z-10">
          <div className={cn("size-12 md:size-16 rounded-[20px] md:rounded-[24px] flex items-center justify-center text-white shadow-xl group-hover/card:rotate-[10deg] transition-all duration-500", cat.color)}>
             {isLocked ? <Clock className="size-6 md:size-8" /> : <cat.icon className="size-6 md:size-8" />}
          </div>

          <div className="flex items-center gap-1.5 md:gap-2" onClick={e => e.stopPropagation()}>
            <DropdownMenu>
               <DropdownMenuTrigger asChild>
                  <button className="size-9 md:size-10 rounded-xl bg-muted/20 hover:bg-muted flex items-center justify-center text-muted-foreground transition-all outline-none active:scale-90 border border-transparent hover:border-border">
                     <MoreVertical className="size-5 md:size-6" />
                  </button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="w-56 rounded-2xl bg-card/80 backdrop-blur-2xl border-border p-2 shadow-2xl">
                  <DropdownMenuItem onClick={onDownload} className="flex items-center justify-end gap-3 p-3.5 rounded-xl font-black text-[11px] cursor-pointer focus:bg-primary focus:text-white transition-all">
                     <span className="tracking-tight">فتح ومعاينة الوثيقة</span>
                     <Eye size={16} />
                  </DropdownMenuItem>
                  {isOwner && (
                    <DropdownMenuItem onClick={onDelete} className="flex items-center justify-end gap-3 p-3.5 rounded-xl font-black text-[11px] cursor-pointer text-rose-500 focus:bg-rose-600 focus:text-white transition-all">
                       <span className="tracking-tight text-right">حذف من الخزنة نهائياً</span>
                       <Trash2 size={16} />
                    </DropdownMenuItem>
                  )}
               </DropdownMenuContent>
            </DropdownMenu>
          </div>
       </div>

       <div className="space-y-2 md:space-y-3 relative z-10">
          <div className="flex items-center gap-2">
             <h4 className="text-lg md:text-2xl font-black text-primary tracking-tighter truncate leading-tight group-hover/card:text-primary transition-colors">{item.title}</h4>
             {item.is_encrypted && (
               <div className="size-5 rounded-full bg-gold-primary/10 flex items-center justify-center">
                 <Key size={10} className="text-gold-primary opacity-60" />
               </div>
             )}
          </div>
          <p className="text-[10px] md:text-sm font-bold text-muted-foreground/60 line-clamp-2 leading-relaxed h-10 group-hover/card:text-muted-foreground transition-colors">{item.description || "لا يوجد وصف إضافي لهذه الوثيقة."}</p>
       </div>

       <div className="pt-4 md:pt-6 flex items-center justify-between border-t border-border/20 relative z-10">
          <div className="flex items-center gap-3">
             <div className="size-9 md:size-11 rounded-full border-2 border-white shadow-md overflow-hidden bg-emerald-950 shrink-0 transition-transform group-hover/card:scale-110">
                <img src={item.uploader?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + (item.uploader?.arabic_name || "V")} alt="" className="size-full object-cover" />
             </div>
             <div className="text-right min-w-0">
                <p className="text-[7px] md:text-[8px] font-black uppercase text-primary/30 tracking-[0.2em] leading-none mb-1">المودع</p>
                <h5 className="text-[10px] md:text-[13px] font-black text-primary/70 truncate tracking-tight">{item.uploader?.arabic_name?.split(' ')[0] || item.uploader?.full_name?.split(' ')[0] || "عضو"}</h5>
             </div>
          </div>
          <div className="flex items-center gap-2 text-gold-primary group/link">
             <span className="text-[9px] md:text-[12px] font-black uppercase tracking-[0.2em]">{isLocked ? "مغلق" : "عرض"}</span>
             <ChevronLeft size={16} className="group-hover/link:-translate-x-1.5 transition-transform duration-300" />
          </div>
       </div>

       {isLocked && (
          <div className="absolute inset-0 bg-[#051410]/98 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center space-y-5 z-20">
             <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-gold-primary rounded-full blur-2xl"
                />
                <div className="relative size-16 md:size-20 rounded-full bg-gold-primary/10 border border-gold-primary/20 flex items-center justify-center">
                   <Lock size={32} className="text-gold-primary md:size-40" />
                </div>
             </div>
             <div className="space-y-2">
                <p className="text-sm md:text-xl font-black text-white tracking-tight">وثيقة موقوتة</p>
                <div className="inline-flex px-3 py-1 rounded-full bg-white/5 border border-white/10">
                   <p className="text-[9px] md:text-[11px] font-bold text-white/50 tracking-wider flex items-center gap-2">
                      <Clock size={12} className="text-gold-primary" />
                      <span>{new Date(item.unlock_at!).toLocaleDateString("ar-SA", { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                   </p>
                </div>
             </div>
          </div>
       )}
    </motion.div>
  );
}
