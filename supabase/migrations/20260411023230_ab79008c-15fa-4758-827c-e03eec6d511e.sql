
CREATE TABLE public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  context TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
ON public.chat_conversations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
ON public.chat_conversations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
ON public.chat_conversations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
ON public.chat_conversations FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_chat_conversations_updated_at
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
