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
    <Link to={to} className="group flex flex-col items-center gap-2 shrink-0 focus:outline-none w-full sm:w-auto">
       {/* Solid Colored Icon Container - Balanced for Grid */}
       <div className={cn(
         "size-14 md:size-16 rounded-[22px] flex items-center justify-center text-white transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-1.5",
         "shadow-lg group-hover:shadow-2xl relative overflow-hidden",
         color
       )}>
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          {React.cloneElement(icon, { size: 28, strokeWidth: 1.5 })}
       </div>
       <span className="text-[10px] md:text-[12px] font-black text-primary/80 group-hover:text-primary transition-colors whitespace-nowrap tracking-tight text-center">{label}</span>
    </Link>
  );
}

export function QuickActionsBanner() {
  return (
    <section className="animate-fade-up w-full px-4 md:px-0 py-2">
       {/* Adaptive Container: Grid on Mobile, Flex on Desktop */}
       <div className="bg-white/60 backdrop-blur-2xl rounded-[40px] md:rounded-[48px] p-6 md:p-10 border border-white/60 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.08)] relative overflow-hidden">

          <div className="flex items-center justify-center gap-4 mb-8 opacity-40">
            <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-primary/40" />
            <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.3em] whitespace-nowrap">بوابة الوصول السريع</h3>
            <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-primary/40" />
          </div>

          {/* THE GRID LOGIC: 3 columns on mobile, auto-flex on desktop */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:flex md:flex-row md:overflow-x-auto no-scrollbar gap-y-8 gap-x-4 md:gap-6 lg:justify-between items-start" dir="rtl">
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
