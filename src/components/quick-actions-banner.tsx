import React from "react";
import { Link } from "@tanstack/react-router";
import {
  MessageCircle,
  Ticket,
  CalendarDays,
  ListChecks,
  Newspaper,
  Megaphone,
  Trees,
  Wallet,
  User,
  History,
  Archive,
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
         "size-14 md:size-16 rounded-[22px] flex items-center justify-center text-white transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-2 glass-reflection",
         "shadow-[0_8px_20px_-6px_rgba(0,0,0,0.2)] group-hover:shadow-2xl",
         color
       )}>
          {React.cloneElement(icon, { size: 28, strokeWidth: 2 })}
       </div>
       <span className="text-[10px] font-black text-foreground/60 uppercase tracking-widest group-hover:text-primary transition-colors">{label}</span>
    </Link>
  );
}

export function QuickActionsBanner() {
  return (
    <section className="animate-fade-up w-full overflow-hidden py-6">
       <div className="flex items-center justify-center gap-4 mb-10 opacity-40">
         <div className="h-px w-10 bg-gradient-to-r from-transparent to-primary" />
         <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.4em]">الوصول السريع</h3>
         <div className="h-px w-10 bg-gradient-to-l from-transparent to-primary" />
       </div>
       <div className="flex overflow-x-auto no-scrollbar gap-8 px-8 pb-4 sm:grid sm:grid-cols-5 lg:grid-cols-10 sm:overflow-visible sm:justify-items-center">
          <QuickAction to="/chat" label="محادثة" icon={<MessageCircle />} color="bg-green-700" />
          <QuickAction to="/trips" label="ترفيه" icon={<Ticket />} color="bg-green-700" />
          <QuickAction to="/meetings" label="اجتماعات" icon={<CalendarDays />} color="bg-green-700" />
          <QuickAction to="/tasks" label="مهام" icon={<ListChecks />} color="bg-green-700" />
          <QuickAction to="/majlis" label="إعلانات" icon={<Megaphone />} color="bg-green-700" />
          <QuickAction to="/archive" label="الألبوم" icon={<Archive />} color="bg-green-700" />
          <QuickAction to="/heritage" label="الإرث" icon={<History />} color="bg-green-700" />
          <QuickAction to="/family-tree" label="الشجرة" icon={<Trees />} color="bg-green-700" />
          <QuickAction to="/finance" label="الصندوق" icon={<Wallet />} color="bg-green-700" />
          <QuickAction to="/profile" label="ملفي" icon={<User />} color="bg-green-700" />

       </div>
    </section>
  );
}


