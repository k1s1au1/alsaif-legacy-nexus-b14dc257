import React, { useState } from "react";
import {
  Trophy,
  RotateCw,
  Target,
  Plus,
  RefreshCcw,
  Zap,
  Medal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export function GamesHub() {
  const [activeGame, setActiveGame] = useState<"baloot" | "wheel" | "quiz">("baloot");

  const games = [
    { id: "baloot", label: "حاسبة البلوت", icon: Target, color: "text-blue-500" },
    { id: "wheel", label: "عجلة الحظ", icon: RotateCw, color: "text-amber-500" },
    { id: "quiz", label: "المسابقات", icon: Trophy, color: "text-emerald-500" },
  ];

  return (
    <div className="space-y-8 animate-fade-up">
       <div className="flex items-center gap-2 p-1.5 bg-muted/40 rounded-[28px] border border-border/40 overflow-x-auto no-scrollbar w-full md:w-fit mx-auto">
          {games.map((g) => (
            <button
              key={g.id}
              onClick={() => setActiveGame(g.id as any)}
              className={cn(
                "px-8 py-3 rounded-[22px] text-xs font-black transition-all flex items-center gap-2 shrink-0 border-2",
                activeGame === g.id
                  ? "bg-primary text-white border-primary shadow-xl scale-105"
                  : "bg-card text-muted-foreground border-transparent hover:bg-muted"
              )}
            >
               <g.icon size={16} /> <span>{g.label}</span>
            </button>
          ))}
       </div>

       <div className="min-h-[400px]">
          <AnimatePresence mode="wait">
             {activeGame === "baloot" && <BalootCalculator key="baloot" />}
             {activeGame === "wheel" && <SelectionWheel key="wheel" />}
             {activeGame === "quiz" && <FamilyQuiz key="quiz" />}
          </AnimatePresence>
       </div>
    </div>
  );
}

function BalootCalculator() {
  const [us, setUs] = useState(0);
  const [them, setThem] = useState(0);
  const [history, setHistory] = useState<{ us: number; them: number }[]>([]);

  const addScore = (u: number, t: number) => {
    if (us + u >= 152 || them + t >= 152) {
       toast.success(us + u >= 152 ? "مبروك! فزتوا بالصن" : "هاردلك! الخصم فاز بالصن");
    }
    setHistory([{ us: u, them: t }, ...history]);
    setUs(prev => prev + u);
    setThem(prev => prev + t);
  };

  const reset = () => {
    if (confirm("بدء صكّة جديدة؟")) {
      setUs(0); setThem(0); setHistory([]);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
       <div className="grid grid-cols-2 gap-4">
          <div className="card-surface p-8 text-center bg-blue-500/5 border-blue-500/20">
             <p className="text-sm font-black text-blue-600 mb-2 uppercase tracking-widest">لنا</p>
             <span className="text-7xl font-black text-primary tracking-tighter">{us}</span>
          </div>
          <div className="card-surface p-8 text-center bg-rose-500/5 border-rose-500/20">
             <p className="text-sm font-black text-rose-600 mb-2 uppercase tracking-widest">لهم</p>
             <span className="text-7xl font-black text-primary tracking-tighter">{them}</span>
          </div>
       </div>

       <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
             {[4, 8, 12, 16, 24].map(n => (
               <button key={n} type="button" onClick={() => addScore(n, 0)} className="w-full py-3 bg-blue-500 text-white rounded-xl font-black text-sm hover:brightness-110 active:scale-95 transition-all">+{n}</button>
             ))}
          </div>
          <div className="space-y-2">
             {[4, 8, 12, 16, 24].map(n => (
               <button key={n} type="button" onClick={() => addScore(0, n)} className="w-full py-3 bg-rose-500 text-white rounded-xl font-black text-sm hover:brightness-110 active:scale-95 transition-all">+{n}</button>
             ))}
          </div>
       </div>

       <button type="button" onClick={reset} className="w-full py-4 bg-muted text-muted-foreground rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-muted/80 transition-all flex items-center justify-center gap-2">
          <RefreshCcw size={14} /> إعادة ضبط الصكة
       </button>

       {history.length > 0 && (
         <div className="card-surface p-6 space-y-4">
            <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">سجل القيد</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
               {history.map((h, i) => (
                 <div key={i} className="flex justify-between items-center text-sm font-bold p-2 bg-muted/20 rounded-lg">
                    <span className="text-blue-600">+{h.us}</span>
                    <span className="text-muted-foreground/30">———</span>
                    <span className="text-rose-600">+{h.them}</span>
                 </div>
               ))}
            </div>
         </div>
       )}
    </motion.div>
  );
}

function SelectionWheel() {
  const [names, setNames] = useState<string[]>(["فهد", "محمد", "عبدالعزيز", "نورة", "سارة"]);
  const [newName, setNewName] = useState("");
  const [winner, setWinner] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  const addName = () => {
    if (newName.trim()) {
      setNames([...names, newName.trim()]);
      setNewName("");
    }
  };

  const spin = () => {
    if (names.length < 2) return;
    setSpinning(true);
    setWinner(null);
    setTimeout(() => {
      const idx = Math.floor(Math.random() * names.length);
      setWinner(names[idx]);
      setSpinning(false);
    }, 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xl mx-auto space-y-8">
       <div className="card-surface p-8 text-center space-y-6 overflow-hidden relative">
          <div className={cn("size-48 md:size-64 rounded-full border-8 border-gold-primary/20 mx-auto flex items-center justify-center relative", spinning && "animate-spin")}>
             <RotateCw className="size-16 md:size-24 text-gold-primary opacity-20" />
             <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 size-4 bg-primary rotate-45" />
          </div>

          <AnimatePresence>
            {winner && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute inset-0 bg-primary/95 flex flex-col items-center justify-center p-8 z-20 text-white rounded-[32px]">
                 <Zap className="size-12 text-gold-primary mb-4 animate-bounce" />
                 <p className="text-sm font-black uppercase tracking-widest opacity-60">وقع الاختيار على</p>
                 <h3 className="text-5xl font-black tracking-tighter mt-2">{winner}</h3>
                 <button type="button" onClick={() => setWinner(null)} className="mt-8 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-full font-black text-xs transition-all">إغلاق</button>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            disabled={spinning || names.length < 2}
            onClick={spin}
            className="btn-gold w-full py-5 rounded-2xl font-black text-lg shadow-2xl disabled:opacity-50"
          >
            {spinning ? "جاري الاختيار..." : "تدوير العجلة"}
          </button>
       </div>

       <div className="space-y-4">
          <div className="flex gap-2">
             <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="أضف اسم..." className="flex-1 bg-muted/40 border border-border rounded-xl px-4 font-bold text-sm" />
             <button type="button" onClick={addName} className="btn-gold size-12 rounded-xl flex items-center justify-center"><Plus /></button>
          </div>
          <div className="flex flex-wrap gap-2">
             {names.map((n, i) => (
               <span key={i} className="px-4 py-2 bg-primary/5 text-primary rounded-full text-xs font-black border border-primary/10 flex items-center gap-2">
                 {n} <button type="button" onClick={() => setNames(names.filter((_, idx) => idx !== i))} className="text-rose-500 hover:text-rose-700">×</button>
               </span>
             ))}
          </div>
       </div>
    </motion.div>
  );
}

function FamilyQuiz() {
  return (
    <div className="max-w-xl mx-auto p-12 text-center bg-muted/20 rounded-[48px] border-4 border-dashed border-border/60">
       <Medal size={64} className="mx-auto text-gold-primary opacity-20 mb-6" />
       <h3 className="text-2xl font-black text-primary mb-2">قريباً: تحدي السيف</h3>
       <p className="text-sm font-bold text-muted-foreground opacity-60 leading-relaxed">نقوم حالياً بتجهيز بنك الأسئلة الخاص بتاريخ العائلة والألغاز. انتظرونا في التحديث القادم!</p>
    </div>
  );
}
