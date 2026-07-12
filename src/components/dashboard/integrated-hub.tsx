import React, { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Plane, ListChecks, Timer, MapPin, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { TripImage } from "@/components/trip-image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { ChevronUp, ChevronDown } from "lucide-react";

interface HubProps {
  upcomingMeetings: any[];
  upcomingTrips: any[];
  tasksCount: number;
  onViewTrip?: (trip: any) => void;
  onViewMeeting?: (meeting: any) => void;
}

function CountdownDisplay({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState<{ value: string; label: string } | null>(null);

  useEffect(() => {
    const calculate = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const diff = target - now;

      if (diff <= 0) return { value: "0", label: "بدأ الآن" };

      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days >= 1) {
        return {
          value: days.toString(),
          label: days === 1 ? "يوم متبقي" : days === 2 ? "يومان متبقيان" : "أيام متبقية",
        };
      }

      if (hours >= 1) {
        const remainingMinutes = minutes % 60;
        if (remainingMinutes > 0) {
          return {
            value: `${hours}:${remainingMinutes.toString().padStart(2, "0")}`,
            label: "ساعة ودقيقة",
          };
        }
        return { value: hours.toString(), label: hours === 1 ? "ساعة متبقية" : "ساعات متبقية" };
      }

      return { value: minutes.toString(), label: "دقيقة متبقية" };
    };

    setTimeLeft(calculate());
    const id = setInterval(() => setTimeLeft(calculate()), 60000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!timeLeft) return null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-3xl p-3 md:p-6 text-center flex-1 md:flex-none md:min-w-[120px] shadow-2xl">
      <span className="block text-2xl md:text-5xl font-black text-gold-primary tracking-tighter leading-none">
        {timeLeft.value}
      </span>
      <span className="block text-[8px] md:text-[10px] font-black text-white/40 uppercase tracking-widest mt-1">
        {timeLeft.label}
      </span>
    </div>
  );
}

export function IntegratedHub({
  upcomingMeetings = [],
  upcomingTrips = [],
  tasksCount = 0,
  onViewTrip,
  onViewMeeting,
}: HubProps) {
  const [activeTab, setActiveTab] = useState<"meetings" | "trips" | "tasks">("trips");
  const [tripApi, setTripApi] = useState<CarouselApi>();
  const [activeTripIndex, setActiveTripIndex] = useState(0);

  const tripsPlugin = useRef(Autoplay({ delay: 6000, stopOnInteraction: true }));
  const meetingsPlugin = useRef(Autoplay({ delay: 6000, stopOnInteraction: true }));

  useEffect(() => {
    if (!tripApi || !tripApi.on) return;
    const onSelect = () => {
      setActiveTripIndex(tripApi.selectedScrollSnap());
    };
    tripApi.on("select", onSelect);
    return () => {
      tripApi.off("select", onSelect);
    };
  }, [tripApi]);

  const tabs = [
    { id: "trips", label: "الترفيه", icon: Plane, color: "text-indigo-400" },
    { id: "meetings", label: "الاجتماعات", icon: CalendarDays, color: "text-amber-400" },
    { id: "tasks", label: "المسؤوليات", icon: ListChecks, color: "text-rose-400" },
  ];

  const currentTripImage = upcomingTrips[activeTripIndex]?.image_url;

  const getMotivationalNudge = () => {
    const messages = [
      "إنجازك لهذه المهام يسهل مسيرة العائلة، نحن بانتظارك!",
      "كل مهمة تنجزها هي لبنة في بناء مستقبل عائلتنا.",
      "همتك العالية هي سر نجاح مجلسنا، استمر!",
      "العائلة تفتخر بمبادراتك، إنجازك يصنع الفرق.",
      "خطوة واحدة منك تقربنا من أهدافنا الكبرى.",
    ];
    if (tasksCount === 0) return "أنت فخر العائلة! لا توجد مهام معلقة حالياً.";
    if (tasksCount > 5) return "ما شاء الله! العائلة تعتمد على همتك العالية لإنجاز هذه المسؤوليات.";
    return messages[tasksCount % messages.length];
  };

  return (
    <section className="px-4 animate-fade-up" style={{ animationDelay: "250ms" }}>
      <div className="relative overflow-hidden rounded-[32px] md:rounded-[40px] border border-white/5 bg-[#051410] shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        {/* Background Logic */}
        <AnimatePresence mode="wait">
          {activeTab === "trips" && upcomingTrips.length > 0 ? (
            <motion.div
              key={`bg-trips-${activeTripIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 z-0"
            >
              <TripImage
                path={currentTripImage}
                alt=""
                className="size-full object-cover opacity-60"
              />
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
                activeTab === tab.id ? "text-white scale-105" : "text-white/40 hover:text-white/60",
              )}
            >
              <tab.icon
                className={cn(
                  "size-5 transition-colors",
                  activeTab === tab.id ? tab.color : "opacity-40",
                )}
              />
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
        <div className="min-h-[280px] md:min-h-[220px] relative z-10">
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
                    setApi={setTripApi}
                    className="w-full"
                    opts={{ loop: true }}
                  >
                    <CarouselContent className="h-[280px] md:h-[250px]">
                      {upcomingTrips.map((trip) => {
                        const daysLeft = trip.start_date
                          ? Math.ceil(
                              (new Date(trip.start_date).getTime() - new Date().getTime()) /
                                (1000 * 60 * 60 * 24),
                            )
                          : 0;
                        return (
                          <CarouselItem key={trip.id} className="flex items-center p-6 md:p-12">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10 w-full">
                              <div className="space-y-4 text-center md:text-right flex-1">
                                <div className="flex items-center justify-center md:justify-start gap-3 text-indigo-400">
                                  <Timer size={16} className="animate-pulse" />
                                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                                    الترفيه القادم
                                  </span>
                                </div>
                                <h3 className="text-2xl md:text-5xl font-black text-white leading-tight tracking-tight line-clamp-2 md:line-clamp-none">
                                  {trip.title}
                                </h3>
                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-6 text-white/50 font-bold text-[10px] md:text-xs">
                                  <span className="flex items-center gap-2 bg-white/5 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-white/5">
                                    <MapPin size={12} className="text-indigo-400" />{" "}
                                    {trip.location || "السعودية"}
                                  </span>
                                  <span className="flex items-center gap-2 bg-white/5 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-white/5">
                                    <Clock size={12} className="text-indigo-400" />{" "}
                                    {new Date(trip.start_date).toLocaleDateString("ar-SA", {
                                      day: "numeric",
                                      month: "long",
                                    })}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-row md:flex-col items-center gap-4 md:gap-6 shrink-0 w-full md:w-auto">
                                <CountdownDisplay targetDate={trip.start_date} />
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => onViewTrip?.(trip)}
                                  className="btn-gold px-6 md:px-10 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs shadow-xl flex-1 md:flex-none transition-all"
                                >
                                  التفاصيل
                                </motion.button>
                              </div>
                            </div>
                          </CarouselItem>
                        );
                      })}
                    </CarouselContent>

                    {/* Desktop Arrows */}
                    <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 left-4 flex-col gap-2 z-20">
                      <CarouselPrevious className="relative top-0 left-0 translate-x-0 translate-y-0 rotate-0 bg-white/5 border-white/10 hover:bg-gold-primary hover:text-black text-white" />
                      <CarouselNext className="relative bottom-0 left-0 translate-x-0 translate-y-0 rotate-0 bg-white/5 border-white/10 hover:bg-gold-primary hover:text-black text-white" />
                    </div>
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
                    <CarouselContent className="h-[280px] md:h-[250px]">
                      {(upcomingMeetings || []).map((meeting) => {
                        if (!meeting) return null;
                        const daysLeft = meeting.scheduled_at
                          ? Math.ceil(
                              (new Date(meeting.scheduled_at).getTime() - new Date().getTime()) /
                                (1000 * 60 * 60 * 24),
                            )
                          : 0;
                        return (
                          <CarouselItem key={meeting.id} className="flex items-center p-6 md:p-12">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10 w-full">
                              <div className="space-y-4 text-center md:text-right flex-1">
                                <div className="flex items-center justify-center md:justify-start gap-3 text-amber-400">
                                  <CalendarDays size={16} />
                                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                                    الاجتماع القادم
                                  </span>
                                </div>
                                <h3 className="text-2xl md:text-5xl font-black text-white leading-tight tracking-tight line-clamp-2 md:line-clamp-none">
                                  {meeting.title}
                                </h3>
                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-6 text-white/50 font-bold text-[10px] md:text-xs">
                                  <span className="flex items-center gap-2 bg-white/5 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-white/5">
                                    <Clock size={12} className="text-amber-400" />{" "}
                                    {new Date(meeting.scheduled_at).toLocaleDateString("ar-SA", {
                                      weekday: "long",
                                      day: "numeric",
                                      month: "long",
                                    })}
                                  </span>
                                  <span className="flex items-center gap-2 bg-white/5 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-white/5">
                                    <MapPin size={12} className="text-amber-400" />{" "}
                                    {meeting.location || "مجلس العائلة"}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-row md:flex-col items-center gap-4 md:gap-6 shrink-0 w-full md:w-auto">
                                <CountdownDisplay targetDate={meeting.scheduled_at} />
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => onViewMeeting?.(meeting)}
                                  className="btn-gold px-6 md:px-10 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs shadow-xl flex-1 md:flex-none transition-all"
                                >
                                  الحضور
                                </motion.button>
                              </div>
                            </div>
                          </CarouselItem>
                        );
                      })}
                    </CarouselContent>

                    {/* Desktop Arrows */}
                    <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 left-4 flex-col gap-2 z-20">
                      <CarouselPrevious className="relative top-0 left-0 translate-x-0 translate-y-0 rotate-0 bg-white/5 border-white/10 hover:bg-gold-primary hover:text-black text-white" />
                      <CarouselNext className="relative bottom-0 left-0 translate-x-0 translate-y-0 rotate-0 bg-white/5 border-white/10 hover:bg-gold-primary hover:text-black text-white" />
                    </div>
                  </Carousel>
                ) : (
                  <EmptyHub icon={CalendarDays} message="لا توجد اجتماعات قريبة" />
                )}
              </motion.div>
            )}

            {activeTab === "tasks" && (
              <motion.div
                key="tasks"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full p-8 md:p-12"
              >
                <div className="flex flex-col md:flex-row items-center justify-between gap-10">
                  <div className="space-y-4 text-center md:text-right flex-1">
                    <div className="flex items-center justify-center md:justify-start gap-3 text-rose-400">
                      <ListChecks size={16} />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                        المسؤوليات الجارية
                      </span>
                    </div>
                    <h3 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight">
                      لديك {tasksCount} مهام قيد الإنجاز
                    </h3>
                    <div className="bg-white/5 border border-white/10 p-4 rounded-2xl inline-block max-w-md">
                      <p className="text-xs md:text-sm font-bold text-gold-primary/80 italic">
                        {getMotivationalNudge()}
                      </p>
                    </div>
                  </div>
                  <div className="w-full md:w-auto">
                    <Link
                      to="/tasks"
                      className="btn-gold px-12 py-5 rounded-full font-black text-sm shadow-2xl shadow-gold-primary/20 shrink-0 hover:scale-105 active:scale-95 transition-all block text-center"
                    >
                      لوحة المسؤوليات
                    </Link>
                  </div>
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
