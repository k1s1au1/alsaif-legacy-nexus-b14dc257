import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Shield, Users, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function WelcomeScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const steps = [
    {
      title: "أهلاً بك في مجلس السيف",
      description: "منصتكم العائلية الخاصة للتواصل، التنظيم، وحفظ الإرث العريق لأجيالنا القادمة.",
      icon: <Sparkles className="size-12 text-[#D4AF37]" />,
    },
    {
      title: "خصوصية وأمان تام",
      description: "مساحة آمنة وحصرية لأفراد العائلة فقط، حيث نشارك أخبارنا ومناسباتنا بكل طمأنينة.",
      icon: <Shield className="size-12 text-[#D4AF37]" />,
    },
    {
      title: "ترابط الأجيال",
      description: "من شجرة العائلة إلى سجلات المجلس، نبني جسور التواصل بين الماضي والحاضر والمستقبل.",
      icon: <Users className="size-12 text-[#D4AF37]" />,
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setIsVisible(false);
      setTimeout(onComplete, 500);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#F5F5F0] flex flex-col items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 w-full max-w-lg px-8 text-center flex flex-col items-center"
        >
          <div className="size-24 rounded-3xl bg-[#1B4332]/5 ring-1 ring-[#D4AF37]/20 flex items-center justify-center mb-10">
            {steps[step].icon}
          </div>

          <h1 className="text-3xl font-bold text-[#1B4332] mb-6 tracking-tight leading-tight">
            {steps[step].title}
          </h1>

          <p className="text-lg text-[#4A4A4A] leading-relaxed mb-12 max-w-sm">
            {steps[step].description}
          </p>
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-2 mb-10">
        {steps.map((_, i) => (
          <div key={i} className={cn("h-1.5 transition-all duration-300 rounded-full", i === step ? "w-8 bg-[#D4AF37]" : "w-1.5 bg-[#D4AF37]/20")} />
        ))}
      </div>

      <button
        onClick={handleNext}
        className="relative z-10 flex items-center gap-3 bg-gradient-to-l from-[#996515] to-[#D4AF37] text-white px-10 py-4 rounded-2xl font-bold text-lg hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-[#D4AF37]/20"
      >
        <span>{step === steps.length - 1 ? "ابدأ الرحلة" : "التالي"}</span>
        <ArrowLeft className="size-5" />
      </button>

      <div className="absolute bottom-8 text-center">
        <p className="text-[10px] text-[#A0A0A0] uppercase tracking-[0.2em] font-bold">
          Alsaif Family Hub
        </p>
      </div>
    </div>
  );
}
