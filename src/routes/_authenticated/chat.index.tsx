import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat")({
  ssr: false,
  component: ChatEmpty,
});

function ChatEmpty() {
  return (
    <div className="flex-1 grid place-items-center text-center px-6">
      <div className="space-y-3 max-w-sm">
        <div className="size-16 rounded-2xl bg-gold-primary/10 ring-1 ring-gold-primary/20 grid place-items-center mx-auto">
          <MessageCircle className="size-8 text-gold-primary" strokeWidth={1.5} />
        </div>
        <h3 className="text-lg font-medium text-ivory">اختر محادثة</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          اختر محادثة من القائمة أو ابدأ محادثة فردية أو جماعية جديدة من الأعلى.
        </p>
      </div>
    </div>
  );
}
