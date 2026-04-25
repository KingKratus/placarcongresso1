import { useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ReportPayload {
  title: string;
  summary: string;
  sections?: string[];
  url?: string;
}

export function ReportEmailButton({ report, size = "sm" }: { report: ReportPayload; size?: "sm" | "default" }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(user?.email || "");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast({ title: "Email inválido", description: "Informe um destinatário válido.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "relatorio-legislativo-completo",
          recipientEmail: email,
          idempotencyKey: `relatorio-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          templateData: { ...report, url: report.url || window.location.href },
        },
      });
      if (error) throw error;
      toast({ title: "Relatório enviado", description: `Enviado para ${email}.` });
      setOpen(false);
    } catch (e: any) {
      toast({
        title: "Configuração de email necessária",
        description: "O botão está pronto, mas o domínio de envio ainda precisa ser configurado em Cloud → Emails.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button size={size} variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Mail size={14} /> Enviar relatório
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Enviar relatório por email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-sm font-bold">{report.title}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{report.summary}</p>
            </div>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="destinatario@email.com" inputMode="email" />
            <Button className="w-full gap-2" onClick={send} disabled={sending}>
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              Enviar relatório completo
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Se o envio ainda não estiver ativo, configure primeiro o domínio remetente em Cloud → Emails.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
