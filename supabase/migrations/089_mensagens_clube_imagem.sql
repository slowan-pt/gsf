-- A imagem anexada a um aviso só ia pro payload da notificação push
-- (richContent.image) e nunca era salva na mensagem em si — quem abria o
-- aviso depois (ou recebia sem notificação, ex. app fechado há dias) via
-- só o texto, sem imagem nenhuma. Agora a URL fica guardada junto.
ALTER TABLE public.mensagens_clube ADD COLUMN IF NOT EXISTS imagem_url TEXT;
