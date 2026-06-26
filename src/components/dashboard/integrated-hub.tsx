import React, { useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Plane,
  ListChecks,
  Timer,
  MapPin,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { TripImage } from "@/components/trip-image";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

interface HubProps {
  upcomingMeetings: any[];
  upcomingTrips: any[];
  tasksCount: number;
}

export function IntegratedHub({ upcomingMeetings, upcomingTrips, tasksCount }: HubProps) {
  const [activeTab, setActiveTab] = useState<"meetings" | "trips" | "tasks">("trips");

  const tripsPlugin = useRef(Autoplay({ delay: 6000, stopOnInteraction: true }));
  const meetingsPlugin = useRef(Autoplay({ delay: 6000, stopOnInteraction: true }));

  const tabs = [
    { id: "trips", label: "ترفيه", icon: Plane, color: "text-indigo-400" },
    { id: "meetings", label: "اجتماعات", icon: CalendarDays, color: "text-amber-400" },
    { id: "tasks", label: "مسؤوليات", icon: ListChecks, color: "text-rose-400" },
  ];

  return (
    <section className="px-4 animate-fade-up" style={{ animationDelay: "250ms" }}>
      <div className="relative overflow-hidden rounded-[32px] md:rounded-[40px] border border-white/5 bg-[#051410] shadow-[0_20px_50px_rgba(0,0,0,0.3)]">

        {/* Background Logic */}
        <AnimatePresence mode="wait">
          {activeTab === "trips" && upcomingTrips.length > 0 ? (
            <motion.div
              key="bg-trips"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
              className="absolute inset-0 z-0"
            >
               <TripImage path={upcomingTrips[0]?.image_url} alt="" className="size-full object-cover opacity-60" />
               <div className="absolute inset-0 bg-gradient-to-br from-[#0d2620]/90 via-[#051410]/70 to-black/90" />
            </motion.div>
          ) : (
            <motion.div
              key="bg-gradient"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-br from-[#0d2620] via-[#051410] to-black z-0"
            />
          )}
        </AnimatePresence>

        <div className="absolute top-0 right-0 size-40 bg-gold-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 z-1" />

        {/* Tab Switcher */}
        <div className="relative flex items-center justify-around p-3 border-b border-white/5 bg-black/20 backdrop-blur-md z-10">
           {tabs.map((tab) => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={cn(
                 "relative flex-1 flex flex-col items-center gap-1.5 py-3 transition-all duration-500 rounded-2xl z-10",
                 activeTab === tab.id ? "text-white scale-105" : "text-white/40 hover:text-white/60"
               )}
             >
                <tab.icon className={cn("size-5 transition-colors", activeTab === tab.id ? tab.color : "opacity-40")} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="hub-tab-active-bg"
                    className="absolute inset-0 bg-white/5 rounded-2xl -z-10 border border-white/5"
                  />
                )}
             </button>
           ))}
        </div>

        {/* Content Area */}
        <div className="min-h-[220px] relative z-10">
           <AnimatePresence mode="wait">
              {activeTab === "trips" && (
                <motion.div
                  key="trips"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full h-full"
                >
                   {upcomingTrips.length > 0 ? (
                      <Carousel
                        orientation="vertical"
                        plugins={[tripsPlugin.current]}
                        className="w-full"
                        opts={{ loop: true }}
                      >
                         <CarouselContent className="h-[220px] md:h-[250px]">
                            {upcomingTrips.map((trip) => (
                              <CarouselItem key={trip.id} className="flex items-center p-8 md:p-12">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-10 w-full">
                                   <div className="space-y-4 text-center md:text-right flex-1">
                                      <div className="flex items-center justify-center md:justify-start gap-3 text-indigo-400">
                                         <Timer size={16} className="animate-pulse" />
                                         <span className="text-[10px] font-black uppercase tracking-[0.3em]">الترفيه القادم</span>
                                      </div>
                                      <h3 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight">{trip.title}</h3>
                                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-white/50 font-bold text-xs">
                                         <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/5"><MapPin size={14} className="text-indigo-400" /> {trip.location || "السعودية"}</span>
                                         <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/5"><Clock size={14} className="text-indigo-400" /> {new Date(trip.start_date).toLocaleDateString("ar-SA", { day: 'numeric', month: 'long' })}</span>
                                      </div>
                                   </div>
                                   <Link to="/trips" className="btn-gold px-12 py-5 rounded-full font-black text-sm shadow-2xl shadow-gold-primary/20 shrink-0 hover:scale-105 active:scale-95 transition-all">اكتشف التفاصيل</Link>
                                </div>
                              </CarouselItem>
                            ))}
                         </CarouselContent>
                      </Carousel>
                   ) : (
                      <EmptyHub icon={Plane} message="لا توجد رحلات مجدولة حالياً" />
                   )}
                </motion.div>
              )}

              {activeTab === "meetings" && (
                <motion.div
                  key="meetings"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full h-full"
                >
                   {upcomingMeetings.length > 0 ? (
                      <Carousel
                        orientation="vertical"
                        plugins={[meetingsPlugin.current]}
                        className="w-full"
                        opts={{ loop: true }}
                      >
                         <CarouselContent className="h-[220px] md:h-[250px]">
                            {upcomingMeetings.map((meeting) => (
                              <CarouselItem key={meeting.id} className="flex items-center p-8 md:p-12">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-10 w-full">
                                   <div className="space-y-4 text-center md:text-right flex-1">
                                      <div className="flex items-center justify-center md:justify-start gap-3 text-amber-400">
                                         <CalendarDays size={16} />
                                         <span className="text-[10px] font-black uppercase tracking-[0.3em]">اجتماع العائلة</span>
                                      </div>
                                      <h3 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight">{meeting.title}</h3>
                                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-white/50 font-bold text-xs">
                                         <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/5"><Clock size={14} className="text-amber-400" /> {new Date(meeting.scheduled_at).toLocaleDateString("ar-SA", { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                         <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/5"><MapPin size={14} className="text-amber-400" /> {meeting.location || "مجلس العائلة"}</span>
                                      </div>
                                   </div>
                                   <Link to="/meetings" className="btn-gold px-12 py-5 rounded-full font-black text-sm shadow-2xl shadow-gold-primary/20 shrink-0 hover:scale-105 active:scale-95 transition-all">تأكيد الحضور</Link>
                                </div>
                              </CarouselItem>
                            ))}
                         </CarouselContent>
                      </Carousel>
                   ) : (
                      <EmptyHub icon={CalendarDays} message="لا توجد اجتماعات قريبة" />
                   )}
                </motion.div>
              )}

              {activeTab === "tasks" && (
                <motion.div
                  key="tasks"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full p-8 md:p-12"
                >
                   <div className="flex flex-col md:flex-row items-center justify-between gap-10">
                      <div className="space-y-4 text-center md:text-right flex-1">
                         <div className="flex items-center justify-center md:justify-start gap-3 text-rose-400">
                            <ListChecks size={16} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">المسؤوليات الجارية</span>
                         </div>
                         <h3 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight">لديك {tasksCount} مهام قيد الإنجاز</h3>
                         <p className="text-sm md:text-base font-bold text-white/40 max-w-xl leading-relaxed">ساهم في تحقيق أهداف العائلة من خلال إتمام المسؤوليات الموكلة إليك في أسرع وقت.</p>
                      </div>
                      <Link to="/tasks" className="btn-gold px-12 py-5 rounded-full font-black text-sm shadow-2xl shadow-gold-primary/20 shrink-0 hover:scale-105 active:scale-95 transition-all">لوحة المسؤوليات</Link>
                   </div>
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
    <div className="flex flex-col items-center justify-center py-12 space-y-4 text-white/20 w-full">
       <div className="size-16 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
          <Icon className="size-8" />
       </div>
       <p className="text-sm font-black uppercase tracking-widest">{message}</p>
    </div>
  );
}
