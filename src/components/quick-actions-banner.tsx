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
    <Link to={to} className="group flex flex-col items-center gap-2 shrink-0 focus:outline-none">
       {/* Slick Responsive Icon Container */}
       <div className={cn(
         "size-12 md:size-15 rounded-[18px] md:rounded-[22px] flex items-center justify-center text-white transition-all duration-500 group-hover:scale-110",
         "shadow-md group-hover:shadow-xl relative overflow-hidden",
         color
       )}>
          {React.cloneElement(icon, { size: 24, strokeWidth: 2 })}
       </div>
       <span className="text-[10px] md:text-[11px] font-black text-primary/60 group-hover:text-primary transition-colors whitespace-nowrap tracking-tight">{label}</span>
    </Link>
  );
}

export function QuickActionsBanner() {
  return (
    <section className="animate-fade-up w-full px-4 md:px-0 py-2">
       {/* Clean, Non-Intrusive Container - No bulky background */}
       <div className="bg-white/30 backdrop-blur-xl rounded-[32px] md:rounded-[44px] p-6 md:p-10 border border-white/40 shadow-sm relative">

          <div className="flex items-center justify-center gap-4 mb-8 opacity-30">
            <div className="h-[1px] w-8 bg-primary" />
            <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.4em]">الوصول السريع</h3>
            <div className="h-[1px] w-8 bg-primary" />
          </div>

          {/* PRO HORIZONTAL SCROLL - Styled like high-end apps */}
          <div className="flex overflow-x-auto no-scrollbar gap-7 md:gap-4 lg:justify-between px-2 pb-2 items-start snap-x snap-mandatory" dir="rtl">
             <div className="snap-center"><QuickAction to="/chat" label="محادثة" icon={<MessageCircle />} color="bg-[#065F46]" /></div>
             <div className="snap-center"><QuickAction to="/trips" label="ترفيه" icon={<Ticket />} color="bg-[#D4AF37]" /></div>
             <div className="snap-center"><QuickAction to="/meetings" label="اجتماعات" icon={<CalendarDays />} color="bg-[#1B3022]" /></div>
             <div className="snap-center"><QuickAction to="/tasks" label="مهام" icon={<ListChecks />} color="bg-[#947D4C]" /></div>
             <div className="snap-center"><QuickAction to="/majlis" label="الأخبار" icon={<Newspaper />} color="bg-[#064E3B]" /></div>
             <div className="snap-center"><QuickAction to="/community" label="ركن الأعضاء" icon={<Users />} color="bg-[#3D8557]" /></div>
             <div className="snap-center"><QuickAction to="/archive" label="الألبوم" icon={<Archive />} color="bg-[#C5A87C]" /></div>
             <div className="snap-center"><QuickAction to="/heritage" label="الإرث" icon={<History />} color="bg-[#8E7745]" /></div>
             <div className="snap-center"><QuickAction to="/family-tree" label="الشجرة" icon={<Trees />} color="bg-[#153221]" /></div>
             <div className="snap-center"><QuickAction to="/finance" label="الصندوق" icon={<Wallet />} color="bg-[#BF953F]" /></div>
             <div className="snap-center"><QuickAction to="/profile" label="ملفي" icon={<User />} color="bg-[#043A2B]" /></div>
          </div>
       </div>
    </section>
  );
}
