import React, { useState, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VoiceSearchProps {
  onResult: (text: string) => void;
  className?: string;
}

export function VoiceSearch({ onResult, className }: VoiceSearchProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      setIsSupported(true);
    }
  }, []);

  const toggleListening = () => {
    if (!isSupported) {
      toast.error("البحث الصوتي غير مدعوم في هذا المتصفح");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = "ar-SA";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      toast.info("جاري الاستماع... تحدث الآن", { duration: 2000 });
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      if (event.error === "not-allowed") {
        toast.error("يرجى منح إذن الميكروفون لاستخدام البحث الصوتي");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={cn(
        "size-10 rounded-full flex items-center justify-center transition-all",
        isListening
          ? "bg-red-500 text-white animate-pulse"
          : "bg-primary/10 text-primary hover:bg-primary/20",
        className
      )}
      title="بحث صوتي"
    >
      {isListening ? <Loader2 className="size-5 animate-spin" /> : <Mic className="size-5" />}
    </button>
  );
}
