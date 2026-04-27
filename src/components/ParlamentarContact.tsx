import { useEffect, useMemo, useState } from "react";
import { Mail, Phone, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  parlamentarId: number;
  casa: "camara" | "senado";
  email?: string | null;
  compact?: boolean;
}

interface ContactInfo {
  email: string | null;
  telefone: string | null;
  gabinete: string | null;
  pagina: string | null;
}

const emptyContact: ContactInfo = { email: null, telefone: null, gabinete: null, pagina: null };

export function ParlamentarContact({ parlamentarId, casa, email, compact = false }: Props) {
  const [contact, setContact] = useState<ContactInfo>({ ...emptyContact, email: email || null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!parlamentarId) return;
      setLoading(true);
      try {
        if (casa === "camara") {
          const res = await fetch(`https://dadosabertos.camara.leg.br/api/v2/deputados/${parlamentarId}`, { headers: { Accept: "application/json" } });
          const json = res.ok ? await res.json() : null;
          const d = json?.dados || {};
          if (alive) setContact({
            email: d.ultimoStatus?.gabinete?.email || d.email || email || null,
            telefone: d.ultimoStatus?.gabinete?.telefone || null,
            gabinete: [d.ultimoStatus?.gabinete?.nome, d.ultimoStatus?.gabinete?.predio].filter(Boolean).join(" · ") || null,
            pagina: d.uri || `https://www.camara.leg.br/deputados/${parlamentarId}`,
          });
        } else {
          const res = await fetch(`https://legis.senado.leg.br/dadosabertos/senador/${parlamentarId}.json`, { headers: { Accept: "application/json" } });
          const json = res.ok ? await res.json() : null;
          const p = json?.DetalheParlamentar?.Parlamentar || {};
          const id = p?.IdentificacaoParlamentar || {};
          const mand = Array.isArray(p?.Mandatos?.Mandato) ? p.Mandatos.Mandato[0] : p?.Mandatos?.Mandato;
          const exerc = Array.isArray(mand?.Exercicios?.Exercicio) ? mand.Exercicios.Exercicio[0] : mand?.Exercicios?.Exercicio;
          if (alive) setContact({
            email: id.EmailParlamentar || email || null,
            telefone: exerc?.TelefoneGabinete || exerc?.Telefone || null,
            gabinete: exerc?.CodigoGabinete ? `Gabinete ${exerc.CodigoGabinete}` : null,
            pagina: id.UrlPaginaParlamentar || `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${parlamentarId}`,
          });
        }
      } catch {
        if (alive) setContact((prev) => ({ ...prev, email: prev.email || email || null }));
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [parlamentarId, casa, email]);

  const hasAny = useMemo(() => !!(contact.email || contact.telefone || contact.gabinete || contact.pagina), [contact]);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {loading && <Loader2 size={11} className="animate-spin text-muted-foreground" />}
        {contact.email && <a href={`mailto:${contact.email}`} className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"><Mail size={10} /> Email</a>}
        {contact.telefone && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Phone size={10} /> {contact.telefone}</span>}
        {!loading && !hasAny && <span className="text-[10px] text-muted-foreground">Contato oficial indisponível</span>}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-background/60 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contato oficial</p>
        {loading && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {contact.email && <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1"><a href={`mailto:${contact.email}`}><Mail size={13} /> {contact.email}</a></Button>}
        {contact.telefone && <Badge variant="secondary" className="gap-1"><Phone size={12} /> {contact.telefone}</Badge>}
        {contact.gabinete && <Badge variant="outline">{contact.gabinete}</Badge>}
        {contact.pagina && <Button asChild variant="ghost" size="sm" className="h-8 text-xs gap-1"><a href={contact.pagina} target="_blank" rel="noopener noreferrer">Página oficial <ExternalLink size={12} /></a></Button>}
        {!loading && !hasAny && <p className="text-xs text-muted-foreground">Contato oficial indisponível nas bases públicas.</p>}
      </div>
    </div>
  );
}
