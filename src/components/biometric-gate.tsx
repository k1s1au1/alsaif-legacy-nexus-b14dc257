import React, { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Fingerprint, Lock, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { BiometricAuth } from "@/lib/native-bridge";

/**
 * A gate component that requires biometric authentication if enabled.
 */
export function BiometricGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = async () => {
    if (!Capacitor.isNativePlatform()) {
      setChecking(false);
      return;
    }

    const isEnabled = localStorage.getItem("app-use-biometrics") === "true";
    if (!isEnabled) {
      setChecking(false);
      return;
    }

    try {
      const result = await BiometricAuth.checkBiometry();
      if (!result.isAvailable) {
        setChecking(false);
        return;
      }

      setLocked(true);
      setChecking(false);

      const authResult = await BiometricAuth.authenticate({
        title: "تأكيد الهوية",
        subtitle: "استخدم البصمة أو الوجه",
      }).catch(() => null);

      if (authResult?.success) {
        setLocked(false);
      } else {
        setError("فشل التحقق من الهوية");
      }
    } catch (e) {
      console.error("Biometric error", e);
      setChecking(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  if (checking) return null;

  if (locked) {
    return (
      <div className="fixed inset-0 z-[999] bg-emerald-950 flex flex-col items-center justify-center p-8 text-white">
        <div className="mesh-gradient-container opacity-20">
          <div className="mesh-blob-1" />
        </div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-8 relative z-10"
        >
          <div className="size-32 rounded-[40px] bg-white/10 flex items-center justify-center mx-auto border border-white/20 shadow-2xl relative">
            <Lock className="size-12 text-gold-primary" />
            <div className="absolute inset-0 bg-gold-primary/20 blur-2xl animate-pulse" />
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tight italic font-royal-mode">
              المجلس مؤمن
            </h2>
            <p className="text-white/60 font-bold">يرجى استخدام البصمة للفتح</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-400 bg-rose-500/10 px-4 py-2 rounded-xl border border-rose-500/20">
              <ShieldAlert size={16} />
              <span className="text-xs font-black">{error}</span>
            </div>
          )}

          <button
            onClick={checkAuth}
            className="btn-gold px-12 py-5 rounded-full font-black flex items-center gap-3 shadow-2xl mx-auto"
          >
            <Fingerprint size={24} /> محاولة مرة أخرى
          </button>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}
