import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { format, isSameDay } from "date-fns";
import { arSA } from "date-fns/locale";
import { MapPin, Clock, Navigation } from "lucide-react";

interface Meeting {
  id: string;
  title: string;
  scheduled_at: string;
  location: string | null;
  location_url: string | null;
  description: string | null;
}

export function MeetingCalendar({ meetings }: { meetings: Meeting[] }) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const meetingsOnSelectedDate = meetings.filter((m) =>
    selectedDate ? isSameDay(new Date(m.scheduled_at), selectedDate) : false
  );

  const daysWithMeetings = meetings.map((m) => new Date(m.scheduled_at));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 animate-fade-up">
      <div className="card-surface p-6 md:p-8">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          locale={arSA}
          className="w-full"
          modifiers={{ hasMeeting: daysWithMeetings }}
          modifiersClassNames={{
            hasMeeting: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:bg-gold-primary after:rounded-full font-black text-primary"
          }}
        />
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
           <h3 className="text-xl font-black text-primary">لقاءات {selectedDate ? format(selectedDate, "d MMMM", { locale: arSA }) : ""}</h3>
           <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black">{meetingsOnSelectedDate.length} مناسبة</span>
        </div>

        <div className="space-y-4 max-h-[500px] overflow-y-auto no-scrollbar pr-2">
           <AnimatePresence mode="popLayout">
              {meetingsOnSelectedDate.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-10 text-center bg-muted/20 rounded-[32px] border-2 border-dashed border-border/40"
                >
                   <p className="text-muted-foreground font-bold italic">لا توجد اجتماعات مجدولة لهذا اليوم.</p>
                </motion.div>
              ) : (
                meetingsOnSelectedDate.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="p-5 bg-card border border-border/60 rounded-[24px] hover:border-gold-primary/40 transition-all shadow-sm group"
                  >
                     <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                           <h4 className="font-black text-foreground truncate group-hover:text-primary transition-colors">{m.title}</h4>
                           <div className="flex items-center gap-3 text-[11px] font-bold text-muted-foreground">
                              <span className="flex items-center gap-1"><Clock size={12} className="text-gold-primary" /> {format(new Date(m.scheduled_at), "p", { locale: arSA })}</span>
                              {m.location && <span className="flex items-center gap-1 truncate"><MapPin size={12} className="text-gold-primary" /> {m.location}</span>}
                           </div>
                        </div>
                        {m.location_url && (
                          <a
                            href={m.location_url}
                            target="_blank"
                            rel="noreferrer"
                            className="size-8 rounded-full bg-primary/5 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                          >
                             <Navigation size={14} />
                          </a>
                        )}
                     </div>
                     {m.description && <p className="mt-3 text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">{m.description}</p>}
                  </motion.div>
                ))
              )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
