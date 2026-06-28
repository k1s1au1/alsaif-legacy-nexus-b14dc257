import React, { useState, useEffect, useRef } from "react";
import {
  Trophy,
  RotateCw,
  Target,
  Plus,
  RefreshCcw,
  Zap,
  Medal,
  Timer,
  Users,
  Gavel,
  CheckCircle2,
  XCircle,
  SkipForward,
  FastForward,
  HelpCircle,
  Lightbulb,
  UserCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { TRIVIA_QUESTIONS } from "@/data/trivia-questions";

import { WordDuel } from "./word-duel";

export function GamesHub() {
  const [activeGame, setActiveGame] = useState<"baloot" | "wheel" | "challenge30" | "auction" | "judge" | "trivia" | "word-duel">("baloot");

  const games = [
    { id: "word-duel", label: "سجال الحروف", icon: Zap },
    { id: "baloot", label: "البلوت", icon: Target },
    { id: "wheel", label: "القرعة", icon: RotateCw },
    { id: "challenge30", label: "الـ 30 ثانية", icon: Timer },
    { id: "auction", label: "مزاد المعلومات", icon: Gavel },
    { id: "judge", label: "قاضي الجماعة", icon: UserCheck },
    { id: "trivia", label: "بنك الأسئلة", icon: HelpCircle },
  ];

  return (
    <div className="space-y-8 animate-fade-up">
       <div className="flex items-center gap-2 p-2 bg-muted/40 rounded-[32px] border border-border/40 overflow-x-auto no-scrollbar w-full max-w-4xl mx-auto">
          {games.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setActiveGame(g.id as any)}
              className={cn(
                "px-6 py-3 rounded-[24px] text-xs font-black transition-all flex items-center gap-2 shrink-0 border-2 whitespace-nowrap",
                activeGame === g.id
                  ? "bg-primary text-white border-primary shadow-xl scale-105"
                  : "bg-card text-muted-foreground border-transparent hover:bg-muted"
              )}
            >
               <g.icon size={16} /> <span>{g.label}</span>
            </button>
          ))}
       </div>

       <div className="min-h-[500px]">
          <AnimatePresence mode="wait">
             {activeGame === "word-duel" && <WordDuel key="word-duel" onClose={() => setActiveGame("baloot")} />}
             {activeGame === "baloot" && <BalootCalculator key="baloot" />}
             {activeGame === "wheel" && <SelectionWheel key="wheel" />}
             {activeGame === "challenge30" && <Challenge30s key="challenge30" />}
             {activeGame === "auction" && <AuctionGame key="auction" />}
             {activeGame === "judge" && <ScenarioJudge key="judge" />}
             {activeGame === "trivia" && <GeneralTrivia key="trivia" />}
          </AnimatePresence>
       </div>
    </div>
  );
}

// 1. Baloot Calculator (Enhanced with Persistence)
function BalootCalculator() {
  const [us, setUs] = useState(0);
  const [them, setThem] = useState(0);
  const [history, setHistory] = useState<{ us: number; them: number }[]>([]);

  // Idea 2: Persistence
  useEffect(() => {
    const saved = localStorage.getItem("alsaif_baloot_state");
    if (saved) {
      try {
        const { us: sUs, them: sThem, history: sHist } = JSON.parse(saved);
        setUs(sUs || 0);
        setThem(sThem || 0);
        setHistory(sHist || []);
      } catch (e) { console.error("Baloot load error", e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("alsaif_baloot_state", JSON.stringify({ us, them, history }));
  }, [us, them, history]);

  const addScore = (u: number, t: number) => {
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
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6 px-4">
       <div className="grid grid-cols-2 gap-4">
          <div className="card-surface p-8 text-center bg-blue-500/5 border-blue-500/20 rounded-[40px]">
             <p className="text-sm font-black text-blue-600 mb-2 uppercase tracking-widest">لنا</p>
             <span className="text-8xl font-black text-primary tracking-tighter">{us}</span>
          </div>
          <div className="card-surface p-8 text-center bg-rose-500/5 border-rose-500/20 rounded-[40px]">
             <p className="text-sm font-black text-rose-600 mb-2 uppercase tracking-widest">لهم</p>
             <span className="text-8xl font-black text-primary tracking-tighter">{them}</span>
          </div>
       </div>

       <div className="grid grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-2">
             {[4, 8, 12, 16, 24].map(n => (
               <button key={n} type="button" onClick={() => addScore(n, 0)} className="py-4 bg-blue-500 text-white rounded-2xl font-black text-lg hover:brightness-110 active:scale-95 transition-all">+{n}</button>
             ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
             {[4, 8, 12, 16, 24].map(n => (
               <button key={n} type="button" onClick={() => addScore(0, n)} className="py-4 bg-rose-500 text-white rounded-2xl font-black text-lg hover:brightness-110 active:scale-95 transition-all">+{n}</button>
             ))}
          </div>
       </div>

       <button type="button" onClick={reset} className="w-full py-5 bg-muted text-muted-foreground rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-muted/80 transition-all flex items-center justify-center gap-2">
          <RefreshCcw size={16} /> إعادة ضبط الصكة
       </button>
    </motion.div>
  );
}

// 2. Selection Wheel
function SelectionWheel() {
  const [names, setNames] = useState<string[]>(["أحمد", "فهد", "محمد", "عبدالله", "سلطان"]);
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
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xl mx-auto space-y-8 px-4">
       <div className="card-surface p-12 text-center space-y-8 overflow-hidden relative rounded-[48px]">
          <div className={cn("size-56 md:size-72 rounded-full border-[12px] border-gold-primary/10 mx-auto flex items-center justify-center relative", spinning && "animate-spin")}>
             <RotateCw className="size-20 md:size-28 text-gold-primary opacity-20" />
             <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 size-6 bg-primary rotate-45 border-4 border-white shadow-xl" />
          </div>

          <AnimatePresence>
            {winner && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute inset-0 bg-primary/95 flex flex-col items-center justify-center p-8 z-20 text-white rounded-[48px]">
                 <Zap className="size-16 text-gold-primary mb-6 animate-bounce" />
                 <p className="text-base font-black uppercase tracking-[0.2em] opacity-60">وقع الاختيار على</p>
                 <h3 className="text-6xl font-black tracking-tighter mt-4">{winner}</h3>
                 <button type="button" onClick={() => setWinner(null)} className="mt-12 px-12 py-4 bg-white/10 hover:bg-white/20 rounded-full font-black text-sm transition-all border border-white/10">استمرار</button>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            disabled={spinning || names.length < 2}
            onClick={spin}
            className="btn-gold w-full py-6 rounded-[24px] font-black text-xl shadow-2xl disabled:opacity-50 transition-all hover:scale-[1.02]"
          >
            {spinning ? "جاري تدوير القرعة..." : "تدوير العجلة"}
          </button>
       </div>

       <div className="space-y-4">
          <div className="flex gap-2">
             <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addName()} placeholder="أضف اسم الحاضر..." className="flex-1 h-14 bg-muted/40 border border-border rounded-2xl px-6 font-black text-base focus:ring-4 focus:ring-primary/5 transition-all outline-none" />
             <button type="button" onClick={addName} className="btn-gold size-14 rounded-2xl flex items-center justify-center shadow-xl"><Plus strokeWidth={3} /></button>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
             {names.map((n, i) => (
               <span key={i} className="px-5 py-2.5 bg-primary/5 text-primary rounded-full text-sm font-black border border-primary/10 flex items-center gap-3">
                 {n} <button type="button" onClick={() => setNames(names.filter((_, idx) => idx !== i))} className="text-rose-500 hover:text-rose-700 transition-colors">×</button>
               </span>
             ))}
          </div>
       </div>
    </motion.div>
  );
}

// 3. Challenge 30 Seconds
const THIRTY_WORDS = ["برج إيفل", "جوال", "قهوة سعودية", "طيارة", "بحر", "مستشفى", "سيارة سباق", "شاحن", "مظلة", "ساعة يد", "كتاب", "تلفزيون", "كرة قدم", "بريد إلكتروني", "قمر", "شمس", "جبل", "مطعم", "فندق", "مطار"];

function Challenge30s() {
  const [word, setWord] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState({ a: 0, b: 0 });
  const [currentTeam, setCurrentTeam] = useState<"a" | "b">("a");
  const timerRef = useRef<any>(null);

  const nextWord = () => {
    const random = THIRTY_WORDS[Math.floor(Math.random() * THIRTY_WORDS.length)];
    setWord(random);
  };

  const startGame = () => {
    setIsPlaying(true);
    setTimeLeft(30);
    nextWord();
    timerRef.current = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) {
          clearInterval(timerRef.current);
          setIsPlaying(false);
          toast.error("انتهى الوقت!");
          return 0;
        }
        return p - 1;
      });
    }, 1000);
  };

  const handleCorrect = () => {
    setScore(s => ({ ...s, [currentTeam]: s[currentTeam] + 1 }));
    nextWord();
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-8 px-4 text-center">
       <div className="grid grid-cols-2 gap-4">
          <div className={cn("p-6 rounded-[32px] border-2 transition-all", currentTeam === 'a' ? "bg-blue-500 text-white border-blue-600 scale-105" : "bg-muted/40 border-transparent opacity-50")}>
             <p className="text-[10px] font-black uppercase tracking-widest mb-1">فريق أ</p>
             <span className="text-4xl font-black">{score.a}</span>
          </div>
          <div className={cn("p-6 rounded-[32px] border-2 transition-all", currentTeam === 'b' ? "bg-rose-500 text-white border-rose-600 scale-105" : "bg-muted/40 border-transparent opacity-50")}>
             <p className="text-[10px] font-black uppercase tracking-widest mb-1">فريق ب</p>
             <span className="text-4xl font-black">{score.b}</span>
          </div>
       </div>

       <div className="card-surface p-12 md:p-20 rounded-[48px] space-y-10 relative overflow-hidden">
          <div className="absolute top-6 left-1/2 -translate-x-1/2">
             <div className={cn("size-20 rounded-full border-4 flex items-center justify-center text-2xl font-black transition-colors", timeLeft < 10 ? "border-rose-500 text-rose-500 animate-pulse" : "border-primary text-primary")}>
                {timeLeft}
             </div>
          </div>

          {!isPlaying ? (
            <div className="pt-10 space-y-6">
               <h3 className="text-2xl font-black text-primary">جاهزين للتحدي؟</h3>
               <p className="text-sm font-bold text-muted-foreground max-w-xs mx-auto">اشرح الكلمة لفريقك بدون ذكر حروفها! لديك 30 ثانية لكل جولة.</p>
               <div className="flex flex-col gap-3">
                  <button type="button" onClick={() => setCurrentTeam(currentTeam === 'a' ? 'b' : 'a')} className="text-[10px] font-black text-primary uppercase tracking-widest">تبديل الدور للفريق الآخر</button>
                  <button type="button" onClick={startGame} className="btn-gold py-6 rounded-3xl font-black text-xl shadow-2xl">بدء الجولة</button>
               </div>
            </div>
          ) : (
            <div className="pt-10 space-y-12">
               <motion.h2 key={word} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-5xl md:text-7xl font-black text-primary tracking-tighter">{word}</motion.h2>
               <div className="flex gap-4">
                  <button type="button" onClick={nextWord} className="flex-1 py-5 bg-muted text-muted-foreground rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-muted/80"><SkipForward size={18} /> تخطي</button>
                  <button type="button" onClick={handleCorrect} className="flex-[2] py-5 bg-emerald-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 hover:bg-emerald-600"><CheckCircle2 size={18} /> صح! (+1)</button>
               </div>
            </div>
          )}
       </div>
    </motion.div>
  );
}

// 4. Information Auction
const AUCTION_CATEGORIES = ["ماركات سيارات", "عواصم دول", "أندية كرة قدم عالمية", "أنواع فواكه", "تطبيقات جوال", "ماركات ساعات", "أسماء مطاعم مشهورة", "ألوان", "لغات برمجة", "حيوانات بحرية"];

function AuctionGame() {
  const [category, setCategory] = useState("");
  const [isBidding, setIsBidding] = useState(false);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<any>(null);

  const nextCategory = () => {
    const random = AUCTION_CATEGORIES[Math.floor(Math.random() * AUCTION_CATEGORIES.length)];
    setCategory(random);
    setIsBidding(false);
    clearInterval(timerRef.current);
    setTimer(0);
  };

  const startAuction = () => {
    setIsBidding(true);
    setTimer(60);
    timerRef.current = setInterval(() => {
      setTimer(p => {
        if (p <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return p - 1;
      });
    }, 1000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-8 px-4 text-center">
       <div className="card-surface p-12 md:p-20 rounded-[48px] space-y-10 relative overflow-hidden bg-gradient-to-br from-amber-500/5 to-transparent border-amber-500/10">
          <div className="flex items-center justify-center gap-3 text-amber-500">
             <Gavel className="size-10" />
             <h3 className="text-xl font-black uppercase tracking-[0.2em]">مزاد المعلومات</h3>
          </div>

          {!category ? (
            <button type="button" onClick={nextCategory} className="btn-gold py-6 px-12 rounded-3xl font-black text-xl shadow-2xl">سحب تصنيف المزاد</button>
          ) : (
            <div className="space-y-12">
               <div className="space-y-4">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">المطلوب ذكر أكبر عدد من</p>
                  <h2 className="text-5xl md:text-7xl font-black text-primary tracking-tighter">{category}</h2>
               </div>

               {!isBidding ? (
                 <div className="space-y-6">
                    <p className="text-sm font-bold text-muted-foreground max-w-xs mx-auto">ابدأ المزايدة! من يقول يستطيع ذكر عدد أكثر؟ الفريق الذي يفوز بالمزاد يبدأ العد.</p>
                    <button type="button" onClick={startAuction} className="btn-gold py-6 w-full rounded-3xl font-black text-xl shadow-2xl">بدء وقت المزاد (60ث)</button>
                 </div>
               ) : (
                 <div className="space-y-8">
                    <div className="size-28 rounded-full border-8 border-amber-500 mx-auto flex items-center justify-center text-4xl font-black text-amber-600 animate-pulse">
                       {timer}
                    </div>
                    <button type="button" onClick={nextCategory} className="text-sm font-black text-muted-foreground hover:text-primary transition-colors">جولة جديدة</button>
                 </div>
               )}
            </div>
          )}
       </div>
    </motion.div>
  );
}

// 5. Scenario Judge
const SCENARIOS = [
  "لو تعطلت السيارة في البر، من أول واحد سيهرب؟",
  "من هو الشخص الذي سيصبح مليارديراً ثم يفلس في أسبوع؟",
  "من هو الشخص الذي لا يمكنه العيش بدون جوال لمدة ساعة؟",
  "لو كنا في جزيرة مهجورة، من الذي سيحاول اصطياد سمكة بيده؟",
  "من هو الشخص الذي يضحك في المواقف الجدية دائماً؟",
  "من هو الشخص الذي يطلب أكل ثم يقول 'شبعت' من أول لقمة؟",
  "لو صار فيه حفل أوسكار للعائلة، من سيفوز بجائزة 'أكثر واحد ينام'؟"
];

function ScenarioJudge() {
  const [scenario, setScenario] = useState("");

  const nextScenario = () => {
    const random = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    setScenario(random);
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto space-y-8 px-4 text-center">
       <div className="card-surface p-12 md:p-20 rounded-[48px] space-y-12 relative overflow-hidden bg-primary/5">
          <div className="flex flex-col items-center gap-4">
             <div className="size-20 rounded-[28px] bg-primary flex items-center justify-center text-white shadow-2xl shadow-primary/20">
                <Users size={40} />
             </div>
             <h3 className="text-xl font-black text-primary uppercase tracking-widest">قاضي الجماعة</h3>
          </div>

          <div className="min-h-[120px] flex items-center justify-center">
             <AnimatePresence mode="wait">
                {scenario ? (
                  <motion.h2 key={scenario} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-2xl md:text-4xl font-black text-primary leading-tight">{scenario}</motion.h2>
                ) : (
                  <p className="text-base font-bold text-muted-foreground opacity-60">اضغط لفتح محاكمة جديدة!</p>
                )}
             </AnimatePresence>
          </div>

          <div className="space-y-6">
             <button type="button" onClick={nextScenario} className="btn-gold py-6 px-12 rounded-3xl font-black text-xl shadow-2xl w-full">اطرح الموقف التالي</button>
             <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">صوتوا جميعاً في نفس اللحظة على الشخص المعني!</p>
          </div>
       </div>
    </motion.div>
  );
}

// 6. General Trivia (Team Mode Supported)
function GeneralTrivia() {
  const [mode, setMode] = useState<"setup" | "playing" | "results">("setup");
  const [isTeamMode, setIsTeamMode] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0); // For single player
  const [teamScores, setTeamScores] = useState({ a: 0, b: 0 });
  const [activeTeam, setActiveTeam] = useState<"a" | "b">("a");
  const [gameQuestions, setGameQuestions] = useState<any[]>([]);

  const startNewGame = (teamMode: boolean) => {
    // Shuffle and pick 15 random questions for a session
    const shuffled = [...TRIVIA_QUESTIONS].sort(() => 0.5 - Math.random());
    setGameQuestions(shuffled.slice(0, 15));
    setIsTeamMode(teamMode);
    setCurrentIdx(0);
    setScore(0);
    setTeamScores({ a: 0, b: 0 });
    setActiveTeam("a");
    setSelected(null);
    setShowResult(false);
    setMode("playing");
  };

  const handleAnswer = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);

    const isCorrect = idx === gameQuestions[currentIdx].correct;

    if (isCorrect) {
      if (isTeamMode) {
        setTeamScores(s => ({ ...s, [activeTeam]: s[activeTeam] + 1 }));
      } else {
        setScore(s => s + 1);
      }
      toast.success("إجابة صحيحة!");
    } else {
      toast.error("للأسف إجابة خاطئة");
    }
    setTimeout(() => setShowResult(true), 500);
  };

  const nextQuestion = () => {
    if (currentIdx < gameQuestions.length - 1) {
      setCurrentIdx(p => p + 1);
      setSelected(null);
      setShowResult(false);
      if (isTeamMode) setActiveTeam(activeTeam === "a" ? "b" : "a");
    } else {
      setMode("results");
    }
  };

  if (mode === "setup") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto p-12 card-surface rounded-[48px] text-center space-y-10">
         <div className="size-24 rounded-[32px] bg-primary/10 flex items-center justify-center mx-auto text-primary">
            <HelpCircle size={48} />
         </div>
         <div className="space-y-4">
            <h3 className="text-3xl font-black text-primary">بنك المعلومات (200 سؤال)</h3>
            <p className="text-sm font-bold text-muted-foreground">تحدى معلوماتك العامة أو نافس فريقاً آخر في 15 سؤالاً عشوائياً.</p>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button type="button" onClick={() => startNewGame(false)} className="py-6 rounded-3xl bg-muted/50 font-black text-primary hover:bg-primary hover:text-white transition-all">لعب فردي</button>
            <button type="button" onClick={() => startNewGame(true)} className="btn-gold py-6 rounded-3xl font-black text-xl shadow-2xl">لعب جماعي (فرق)</button>
         </div>
      </motion.div>
    );
  }

  if (mode === "results") {
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-2xl mx-auto p-12 card-surface rounded-[48px] text-center space-y-8">
         <Trophy size={80} className="mx-auto text-gold-primary animate-bounce" />
         <h3 className="text-4xl font-black text-primary">انتهت المسابقة!</h3>

         {isTeamMode ? (
           <div className="grid grid-cols-2 gap-8 py-8">
              <div className={cn("p-6 rounded-3xl", teamScores.a >= teamScores.b ? "bg-emerald-500/10 border-2 border-emerald-500" : "bg-muted/20")}>
                 <p className="font-black text-primary">فريق أ</p>
                 <span className="text-5xl font-black text-primary">{teamScores.a}</span>
              </div>
              <div className={cn("p-6 rounded-3xl", teamScores.b >= teamScores.a ? "bg-emerald-500/10 border-2 border-emerald-500" : "bg-muted/20")}>
                 <p className="font-black text-primary">فريق ب</p>
                 <span className="text-5xl font-black text-primary">{teamScores.b}</span>
              </div>
           </div>
         ) : (
           <div className="py-8">
              <p className="text-lg font-bold text-muted-foreground">مجموع نقاطك</p>
              <span className="text-8xl font-black text-primary">{score}</span>
              <p className="text-sm font-black text-primary/40 mt-2">من أصل 15 سؤال</p>
           </div>
         )}

         <button type="button" onClick={() => setMode("setup")} className="btn-gold w-full py-6 rounded-3xl font-black text-xl">العودة للرئيسية</button>
      </motion.div>
    );
  }

  const q = gameQuestions[currentIdx];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-8 px-4 text-center">
       {isTeamMode && (
         <div className="flex items-center justify-center gap-4">
            <div className={cn("px-8 py-3 rounded-full font-black transition-all", activeTeam === 'a' ? "bg-blue-500 text-white scale-110 shadow-lg" : "bg-muted/40 opacity-40")}>فريق أ ({teamScores.a})</div>
            <div className="text-xl font-black text-primary/20">VS</div>
            <div className={cn("px-8 py-3 rounded-full font-black transition-all", activeTeam === 'b' ? "bg-rose-500 text-white scale-110 shadow-lg" : "bg-muted/40 opacity-40")}>فريق ب ({teamScores.b})</div>
         </div>
       )}

       <div className="card-surface p-12 md:p-16 rounded-[48px] space-y-10 relative overflow-hidden">
          <div className="flex justify-between items-center px-4">
             <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">سؤال {currentIdx + 1} من {gameQuestions.length}</span>
             {!isTeamMode && <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">النقاط: {score}</span>}
          </div>

          <h2 className="text-3xl md:text-5xl font-black text-primary leading-tight tracking-tight">{q.q}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {q.options.map((opt: string, i: number) => (
               <button
                 key={i}
                 type="button"
                 onClick={() => handleAnswer(i)}
                 className={cn(
                   "py-6 px-8 rounded-[28px] font-black text-lg transition-all border-2",
                   selected === i
                     ? (i === q.correct ? "bg-emerald-500 border-emerald-600 text-white shadow-xl" : "bg-rose-500 border-rose-600 text-white shadow-xl")
                     : (showResult && i === q.correct ? "bg-emerald-500 border-emerald-600 text-white shadow-xl" : "bg-card border-border/60 text-primary hover:border-primary hover:scale-[1.02]")
                 )}
               >
                  {opt}
               </button>
             ))}
          </div>

          {showResult && (
            <button type="button" onClick={nextQuestion} className="btn-gold py-6 w-full rounded-3xl font-black text-xl shadow-2xl flex items-center justify-center gap-3 animate-fade-up">
              {currentIdx === gameQuestions.length - 1 ? "مشاهدة النتائج النهائية" : "السؤال التالي"}
              <FastForward size={24} />
            </button>
          )}
       </div>
    </motion.div>
  );
}

function EmptyHub({ icon: Icon, message }: any) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4 text-white/20 w-full">
       <div className="size-16 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
          <Icon className="size-8" />
       </div>
       <p className="text-sm font-black uppercase tracking-widest">{message}</p>
    </div>
  );
}
