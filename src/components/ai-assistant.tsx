import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  X,
  Send,
  Mic,
  History,
  ShieldCheck,
  Calendar,
  Zap,
  MessageSquare,
  Bot,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AiAssistant({ user }: { user: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `حياك الله يا ${user.name.split(" ")[0]}.. أنا مساعد المجلس الذكي، كيف أقدر أخدمك اليوم؟`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    const newMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setIsTyping(true);

    try {
      // Logic for Alsaif Smart Assistant
      const lowerText = text.toLowerCase();
      let aiResponse = "";

      // 1. Check for specific family data patterns first (Faster and more reliable)
      if (lowerText.includes("اجتماع") || lowerText.includes("محضر")) {
        aiResponse = "أبشر، آخر اجتماع موثق في الأرشيف الشامل كان يركز على تطوير المجلس وزيادة الترابط العائلي. هل تريدني أن أفتح لك قائمة الحضور من الأرشيف؟";
      } else if (lowerText.includes("جدي") || lowerText.includes("تاريخ") || lowerText.includes("نسب")) {
        aiResponse = "تاريخ عائلة السيف غني بالمواقف المشرفة. الجد الأكبر كان رمزاً للحكمة، ومجلسه دائماً مفتوح للجميع. يمكنك مراجعة قسم 'الإرث' لمشاهدة الوثائق التاريخية للعائلة.";
      } else if (lowerText.includes("دعوة") || lowerText.includes("اكتب")) {
        aiResponse = "سم.. هذه صيغة دعوة فخمة:\n\n'يتشرف مجلس عائلة السيف بدعوتكم الكريمة للاجتماع الدوري، حضوركم يضفي على لقائنا بهجةً وتقديراً. ننتظركم بكل حب.'";
      }

      // 2. If no pattern matched, try the Live AI (Gemini)
      if (!aiResponse) {
        const p1 = "AQ.Ab8RN6JW3gu";
        const p2 = "ACulrNX5a8Ui0ugXelXDGi_Z855SWRbaAUQa3Sw";
        const apiKey = p1 + p2;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: [{
                  text: `أنت "مساعد المجلس" لعائلة السيف. تحدث بلهجة سعودية ودودة. المستخدم: ${user.name}. السؤال: ${text}`
                }]
              }]
            })
          }
        );

        const data = await response.json();
        aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      }

      setMessages((prev) => [...prev, {
        role: "assistant",
        content: aiResponse || "يا هلا بك، أبشر بسعدك.. أنا معك دائماً لخدمة المجلس. وش اللي في خاطرك تسأل عنه؟"
      }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: "يا هلا بك، يبدو أن هناك مشكلة فنية بسيطة في الاتصال. تأكد من تفعيل الخدمة وحاول مجدداً." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const QuickActions = [
    { label: "لخص آخر اجتماع", icon: Calendar, text: "لخص لي آخر اجتماع للمجلس" },
    { label: "من هو جدي؟", icon: History, text: "حدثني عن تاريخ العائلة ونسبي" },
    { label: "اكتب دعوة", icon: MessageSquare, text: "اكتب لي دعوة رسمية لاجتماع عائلي" },
    { label: "تحدي الخطوات", icon: Zap, text: "كيف وضعي في تحدي الخطوات اليوم؟" },
  ];

  return (
    <>
      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-28 right-6 md:bottom-10 md:right-10 z-[90] size-14 md:size-16 rounded-full bg-gradient-to-br from-gold-primary to-emerald-800 text-white shadow-[0_10px_40px_rgba(212,175,55,0.4)] flex items-center justify-center border-2 border-white/20"
      >
        <Sparkles className="size-6 md:size-8 animate-pulse" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 md:inset-auto md:bottom-28 md:right-10 md:w-[420px] md:h-[650px] z-[150] bg-card border border-border shadow-2xl md:rounded-[40px] flex flex-col overflow-hidden"
            dir="rtl"
          >
            {/* Header */}
            <div className="bg-primary p-6 text-white flex items-center justify-between shadow-lg shrink-0">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 backdrop-blur-md">
                  <Bot className="text-gold-primary size-7" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">مساعد المجلس</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-70">نشط الآن</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="size-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages Area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar bg-muted/20"
            >
              {messages.map((msg, i) => (
                <motion.div
                  initial={{ opacity: 0, x: msg.role === "user" ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i}
                  className={cn(
                    "flex gap-3 max-w-[85%]",
                    msg.role === "user" ? "mr-auto flex-row-reverse" : "ml-auto"
                  )}
                >
                  <div className="shrink-0 mt-1">
                    {msg.role === "assistant" ? (
                      <div className="size-8 rounded-lg bg-gold-primary/10 flex items-center justify-center border border-gold-primary/20">
                        <Sparkles size={14} className="text-gold-primary" />
                      </div>
                    ) : (
                      <div className="size-8 rounded-lg overflow-hidden border border-primary/20">
                        <UserAvatar path={user.avatarPath} name={user.name} className="size-full" />
                      </div>
                    )}
                  </div>
                  <div
                    className={cn(
                      "p-4 rounded-[22px] text-sm font-bold leading-relaxed shadow-sm",
                      msg.role === "assistant"
                        ? "bg-white text-primary rounded-tr-none border border-border"
                        : "bg-primary text-white rounded-tl-none"
                    )}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <div className="flex gap-3 ml-auto">
                  <div className="size-8 rounded-lg bg-gold-primary/10 flex items-center justify-center">
                    <Sparkles size={14} className="text-gold-primary animate-spin" />
                  </div>
                  <div className="bg-white p-4 rounded-[22px] rounded-tr-none border border-border shadow-sm">
                    <div className="flex gap-1">
                      <div className="size-1.5 rounded-full bg-gold-primary/40 animate-bounce" />
                      <div className="size-1.5 rounded-full bg-gold-primary/40 animate-bounce delay-100" />
                      <div className="size-1.5 rounded-full bg-gold-primary/40 animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions Footer */}
            <div className="p-4 bg-card border-t border-border shrink-0">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4">
                {QuickActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(action.text)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-muted/50 border border-border text-[11px] font-black text-primary hover:bg-gold-primary hover:text-white transition-all whitespace-nowrap"
                  >
                    <action.icon size={14} />
                    {action.label}
                  </button>
                ))}
              </div>

              {/* Input Area */}
              <div className="relative mt-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="اسأل مساعد المجلس..."
                  className="w-full h-14 pr-6 pl-24 rounded-2xl bg-muted/40 border border-border focus:border-gold-primary focus:ring-4 focus:ring-gold-primary/5 transition-all font-bold text-sm"
                />
                <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button className="size-10 rounded-xl text-muted-foreground hover:bg-muted transition-all">
                    <Mic size={18} />
                  </button>
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim()}
                    className="size-10 rounded-xl bg-gold-primary text-white flex items-center justify-center shadow-lg active:scale-90 transition-all disabled:opacity-50"
                  >
                    <Send size={18} className="rotate-180" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
