import React from "react";
import { Link } from "@tanstack/react-router";
import {
  MessageCircle,
  Ticket,
  CalendarDays,
  ListChecks,
  Newspaper,
  Trees,
  Wallet,
  User,
  History,
  Archive,
  Users,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { sendFazaNotification } from "@/lib/api/push.functions";
import { toast } from "sonner";
import { SOS } from "@/lib/native-bridge";

interface QuickActionProps {
  to?: string;
  label: string;
  icon: any;
  color: string;
  onClick?: () => void;
}

function QuickAction({ to, label, icon, color, onClick }: QuickActionProps) {
  const content = (
    <div className="group flex flex-col items-center gap-3 shrink-0 focus:outline-none cursor-pointer">
       <div className={cn(
         "size-14 md:size-16 rounded-[24px] flex items-center justify-center text-white transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-1.5",
         "shadow-[0_8px_30px_rgb(0,0,0,0.12)] group-hover:shadow-2xl relative overflow-hidden",
         color
       )}>
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          {React.cloneElement(icon, { size: 28, strokeWidth: 1.5 })}
       </div>
       <span className="text-[11px] md:text-[13px] font-black text-primary/80 group-hover:text-primary transition-colors whitespace-nowrap tracking-tight text-center">{label}</span>
    </div>
  );

  if (onClick) return <button onClick={onClick} className="focus:outline-none">{content}</button>;
  return <Link to={to!} className="focus:outline-none">{content}</Link>;
}

export function QuickActionsBanner() {
  const runFaza = useServerFn(sendFazaNotification);

  const handleFaza = async () => {
    if (!confirm("هل أنت متأكد من إرسال نداء 'فزعة' عاجل لجميع أفراد العائلة؟\nيستخدم هذا الخيار في الحالات الطارئة فقط.")) return;

    toast.loading("جاري إرسال نداء الاستغاثة...");
    try {
      const res = await runFaza({ data: { message: "أحتاج لمساعدة عاجلة" } });

      // Trigger Native Emergency Notification (on local device for feedback)
      try {
        await SOS.showEmergencyNotification({
          name: "أنت",
          location: "موقعك الحالي"
        });
      } catch (e) { console.error("Native SOS notification failed", e); }

      toast.dismiss();
      if (res.success) {
        toast.success("تم إرسال النداء لجميع أفراد العائلة بنجاح 🆘");
      }
    } catch {
      toast.dismiss();
      toast.error("فشل إرسال النداء");
    }
  };

  return (
    <section className="animate-fade-up w-full px-4 md:px-0 py-8 hidden md:block">
       <div className="flex items-center justify-center gap-4 mb-10 opacity-30">
         <div className="h-[1px] w-12 bg-primary" />
         <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">الوصول السريع للمجلس</h3>
         <div className="h-[1px] w-12 bg-primary" />
       </div>

       {/* Desktop: Centered Row of Actions */}
       <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12 px-4 pb-4">
          <QuickAction onClick={handleFaza} label="فزعة" icon={<ShieldAlert />} color="bg-rose-600 animate-pulse" />
          <QuickAction to="/chat" label="محادثة" icon={<MessageCircle />} color="bg-[#065F46]" />
          <QuickAction to="/trips" label="ترفيه" icon={<Ticket />} color="bg-[#D4AF37]" />
          <QuickAction to="/meetings" label="اجتماعات" icon={<CalendarDays />} color="bg-[#1B3022]" />
          <QuickAction to="/tasks" label="مهام" icon={<ListChecks />} color="bg-[#947D4C]" />
          <QuickAction to="/majlis" label="الأخبار" icon={<Newspaper />} color="bg-[#064E3B]" />
          <QuickAction to="/community" label="ركن الأعضاء" icon={<Users />} color="bg-[#3D8557]" />
          <QuickAction to="/archive" label="الألبوم" icon={<Archive />} color="bg-[#C5A87C]" />
          <QuickAction to="/heritage" label="الإرث" icon={<History />} color="bg-[#8E7745]" />
          <QuickAction to="/family-tree" label="شجرة العائلة" icon={<Trees />} color="bg-[#153221]" />
          <QuickAction to="/vault" label="الخزنة" icon={<Lock />} color="bg-[#7c2d12]" />
          <QuickAction to="/finance" label="الصندوق" icon={<Wallet />} color="bg-[#BF953F]" />
       </div>
    </section>
  );
}
