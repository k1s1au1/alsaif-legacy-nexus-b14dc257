import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Plane,
  ListChecks,
  ChevronLeft,
  Timer,
  MapPin,
  Clock,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface HubProps {
  upcomingMeeting?: any;
  upcomingTrip?: any;
  tasksCount: number;
}

export function IntegratedHub({ upcomingMeeting, upcomingTrip, tasksCount }: HubProps) {
  const [activeTab, setActiveTab] = useState<"meetings" | "trips" | "tasks">("trips");

  const tabs = [
    { id: "trips", label: "ترفيه", icon: Plane, color: "text-indigo-500", activeBg: "bg-indigo-500" },
    { id: "meetings", label: "اجتماعات", icon: CalendarDays, color: "text-amber-500", activeBg: "bg-amber-500" },
    { id: "tasks", label: "مسؤوليات", icon: ListChecks, color: "text-rose-500", activeBg: "bg-rose-500" },
  ];

  return (
    <section className="px-4 animate-fade-up" style={{ animationDelay: "250ms" }}>
      <div className="relative overflow-hidden rounded-[32px] border border-border/40 bg-card/60 backdrop-blur-xl shadow-2xl">
        {/* Tab Switcher */}
        <div className="flex items-center justify-around p-2 border-b border-border/20 bg-muted/20">
           {tabs.map((tab) => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={cn(
                 "relative flex-1 flex flex-col items-center gap-1.5 py-3 transition-all duration-500 rounded-2xl",
                 activeTab === tab.id ? "text-primary scale-105" : "text-muted-foreground hover:bg-muted/40"
               )}
             >
                <tab.icon className={cn("size-5", activeTab === tab.id ? tab.color : "opacity-40")} />
                <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div layoutId="hub-tab-active" className="absolute inset-0 bg-primary/5 rounded-2xl -z-10" />
                )}
             </button>
           ))}
        </div>

        {/* Content Area */}
        <div className="min-h-[200px] relative p-6 md:p-8">
           <AnimatePresence mode="wait">
              {activeTab === "trips" && (
                <motion.div
                  key="trips"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                   {upcomingTrip ? (
                      <div className="flex flex-col md:flex-row items-center gap-8">
                         <div className="flex-1 space-y-4 text-center md:text-right w-full">
                            <div className="flex items-center justify-center md:justify-start gap-2 text-indigo-500">
                               <Timer size={14} className="animate-pulse" />
                               <span className="text-[10px] font-black uppercase tracking-widest">الترفيه القادم</span>
                            </div>
                            <h3 className="text-2xl md:text-3xl font-black text-primary leading-tight line-clamp-1">{upcomingTrip.title}</h3>
                            <div className="flex items-center justify-center md:justify-start gap-4 text-muted-foreground font-bold text-xs">
                               <span className="flex items-center gap-1.5"><MapPin size={12} /> {upcomingTrip.location || "السعودية"}</span>
                               <span className="flex items-center gap-1.5"><Clock size={12} /> {new Date(upcomingTrip.start_date).toLocaleDateString("ar-SA", { day: 'numeric', month: 'short' })}</span>
                            </div>
                         </div>
                         <Link to="/trips" className="btn-gold px-8 py-4 rounded-2xl font-black text-xs shadow-xl shrink-0">تفاصيل الرحلة</Link>
                      </div>
                   ) : (
                      <EmptyHub icon={Plane} message="لا توجد رحلات قادمة" />
                   )}
                </motion.div>
              )}

              {activeTab === "meetings" && (
                <motion.div
                  key="meetings"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                   {upcomingMeeting ? (
                      <div className="flex flex-col md:flex-row items-center gap-8">
                         <div className="flex-1 space-y-4 text-center md:text-right w-full">
                            <div className="flex items-center justify-center md:justify-start gap-2 text-amber-500">
                               <CalendarDays size={14} />
                               <span className="text-[10px] font-black uppercase tracking-widest">اجتماع مرتقب</span>
                            </div>
                            <h3 className="text-2xl md:text-3xl font-black text-primary leading-tight line-clamp-1">{upcomingMeeting.title}</h3>
                            <div className="flex items-center justify-center md:justify-start gap-4 text-muted-foreground font-bold text-xs">
                               <span className="flex items-center gap-1.5"><Clock size={12} /> {new Date(upcomingMeeting.scheduled_at).toLocaleDateString("ar-SA", { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                            </div>
                         </div>
                         <Link to="/meetings" className="btn-gold px-8 py-4 rounded-2xl font-black text-xs shadow-xl shrink-0">تأكيد الحضور</Link>
                      </div>
                   ) : (
                      <EmptyHub icon={CalendarDays} message="لا توجد اجتماعات مجدولة" />
                   )}
                </motion.div>
              )}

              {activeTab === "tasks" && (
                <motion.div
                  key="tasks"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col md:flex-row items-center gap-8 h-full"
                >
                   <div className="flex-1 space-y-4 text-center md:text-right w-full">
                      <div className="flex items-center justify-center md:justify-start gap-2 text-rose-500">
                         <ListChecks size={14} />
                         <span className="text-[10px] font-black uppercase tracking-widest">المسؤوليات العائلية</span>
                      </div>
                      <h3 className="text-2xl md:text-3xl font-black text-primary leading-tight">لديك {tasksCount} مهام قيد الإنجاز</h3>
                      <p className="text-sm font-bold text-muted-foreground max-w-md">ساهم في إنجاز مسؤولياتك لتعزيز كفاءة أعمال العائلة.</p>
                   </div>
                   <Link to="/tasks" className="btn-gold px-8 py-4 rounded-2xl font-black text-xs shadow-xl shrink-0">فتح لوحة المهام</Link>
                </motion.div>
              )}
           </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function EmptyHub({ icon: Icon, message }: any) {
  return (
    <div className="flex flex-col items-center justify-center py-4 space-y-2 opacity-40">
       <Icon className="size-10" />
       <p className="text-sm font-bold">{message}</p>
    </div>
  );
}
