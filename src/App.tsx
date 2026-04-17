import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Senado from "./pages/Senado";
import Insights from "./pages/Insights";
import DeputadoDetail from "./pages/DeputadoDetail";
import SenadorDetail from "./pages/SenadorDetail";
import Perfil from "./pages/Perfil";
import NotFound from "./pages/NotFound";
import Documentacao from "./pages/Documentacao";
import Admin from "./pages/Admin";
import Desempenho from "./pages/Desempenho";
import { FloatingChat } from "./components/FloatingChat";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/senado" element={<Senado />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/documentacao" element={<Documentacao />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/desempenho" element={<Desempenho />} />
          <Route path="/deputado/:id" element={<DeputadoDetail />} />
          <Route path="/senador/:id" element={<SenadorDetail />} />
          <Route path="/perfil" element={<Perfil />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <FloatingChat />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
