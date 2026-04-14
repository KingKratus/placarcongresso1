import { useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AskAI } from "@/components/insights/AskAI";
import { useAuth } from "@/hooks/useAuth";

export function FloatingChat() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  // Build context from current page
  let pageContext = "";
  const path = location.pathname;
  if (path.startsWith("/deputado/")) {
    const id = path.split("/deputado/")[1];
    pageContext = `O usuário está visualizando o perfil do deputado com ID ${id} na Câmara dos Deputados.`;
  } else if (path.startsWith("/senador/")) {
    const id = path.split("/senador/")[1];
    pageContext = `O usuário está visualizando o perfil do senador com ID ${id} no Senado Federal.`;
  } else if (path === "/senado") {
    pageContext = "O usuário está na página do Senado Federal.";
  } else if (path === "/insights") {
    pageContext = "O usuário está na página de Insights.";
  } else if (path === "/") {
    pageContext = "O usuário está na página principal da Câmara dos Deputados.";
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] shadow-2xl rounded-xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          <AskAI userId={user?.id} floating context={pageContext || undefined} />
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
