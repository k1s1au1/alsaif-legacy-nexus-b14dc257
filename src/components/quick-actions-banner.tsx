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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionProps {
  to: string;
  label: string;
  icon: any;
  color: string;
}

function QuickAction({ to, label, icon, color }: QuickActionProps) {
  return (
    <Link to={to} className="group flex flex-col items-center gap-3 shrink-0">
       <div className={cn(
         "size-14 md:size-16 rounded-[24px] flex items-center justify-center text-white transition-all duration-700 group-hover:scale-110 group-hover:-translate-y-2",
         "shadow-lg group-hover:shadow-2xl relative overflow-hidden",
         color
       )}>
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          {React.cloneElement(icon, { size: 28, strokeWidth: 1.5 })}
       </div>
       <span className="text-[11px] font-black text-primary/80 group-hover:text-primary transition-colors whitespace-nowrap tracking-tight">{label}</span>
    </Link>
  );
}

export function QuickActionsBanner() {
  return (
    <section className="animate-fade-up w-full px-4 md:px-0">
       <div className="bg-white/40 backdrop-blur-2xl rounded-[44px] p-8 md:p-12 border border-white/40 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] relative overflow-hidden group/banner">

          {/* Subtle Inner Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />

          <div className="flex items-center justify-center gap-4 mb-10 opacity-60 relative z-10">
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-primary/40" />
            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em] whitespace-nowrap">الوصول السريع للمجلس</h3>
            <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-primary/40" />
          </div>

          <div className="flex overflow-x-auto no-scrollbar gap-8 md:gap-4 lg:justify-between px-2 pb-2 items-start relative z-10" dir="rtl">
             <QuickAction to="/chat" label="محادثة" icon={<MessageCircle />} color="bg-[#065F46]" />
             <QuickAction to="/trips" label="ترفيه" icon={<Ticket />} color="bg-[#D4AF37]" />
             <QuickAction to="/meetings" label="اجتماعات" icon={<CalendarDays />} color="bg-[#1B3022]" />
             <QuickAction to="/tasks" label="مهام" icon={<ListChecks />} color="bg-[#947D4C]" />
             <QuickAction to="/majlis" label="الأخبار" icon={<Newspaper />} color="bg-[#064E3B]" />
             <QuickAction to="/community" label="ركن الأعضاء" icon={<Users />} color="bg-[#3D8557]" />
             <QuickAction to="/archive" label="الألبوم" icon={<Archive />} color="bg-[#C5A87C]" />
             <QuickAction to="/heritage" label="الإرث" icon={<History />} color="bg-[#8E7745]" />
             <QuickAction to="/family-tree" label="الشجرة" icon={<Trees />} color="bg-[#153221]" />
             <QuickAction to="/finance" label="الصندوق" icon={<Wallet />} color="bg-[#BF953F]" />
             <QuickAction to="/profile" label="ملفي" icon={<User />} color="bg-[#043A2B]" />
          </div>
       </div>
    </section>
  );
}
