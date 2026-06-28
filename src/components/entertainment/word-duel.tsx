import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Clock,
  RotateCcw,
  User,
  Plus,
  Star,
  AlertCircle,
  CheckCircle2,
  ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Sample seed words for Arabic 3-letter words
const ARABIC_LETTERS = "أبتثجحخدذرزسشصضطظعغفقكلمنهوي";

interface Player {
  id: number;
  name: string;
  hand: string[];
  isWinner: boolean;
}

export function WordDuel({ onClose }: { onClose: () => void }) {
  const [gameState, setGameState] = useState<"setup" | "playing" | "gameover">("setup");
  const [players, setPlayers] = useState<Player[]>([
    { id: 1, name: "اللاعب 1", hand: [], isWinner: false },
    { id: 2, name: "اللاعب 2", hand: [], isWinner: false }
  ]);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [currentWord, setCurrentWord] = useState("أسد");
  const [timeLeft, setTimeLeft] = useState(10);
  const [userInput, setUserInput] = useState("");
  const [deck, setDeck] = useState<string[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Game
  const startGame = () => {
    const allLetters = ARABIC_LETTERS.split("");
    const newPlayers = players.map(p => ({
      ...p,
      hand: Array.from({ length: 9 }, () => allLetters[Math.floor(Math.random() * allLetters.length)]).concat(["⭐"]), // 9 letters + 1 Joker
      isWinner: false
    }));

    setPlayers(newPlayers);
    setCurrentWord("أسد");
    setGameState("playing");
    setTimeLeft(10);
    setCurrentPlayerIdx(0);
  };

  // Timer Logic
  useEffect(() => {
    if (gameState === "playing") {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimeout();
            return 10;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState, currentPlayerIdx]);

  const handleTimeout = () => {
    toast.error(`انتهى الوقت لـ ${players[currentPlayerIdx].name}! تم سحب حرف عقوبة.`);
    const newPlayers = [...players];
    const newLetter = ARABIC_LETTERS[Math.floor(Math.random() * ARABIC_LETTERS.length)];
    newPlayers[currentPlayerIdx].hand.push(newLetter);
    setPlayers(newPlayers);
    nextTurn();
  };

  const nextTurn = () => {
    setCurrentPlayerIdx((prev) => (prev + 1) % players.length);
    setTimeLeft(10);
    setUserInput("");
  };

  const validateMove = (input: string) => {
    if (input.length !== 3) return "يجب أن تتكون الكلمة من 3 حروف فقط";

    let differences = 0;
    for (let i = 0; i < 3; i++) {
      if (input[i] !== currentWord[i]) differences++;
    }

    if (differences !== 1) return "يجب تغيير حرف واحد فقط من الكلمة الموجودة";

    // Check if player has the required letter or Joker
    const neededLetter = "";
    let hasLetter = false;
    let letterToUse = "";

    for (let i = 0; i < 3; i++) {
      if (input[i] !== currentWord[i]) letterToUse = input[i];
    }

    const playerHand = [...players[currentPlayerIdx].hand];
    const letterIdx = playerHand.indexOf(letterToUse);
    const jokerIdx = playerHand.indexOf("⭐");

    if (letterIdx !== -1) {
      playerHand.splice(letterIdx, 1);
      hasLetter = true;
    } else if (jokerIdx !== -1) {
      playerHand.splice(jokerIdx, 1);
      hasLetter = true;
      toast.info("تم استخدام الجوكر! 🌟");
    }

    if (!hasLetter) return `أنت لا تملك حرف (${letterToUse}) في يدك`;

    return { valid: true, newHand: playerHand };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateMove(userInput);

    if (typeof result === "string") {
      toast.error(result);
      return;
    }

    // Success
    const newPlayers = [...players];
    newPlayers[currentPlayerIdx].hand = result.newHand;

    if (newPlayers[currentPlayerIdx].hand.length === 0) {
      newPlayers[currentPlayerIdx].isWinner = true;
      setPlayers(newPlayers);
      setGameState("gameover");
      return;
    }

    setPlayers(newPlayers);
    setCurrentWord(userInput);
    nextTurn();
    toast.success("كلمة صحيحة! أحسنت");
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 md:p-10 text-white overflow-y-auto" dir="rtl">
      <div className="w-full max-w-4xl min-h-[80vh] flex flex-col items-center justify-between gap-10">

        {/* Header */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="size-12 rounded-2xl bg-gold-primary/20 flex items-center justify-center text-gold-primary border border-gold-primary/30 shadow-2xl">
                <RotateCcw className="size-6 cursor-pointer hover:rotate-180 transition-transform duration-500" onClick={() => window.location.reload()} />
             </div>
             <h2 className="text-2xl md:text-4xl font-black tracking-tighter">سجال <span className="text-gold-primary">الحروف</span></h2>
          </div>
          <button onClick={onClose} className="size-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500 transition-all"><X size={24} /></button>
        </div>

        {gameState === "setup" && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-8 text-center">
             <div className="size-32 rounded-[40px] bg-gradient-to-br from-gold-primary to-amber-700 flex items-center justify-center shadow-[0_0_50px_rgba(212,175,55,0.3)]">
                <Star className="size-16 text-white animate-pulse" />
             </div>
             <div className="space-y-2">
                <h3 className="text-3xl font-black">جاهز للتحدي؟</h3>
                <p className="text-white/60 font-bold max-w-md">غير حرفاً واحداً، كون كلمة صحيحة، وتخلص من حروفك قبل الجميع. لديك 10 ثوانٍ فقط!</p>
             </div>
             <div className="flex flex-col gap-3 w-full max-w-xs">
                <button onClick={startGame} className="btn-gold py-5 rounded-[24px] font-black text-xl shadow-2xl">ابدأ السجال الآن</button>
                <div className="flex items-center justify-center gap-4 py-4 border-t border-white/10 mt-4">
                   <p className="text-xs font-black opacity-40 uppercase tracking-widest">عدد اللاعبين</p>
                   <div className="flex gap-2">
                      {[2, 3, 4].map(n => (
                        <button key={n} onClick={() => setPlayers(Array.from({ length: n }, (_, i) => ({ id: i+1, name: `اللاعب ${i+1}`, hand: [], isWinner: false })))}
                          className={cn("size-10 rounded-xl font-black transition-all", players.length === n ? "bg-gold-primary text-black" : "bg-white/5 border border-white/10 opacity-40")}>{n}</button>
                      ))}
                   </div>
                </div>
             </div>
          </motion.div>
        )}

        {gameState === "playing" && (
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-10 flex-1">

             {/* Left Column: Player Status */}
             <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 mr-2">ترتيب المتنافسين</h4>
                {players.map((p, i) => (
                  <div key={p.id} className={cn(
                    "p-5 rounded-[28px] border transition-all flex items-center justify-between",
                    currentPlayerIdx === i ? "bg-gold-primary text-black border-gold-primary shadow-2xl scale-105" : "bg-white/5 border-white/5 opacity-50"
                  )}>
                     <div className="flex items-center gap-3">
                        <div className={cn("size-10 rounded-xl flex items-center justify-center font-black", currentPlayerIdx === i ? "bg-black/20" : "bg-white/10")}>{p.id}</div>
                        <span className="font-black text-sm">{p.name}</span>
                     </div>
                     <span className="font-black text-xs">{p.hand.length} حرف</span>
                  </div>
                ))}
             </div>

             {/* Center Column: The Arena */}
             <div className="flex flex-col items-center justify-center gap-12 py-10 md:py-0">
                <div className="relative">
                   <div className={cn(
                     "size-32 md:size-48 rounded-full border-[8px] flex items-center justify-center transition-all duration-1000",
                     timeLeft <= 3 ? "border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)] animate-pulse" : "border-gold-primary shadow-[0_0_30px_rgba(212,175,55,0.2)]"
                   )}>
                      <span className="text-5xl md:text-7xl font-black tabular-nums">{timeLeft}</span>
                   </div>
                   <Clock className="absolute -bottom-2 -right-2 size-10 text-gold-primary bg-black rounded-full p-2" />
                </div>

                <div className="space-y-4 text-center">
                   <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">الكلمة الحالية</p>
                   <div className="flex gap-4">
                      {currentWord.split("").map((char, i) => (
                        <motion.div key={i} layoutId={`char-${i}-${char}`} className="size-20 md:size-28 rounded-[32px] bg-white text-black flex items-center justify-center text-4xl md:text-6xl font-black shadow-2xl">
                          {char}
                        </motion.div>
                      ))}
                   </div>
                </div>

                <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
                   <input
                     autoFocus
                     value={userInput}
                     onChange={(e) => setUserInput(e.target.value)}
                     maxLength={3}
                     placeholder="ادخل الكلمة الجديدة..."
                     className="w-full h-20 bg-white/5 border-2 border-white/10 rounded-[32px] text-center text-3xl font-black focus:border-gold-primary focus:outline-none transition-all placeholder:text-white/10"
                   />
                   <p className="text-center text-[10px] font-bold text-white/30 italic">اكتب كلمة من 3 حروف بتغيير حرف واحد فقط</p>
                </form>
             </div>

             {/* Right Column: Player Hand */}
             <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 mr-2">حروفك المتاحة</h4>
                <div className="grid grid-cols-3 gap-3">
                   {players[currentPlayerIdx].hand.map((char, i) => (
                     <motion.div
                       key={`${i}-${char}`}
                       initial={{ scale: 0 }}
                       animate={{ scale: 1 }}
                       transition={{ delay: i * 0.05 }}
                       className={cn(
                         "aspect-square rounded-2xl flex items-center justify-center text-2xl font-black shadow-xl border",
                         char === "⭐" ? "bg-gradient-to-br from-gold-primary to-amber-600 border-gold-primary text-white" : "bg-white/10 border-white/10 text-gold-primary"
                       )}
                     >
                       {char}
                     </motion.div>
                   ))}
                </div>
                {players[currentPlayerIdx].hand.includes("⭐") && (
                   <div className="p-4 rounded-2xl bg-gold-primary/5 border border-gold-primary/20 flex items-center gap-3">
                      <Star className="size-5 text-gold-primary" />
                      <p className="text-[10px] font-bold text-gold-primary/80 leading-tight">الجوكر 🌟 يمكنه استبدال أي حرف غير موجود في يدك.</p>
                   </div>
                )}
             </div>

          </div>
        )}

        {gameState === "gameover" && (
           <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-8 text-center py-20">
              <div className="relative">
                 <Trophy className="size-40 text-gold-primary drop-shadow-[0_0_50px_rgba(212,175,55,0.5)]" />
                 <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 10, ease: "linear" }} className="absolute inset-0 border-4 border-dashed border-gold-primary/30 rounded-full" />
              </div>
              <div className="space-y-2">
                 <h2 className="text-5xl font-black">انتصر السجال!</h2>
                 <p className="text-2xl font-bold text-gold-primary">{players.find(p => p.isWinner)?.name} هو فارس الحروف</p>
              </div>
              <button onClick={() => setGameState("setup")} className="btn-gold px-12 py-5 rounded-[24px] font-black text-xl flex items-center gap-3">
                 <RotateCcw className="size-6" /> تحدي جديد
              </button>
           </motion.div>
        )}

      </div>
    </div>
  );
}

function X({ size }: { size: number }) {
  return <AlertCircle size={size} className="rotate-45" />;
}
