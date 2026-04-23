import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

export interface InfograficoData {
  titulo: string;
  subtitulo?: string;
  metricas: { label: string; valor: string | number; hint?: string }[];
  destaques?: string[];
  rodape?: string;
}

interface Props {
  data: InfograficoData;
  filename?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
  className?: string;
}

export function InfograficoButton({
  data, filename = "infografico", variant = "outline", size = "sm", label = "Infográfico", className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [formato, setFormato] = useState<"card" | "relatorio">("card");
  const [loading, setLoading] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setImgUrl(null);
    try {
      const { data: resp, error } = await supabase.functions.invoke("gerar-infografico", {
        body: { formato, dados: data },
      });
      if (error) throw error;
      if (resp?.error) throw new Error(resp.error);
      if (!resp?.image) throw new Error("Sem imagem retornada");
      setImgUrl(resp.image);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha ao gerar infográfico");
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!imgUrl) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = `${filename}-${formato}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setImgUrl(null); } }}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <ImageIcon className="h-4 w-4 mr-1.5" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar Infográfico</DialogTitle>
          <DialogDescription>
            Imagem gerada via Google Gemini (API direta). Pode levar 10–30s.
          </DialogDescription>
        </DialogHeader>

        {!imgUrl && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider mb-2 block">Formato</Label>
              <RadioGroup value={formato} onValueChange={(v: any) => setFormato(v)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-start gap-3 border rounded-lg p-3 cursor-pointer hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <RadioGroupItem value="card" className="mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Cartão Social</p>
                    <p className="text-xs text-muted-foreground">1080×1350 — Instagram, redes</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 border rounded-lg p-3 cursor-pointer hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <RadioGroupItem value="relatorio" className="mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Relatório Analítico</p>
                    <p className="text-xs text-muted-foreground">A4 — denso, dashboard</p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
              <p className="font-bold">{data.titulo}</p>
              {data.subtitulo && <p className="text-muted-foreground">{data.subtitulo}</p>}
              <p className="text-muted-foreground pt-1">{data.metricas.length} métricas · {data.destaques?.length || 0} destaques</p>
            </div>
          </div>
        )}

        {imgUrl && (
          <div className="flex justify-center">
            <img src={imgUrl} alt={data.titulo} className="max-h-[60vh] rounded-md border" />
          </div>
        )}

        <DialogFooter className="gap-2">
          {!imgUrl ? (
            <Button onClick={generate} disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando…</> : "Gerar"}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setImgUrl(null)}>Refazer</Button>
              <Button onClick={download}><Download className="h-4 w-4 mr-2" /> Baixar PNG</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}