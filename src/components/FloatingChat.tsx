import { useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AskAI } from "@/components/insights/AskAI";
import { useAuth } from "@/hooks/useAuth";

export function FloatingChat() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] shadow-2xl rounded-xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          <AskAI userId={user?.id} floating />
        </div>
      )}
      <Button
        onClick={() => setOpen(!open)}
        size="icon"
        className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-lg"
      >
        {open ? <X size={22} /> : <MessageSquare size={22} />}
      </Button>
    </>
  );
}
