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
       <div className={cn("size-14 md:size-16 rounded-[22px] flex items-center justify-center text-white shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-1", color)}>
          {icon}
       </div>
       <span className="text-[11px] font-black text-foreground/70 group-hover:text-primary transition-colors">{label}</span>
    </Link>
  );
}

export function QuickActionsBanner() {
  return (
    <section className="animate-fade-up w-full overflow-hidden py-4">
       <div className="flex items-center justify-center gap-4 mb-8">
         <div className="h-px w-12 bg-border" />
         <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">إجراءات سريعة</h3>
         <div className="h-px w-12 bg-border" />
       </div>
       <div className="flex overflow-x-auto no-scrollbar gap-8 px-8 pb-4 sm:grid sm:grid-cols-5 lg:grid-cols-10 sm:overflow-visible sm:justify-items-center">
          <QuickAction to="/chat" label="محادثة" icon={<MessageCircle />} color="bg-blue-500" />
          <QuickAction to="/trips" label="ترفيه" icon={<Ticket />} color="bg-indigo-500" />
          <QuickAction to="/meetings" label="اجتماعات" icon={<CalendarDays />} color="bg-amber-500" />
          <QuickAction to="/tasks" label="مهام" icon={<ListChecks />} color="bg-rose-500" />
          <QuickAction to="/majlis" label="الأخبار" icon={<Newspaper />} color="bg-emerald-500" />
          <QuickAction to="/souq" label="سوق السيف" icon={<Store />} color="bg-orange-500" />
          <QuickAction to="/heritage" label="الإرث" icon={<History />} color="bg-[#1a2b3c]" />
          <QuickAction to="/family-tree" label="الشجرة" icon={<Trees />} color="bg-teal-500" />
          <QuickAction to="/finance" label="الصندوق" icon={<Wallet />} color="bg-green-600" />
          <QuickAction to="/profile" label="ملفي" icon={<User />} color="bg-slate-500" />
       </div>
    </section>
  );
}

