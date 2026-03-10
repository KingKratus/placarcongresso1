import { ShieldCheck, Search, RefreshCcw, LogIn, LogOut, User, Heart } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Partido } from "@/hooks/useDeputados";

interface NavbarProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  partyFilter: string;
  onPartyFilterChange: (v: string) => void;
  ano: number;
  onAnoChange: (v: number) => void;
  classFilter: string;
  onClassFilterChange: (v: string) => void;
  partidos: Partido[];
  loading: boolean;
  onRefresh: () => void;
  user: any;
  onSignIn: () => void;
  onSignOut: () => void;
  casa?: "camara" | "senado";
}

const ANOS = [2023, 2024, 2025, 2026];
const CLASSES = [
  { value: "", label: "Todos" },
  { value: "Governo", label: "Governo" },
  { value: "Centro", label: "Centro" },
  { value: "Oposição", label: "Oposição" },
  { value: "Sem Dados", label: "Sem Dados" },
];

export function Navbar({
  searchTerm, onSearchChange, partyFilter, onPartyFilterChange,
  ano, onAnoChange, classFilter, onClassFilterChange,
  partidos, loading, onRefresh, user, onSignIn, onSignOut, casa = "camara",
}: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isSenado = casa === "senado" || location.pathname.startsWith("/senado");
  const isInsights = location.pathname === "/insights";
  const isDocs = location.pathname === "/documentacao";
  const isPerfil = location.pathname === "/perfil";
  const isCamara = !isSenado && !isInsights && !isDocs && !isPerfil;

  const searchPlaceholder = isSenado ? "Buscar senador..." : isInsights ? "Buscar..." : "Buscar deputado...";

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50 px-4 py-3 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2.5 rounded-2xl shadow-lg">
            <ShieldCheck className="text-primary-foreground" size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black text-foreground tracking-tight leading-none uppercase">
              Monitor Legislativo
            </h1>
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mt-0.5">
              Alinhamento com o Líder do Governo
            </p>
          </div>
          <div className="flex ml-4 bg-muted rounded-lg p-0.5">
            <button onClick={() => navigate("/")}
              className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors ${
                isCamara ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              Câmara
            </button>
            <button onClick={() => navigate("/senado")}
              className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors ${
                isSenado ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              Senado
            </button>
            <button onClick={() => navigate("/insights")}
              className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors ${
                isInsights ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              Insights
            </button>
            <button onClick={() => navigate("/documentacao")}
              className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors ${
                isDocs ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              Docs
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-56">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
            <Input placeholder={searchPlaceholder} className="pl-10" value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} />
          </div>

          <Select value={String(ano)} onValueChange={(v) => onAnoChange(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={partyFilter} onValueChange={onPartyFilterChange}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Partido" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {partidos.map((p) => <SelectItem key={p.id} value={p.sigla}>{p.sigla}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={classFilter} onValueChange={onClassFilterChange}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Classificação" /></SelectTrigger>
            <SelectContent>
              {CLASSES.map((c) => <SelectItem key={c.value || "all"} value={c.value || "all"}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={onRefresh} title="Recarregar">
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
          </Button>

          {user ? (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => navigate("/perfil")} title="Meu Perfil">
                <Heart size={16} className={isPerfil ? "fill-destructive text-destructive" : ""} />
              </Button>
              <Button variant="ghost" size="sm" onClick={onSignOut} className="gap-2">
                <User size={16} /><span className="hidden sm:inline text-xs">Sair</span>
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={onSignIn} className="gap-2">
              <LogIn size={16} /><span className="hidden sm:inline text-xs">Login</span>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
