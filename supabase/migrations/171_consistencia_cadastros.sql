BEGIN;

CREATE OR REPLACE FUNCTION public.alterar_unidade_com_membros(
  p_clube_id integer, p_unidade_id integer, p_nome text, p_cor text, p_excluir boolean
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_nome text;
BEGIN
  SELECT nome INTO STRICT v_nome FROM public.unidades
  WHERE id = p_unidade_id AND clube_id = p_clube_id FOR UPDATE;

  IF p_excluir IS TRUE THEN
    UPDATE public.desbravadores
    SET unidade_id = NULL, unidade_nome = NULL, updated_at = now()
    WHERE clube_id = p_clube_id AND (unidade_id = p_unidade_id
      OR (unidade_id IS NULL AND unidade_nome = v_nome));
    DELETE FROM public.unidades WHERE id = p_unidade_id AND clube_id = p_clube_id;
  ELSE
    IF nullif(btrim(p_nome), '') IS NULL THEN
      RAISE EXCEPTION 'Informe o nome da unidade.';
    END IF;
    UPDATE public.unidades SET nome = btrim(p_nome), cor = p_cor
    WHERE id = p_unidade_id AND clube_id = p_clube_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A unidade não está disponível para edição.';
    END IF;
    UPDATE public.desbravadores SET unidade_nome = btrim(p_nome), updated_at = now()
    WHERE clube_id = p_clube_id AND (unidade_id = p_unidade_id
      OR (unidade_id IS NULL AND unidade_nome = v_nome));
    RETURN;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A unidade não está disponível para exclusão.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.alterar_unidade_com_membros(integer, integer, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.alterar_unidade_com_membros(integer, integer, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.enviar_pre_cadastro(
  p_token text, p_dados jsonb, p_responsaveis jsonb, p_aceite boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_link public.pre_cadastro_links%ROWTYPE;
  v_id uuid;
  v_principal jsonb;
BEGIN
  IF p_aceite IS DISTINCT FROM TRUE OR nullif(btrim(p_dados->>'nome'), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome e aceite o termo.';
  END IF;
  IF jsonb_typeof(p_responsaveis) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Informe pelo menos um responsável.';
  END IF;
  IF jsonb_array_length(p_responsaveis) = 0 OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_responsaveis) AS r(dados)
    WHERE nullif(btrim(r.dados->>'nome'), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Informe o nome de cada responsável.';
  END IF;

  SELECT * INTO v_link FROM public.pre_cadastro_links WHERE token = p_token
    AND ativo AND (expira_em IS NULL OR expira_em > now()) FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link de pré-cadastro indisponível ou expirado.';
  END IF;

  v_principal := p_responsaveis->0;
  INSERT INTO public.pre_cadastros (
    clube_id, link_id, nome, data_nascimento, genero, email, contato, camisa, calca,
    nome_responsavel, email_responsavel, contato_responsavel, parentesco_responsavel,
    observacoes, lgpd_aceito, lgpd_aceito_em
  ) VALUES (
    v_link.clube_id, v_link.id, btrim(p_dados->>'nome'), nullif(p_dados->>'data_nascimento', '')::date,
    nullif(p_dados->>'genero', ''), nullif(btrim(p_dados->>'email'), ''),
    nullif(btrim(p_dados->>'contato'), ''), nullif(btrim(p_dados->>'camisa'), ''),
    nullif(btrim(p_dados->>'calca'), ''), btrim(v_principal->>'nome'),
    nullif(lower(btrim(v_principal->>'email')), ''), nullif(btrim(v_principal->>'telefone'), ''),
    coalesce(nullif(btrim(v_principal->>'parentesco'), ''), 'Responsável'),
    nullif(btrim(p_dados->>'observacoes'), ''), true, now()
  ) RETURNING id INTO v_id;

  INSERT INTO public.pre_cadastro_responsaveis (
    pre_cadastro_id, clube_id, nome, email, telefone, parentesco, responsavel_principal
  )
  SELECT v_id, v_link.clube_id, btrim(dados->>'nome'),
    nullif(lower(btrim(dados->>'email')), ''), nullif(btrim(dados->>'telefone'), ''),
    coalesce(nullif(btrim(dados->>'parentesco'), ''), 'Responsável'), ordem = 1
  FROM jsonb_array_elements(p_responsaveis) WITH ORDINALITY AS r(dados, ordem);
END;
$$;

REVOKE ALL ON FUNCTION public.enviar_pre_cadastro(text, jsonb, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enviar_pre_cadastro(text, jsonb, jsonb, boolean) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.preparar_conversao_pre_cadastro(
  p_clube_id integer, p_pre_id uuid, p_idade integer, p_cargo text
) RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_pre public.pre_cadastros%ROWTYPE;
  v_id bigint;
BEGIN
  SELECT * INTO v_pre FROM public.pre_cadastros
  WHERE id = p_pre_id AND clube_id = p_clube_id FOR UPDATE;
  IF NOT FOUND OR v_pre.status NOT IN ('novo', 'em_analise', 'aprovado') THEN
    RAISE EXCEPTION 'Pré-cadastro indisponível para aprovação.';
  END IF;
  IF v_pre.convertido_membro_id IS NOT NULL THEN
    RETURN v_pre.convertido_membro_id;
  END IF;

  INSERT INTO public.desbravadores (
    clube_id, idx, nome, data_nascimento, idade, genero, cargo, contato, email,
    camisa, calca, nome_responsavel, contato_responsavel
  ) SELECT p_clube_id, coalesce(max(idx), 0) + 1, v_pre.nome, v_pre.data_nascimento,
    p_idade, v_pre.genero, p_cargo, v_pre.contato, v_pre.email,
    v_pre.camisa, v_pre.calca, v_pre.nome_responsavel, v_pre.contato_responsavel
    FROM public.desbravadores WHERE clube_id = p_clube_id
    RETURNING id INTO v_id;

  INSERT INTO public.documentos (dbv_id, clube_id) VALUES (v_id, p_clube_id)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.progresso_classes (dbv_id, clube_id) VALUES (v_id, p_clube_id)
    ON CONFLICT DO NOTHING;
  UPDATE public.pre_cadastros SET convertido_membro_id = v_id, updated_at = now()
    WHERE id = p_pre_id AND clube_id = p_clube_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível vincular o novo membro ao pré-cadastro.';
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_conversao_pre_cadastro(integer, uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preparar_conversao_pre_cadastro(integer, uuid, integer, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
