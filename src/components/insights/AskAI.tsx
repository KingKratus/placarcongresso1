import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Loader2, Sparkles, Plus, Trash2, MessageSquare, History, Wrench } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

interface Conversation {
  id: string;
  title: string;
  messages: Msg[];
  updated_at: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-ai`;

const SUGGESTIONS = [
  "Quais partidos mais mudaram de posição entre 2023 e 2025?",
  "Analise o alinhamento do PL com o governo",
  "Quais temas dominaram as votações este ano?",
  "Compare Câmara e Senado em termos de governismo",
];

interface Props {
  context?: string;
  userId?: string;
  floating?: boolean;
}

export function AskAI({ context, userId, floating }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("chat_conversations")
      .select("id, title, messages, updated_at")
      .order("updated_at", { ascending: false })
      .limit(20);
    if (data) setConversations(data as unknown as Conversation[]);
  }, [userId]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const saveConversation = useCallback(async (msgs: Msg[], convId: string | null) => {
    if (!userId || msgs.length === 0) return convId;
    const title = msgs[0]?.content?.slice(0, 60) || "Nova conversa";
    if (convId) {
      await supabase.from("chat_conversations").update({ messages: msgs as any, title }).eq("id", convId);
      return convId;
    } else {
      const { data } = await supabase.from("chat_conversations")
        .insert({ user_id: userId, title, messages: msgs as any, context })
        .select("id").single();
      const newId = data?.id || null;
      if (newId) setActiveConvId(newId);
      loadConversations();
      return newId;
    }
  }, [userId, context, loadConversations]);

  const loadConversation = (conv: Conversation) => {
    setMessages(conv.messages);
    setActiveConvId(conv.id);
    setShowHistory(false);
  };

  const newConversation = () => {
    setMessages([]);
    setActiveConvId(null);
    setShowHistory(false);
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("chat_conversations").delete().eq("id", id);
    if (activeConvId === id) newConversation();
    loadConversations();
  };

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Msg = { role: "user", content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    setToolStatus(null);

    let currentConvId = activeConvId;

    try {
      // Modo avançado: tool-calling não-streaming
      if (advancedMode) {
        setToolStatus("Pesquisando dados e web...");
        const { data, error } = await supabase.functions.invoke("ask-ai-tools", {
          body: { messages: updatedMessages },
        });
        if (error) throw error;
        const finalContent = data?.content || "Sem resposta";
        const finalMsgs: Msg[] = [...updatedMessages, { role: "assistant", content: finalContent }];
        setMessages(finalMsgs);
        currentConvId = await saveConversation(finalMsgs, currentConvId);
        setIsLoading(false);
        setToolStatus(null);
        return;
      }

      // Modo padrão: streaming
      const customAiKey = localStorage.getItem("custom_ai_key") || "";
      const customAiProvider = localStorage.getItem("custom_ai_provider") || "openai";

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: updatedMessages,
          context,
          custom_api_key: customAiKey || undefined,
          custom_provider: customAiKey ? customAiProvider : undefined,
        }),
      });

      if (!resp.ok || !resp.body) {
        const errorData = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        const errMsgs = [...updatedMessages, { role: "assistant" as const, content: `❌ ${errorData.error || "Erro ao conectar com a IA"}` }];
        setMessages(errMsgs);
        setIsLoading(false);
        return;
      }

      let assistantSoFar = "";
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      const finalMsgs = [...updatedMessages, { role: "assistant" as const, content: assistantSoFar }];
      currentConvId = await saveConversation(finalMsgs, currentConvId);
    } catch (e) {
      console.error("AI stream error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: "❌ Erro de conexão com o serviço de IA." }]);
    } finally {
      setIsLoading(false);
      setToolStatus(null);
    }
  };

  const height = floating ? "h-[480px]" : "h-[600px]";

  return (
    <Card className={`flex flex-col ${height}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            Análise Legislativa com IA
          </CardTitle>
          <div className="flex gap-1">
            {userId && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(!showHistory)} title="Histórico">
                  <History size={14} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={newConversation} title="Nova conversa">
                  <Plus size={14} />
                </Button>
              </>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Powered by Lovable AI · Faça perguntas sobre o Congresso</p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 gap-3">
        {showHistory && userId ? (
          <div className="flex-1 overflow-y-auto space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Conversas anteriores</p>
            {conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma conversa salva</p>
            ) : conversations.map((c) => (
              <div key={c.id}
                className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer hover:bg-accent/50 text-xs ${activeConvId === c.id ? "bg-accent" : ""}`}
                onClick={() => loadConversation(c)}>
                <div className="flex items-center gap-2 truncate flex-1">
                  <MessageSquare size={12} className="shrink-0 text-muted-foreground" />
                  <span className="truncate">{c.title}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 opacity-50 hover:opacity-100" onClick={(e) => deleteConversation(c.id, e)}>
                  <Trash2 size={10} />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <Bot size={40} className="text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Faça uma pergunta sobre os dados legislativos</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {SUGGESTIONS.map((s, i) => (
                      <Button key={i} variant="outline" size="sm" className="text-xs h-auto py-1.5 px-3 whitespace-normal text-left"
                        onClick={() => send(s)}>
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                      <Bot size={14} className="text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                      <User size={14} className="text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Loader2 size={14} className="text-primary animate-spin" />
                  </div>
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">Pensando...</div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex: Qual o alinhamento médio do MDB com o governo?"
                className="min-h-[40px] max-h-[100px] text-sm resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
                }}
              />
              <Button size="icon" onClick={() => send(input)} disabled={!input.trim() || isLoading} className="shrink-0 h-10 w-10">
                <Send size={16} />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
