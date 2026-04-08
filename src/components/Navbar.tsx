import { ShieldCheck, Search, RefreshCcw, LogIn, LogOut, User, Heart, SlidersHorizontal, X, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdminUser(false); return; }
    supabase.rpc("has_role", { _role: "admin" as const }).then(({ data }) => setIsAdminUser(!!data));
  }, [user]);

  const isSenado = casa === "senado" || location.pathname.startsWith("/senado");
  const isInsights = location.pathname === "/insights";
  const isDocs = location.pathname === "/documentacao";
  const isPerfil = location.pathname === "/perfil";
  const isAdminPage = location.pathname === "/admin";
  const isCamara = !isSenado && !isInsights && !isDocs && !isPerfil && !isAdminPage;

  const searchPlaceholder = isSenado ? "Buscar senador..." : isInsights ? "Buscar..." : "Buscar deputado...";

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50 px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col gap-2 sm:gap-4">
        {/* Top row: Logo + tabs + user actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="bg-primary p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl shadow-lg shrink-0">
              <ShieldCheck className="text-primary-foreground" size={isMobile ? 18 : 22} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-black text-foreground tracking-tight leading-none uppercase truncate">
                Monitor Legislativo
              </h1>
              <p className="text-[8px] sm:text-[10px] font-bold text-primary uppercase tracking-[0.15em] sm:tracking-[0.2em] mt-0.5 truncate">
                Alinhamento com o Líder do Governo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={() => setFiltersOpen(!filtersOpen)} className="h-8 w-8">
                {filtersOpen ? <X size={16} /> : <SlidersHorizontal size={16} />}
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={onRefresh} title="Recarregar" className="h-8 w-8">
              <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            </Button>
            {user ? (
              <>
                <Button variant="ghost" size="icon" onClick={() => navigate("/perfil")} title="Meu Perfil" className="h-8 w-8">
                  <Heart size={14} className={isPerfil ? "fill-destructive text-destructive" : ""} />
                </Button>
                <Button variant="ghost" size="icon" onClick={onSignOut} className="h-8 w-8">
                  <LogOut size={14} />
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={onSignIn} className="gap-1 h-8 text-xs px-2">
                <LogIn size={14} />
                <span className="hidden sm:inline">Login</span>
              </Button>
            )}
          </div>
        </div>

        {/* Nav tabs - scrollable */}
        <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4 scrollbar-none">
          <div className="flex bg-muted rounded-lg p-0.5 w-max min-w-full">
            {[
              { path: "/", label: "Câmara", active: isCamara },
              { path: "/senado", label: "Senado", active: isSenado },
              { path: "/insights", label: "Insights", active: isInsights },
              { path: "/documentacao", label: "Docs", active: isDocs },
              ...(isAdminUser ? [{ path: "/admin", label: "Admin", active: isAdminPage }] : []),
            ].map((tab) => (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors whitespace-nowrap ${
                  tab.active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters - collapsible on mobile */}
        {(!isMobile || filtersOpen) && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-2 text-muted-foreground" size={14} />
              <Input placeholder={searchPlaceholder} className="pl-9 h-8 text-xs" value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} />
            </div>

            <Select value={String(ano)} onValueChange={(v) => onAnoChange(Number(v))}>
              <SelectTrigger className="w-20 sm:w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANOS.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={partyFilter} onValueChange={onPartyFilterChange}>
              <SelectTrigger className="w-24 sm:w-32 h-8 text-xs"><SelectValue placeholder="Partido" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {partidos.map((p, i) => <SelectItem key={`${p.sigla}-${i}`} value={p.sigla}>{p.sigla}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={classFilter} onValueChange={onClassFilterChange}>
              <SelectTrigger className="w-28 sm:w-32 h-8 text-xs"><SelectValue placeholder="Classificação" /></SelectTrigger>
              <SelectContent>
                {CLASSES.map((c) => <SelectItem key={c.value || "all"} value={c.value || "all"}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </nav>
  );
}
