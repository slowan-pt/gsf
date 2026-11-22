CREATE OR REPLACE FUNCTION public.publicar_termo_lgpd(
  p_titulo text,
  p_conteudo text,
  p_termo_atual bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_atual bigint;
  v_versao integer;
BEGIN
  IF COALESCE(btrim(p_titulo), '') = '' OR COALESCE(btrim(p_conteudo), '') = '' THEN
    RAISE EXCEPTION 'Informe título e conteúdo do termo.';
  END IF;

  IF COALESCE(public.current_user_perfil(), '') NOT IN ('admin_total', 'admin_geral', 'admin_diretoria') THEN
    RAISE EXCEPTION 'Sem permissão para publicar o termo.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(174, 1);
  SELECT id INTO v_atual FROM public.lgpd_termos WHERE ativo;
  IF v_atual IS DISTINCT FROM p_termo_atual THEN
    RAISE EXCEPTION 'O termo vigente mudou. Atualize a tela e revise a versão antes de publicar.';
  END IF;

  SELECT COALESCE(MAX(versao), 0) + 1 INTO v_versao FROM public.lgpd_termos;
  IF v_atual IS NOT NULL THEN
    UPDATE public.lgpd_termos SET ativo = false, updated_at = now() WHERE id = v_atual;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Não foi possível substituir o termo vigente.';
    END IF;
  END IF;

  INSERT INTO public.lgpd_termos (titulo, conteudo, versao, ativo, criado_por)
  VALUES (btrim(p_titulo), btrim(p_conteudo), v_versao, true, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.publicar_termo_lgpd(text, text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publicar_termo_lgpd(text, text, bigint) TO authenticated;
