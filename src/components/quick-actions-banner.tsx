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
  colorClass: string;
  iconColor: string;
}

function QuickAction({ to, label, icon, colorClass, iconColor }: QuickActionProps) {
  return (
    <Link to={to} className="group flex flex-col items-center gap-3 shrink-0 focus:outline-none">
       {/* Glassy Icon Container */}
       <div className={cn(
         "size-14 md:size-16 rounded-[22px] flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-1.5",
         "backdrop-blur-xl border-2 shadow-sm group-hover:shadow-xl relative overflow-hidden",
         colorClass // This will now handle the glassy background and border
       )}>
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          {React.cloneElement(icon, {
            size: 26,
            strokeWidth: 2.5,
            className: cn("transition-transform duration-500 group-hover:scale-110", iconColor)
          })}
       </div>
       <span className="text-[11px] font-black text-primary/70 group-hover:text-primary transition-colors whitespace-nowrap tracking-tight">{label}</span>
    </Link>
  );
}

export function QuickActionsBanner() {
  return (
    <section className="animate-fade-up w-full px-4 md:px-0 py-4">
       {/* Clean, Non-Glassy Container */}
       <div className="bg-transparent rounded-[44px] p-6 md:p-8 border-y border-gold-primary/5">

          <div className="flex items-center justify-center gap-4 mb-8 opacity-40">
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-primary" />
            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em] whitespace-nowrap text-center">أقسام مجلس السيف</h3>
            <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-primary" />
          </div>

          <div className="flex overflow-x-auto no-scrollbar gap-8 md:gap-5 lg:justify-between px-2 pb-4 items-start" dir="rtl">
             <QuickAction to="/chat" label="محادثة" icon={<MessageCircle />}
                colorClass="bg-emerald-500/10 border-emerald-500/20" iconColor="text-emerald-700" />
             <QuickAction to="/trips" label="ترفيه" icon={<Ticket />}
                colorClass="bg-gold-primary/10 border-gold-primary/20" iconColor="text-gold-primary" />
             <QuickAction to="/meetings" label="اجتماعات" icon={<CalendarDays />}
                colorClass="bg-green-800/10 border-green-800/20" iconColor="text-green-900" />
             <QuickAction to="/tasks" label="مهام" icon={<ListChecks />}
                colorClass="bg-amber-700/10 border-amber-700/20" iconColor="text-amber-800" />
             <QuickAction to="/majlis" label="الأخبار" icon={<Newspaper />}
                colorClass="bg-emerald-900/10 border-emerald-900/20" iconColor="text-emerald-900" />
             <QuickAction to="/community" label="ركن الأعضاء" icon={<Users />}
                colorClass="bg-green-600/10 border-green-600/20" iconColor="text-green-700" />
             <QuickAction to="/archive" label="الألبوم" icon={<Archive />}
                colorClass="bg-stone-500/10 border-stone-500/20" iconColor="text-stone-700" />
             <QuickAction to="/heritage" label="الإرث" icon={<History />}
                colorClass="bg-orange-800/10 border-orange-800/20" iconColor="text-orange-900" />
             <QuickAction to="/family-tree" label="الشجرة" icon={<Trees />}
                colorClass="bg-green-900/10 border-green-900/20" iconColor="text-green-950" />
             <QuickAction to="/finance" label="الصندوق" icon={<Wallet />}
                colorClass="bg-yellow-600/10 border-yellow-600/20" iconColor="text-yellow-700" />
             <QuickAction to="/profile" label="ملفي" icon={<User />}
                colorClass="bg-emerald-800/10 border-emerald-800/20" iconColor="text-emerald-900" />
          </div>
       </div>
    </section>
  );
}
