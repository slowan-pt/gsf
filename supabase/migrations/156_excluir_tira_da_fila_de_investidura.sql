-- 156_excluir_tira_da_fila_de_investidura.sql
-- Excluir uma especialidade ou classe da ficha tem que tirá-la também de "Aguardando investidura": ela só volta
-- quando for aprovada de novo. Antes, a especialidade/classe saía da ficha mas o item continuava na fila.
--
-- 1) Gatilhos (valem para QUALQUER caminho, não só para a tela da ficha):
--    - especialidade apagada, ou que deixa de estar OK  -> sai da fila de investidura (só o que ainda aguarda);
--    - classe que deixa de estar completa (a linha do fluxo de aprovação é apagada) -> idem.
--    O que já foi RECEBIDO (entregue) não é tocado por estes gatilhos.
-- 2) Limpeza única do que já ficou sobrando:
--    - especialidades aguardando sem a especialidade correspondente na ficha;
--    - classes aguardando cujo campo na ficha NÃO está OK e que não têm linha no fluxo de aprovação.
-- Requer as migrations 132 e 133.

-- ─── Especialidade ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.investidura_limpar_especialidade()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (OLD.status = 'OK' AND NEW.status IS DISTINCT FROM 'OK') THEN
    DELETE FROM public.investidura_itens
     WHERE clube_id = OLD.clube_id AND dbv_id = OLD.dbv_id AND tipo = 'especialidade'
       AND item_nome = OLD.nome AND aguardando = TRUE AND entregue = FALSE;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_investidura_limpar_especialidade ON public.especialidades;
CREATE TRIGGER trg_investidura_limpar_especialidade
AFTER DELETE OR UPDATE OF status ON public.especialidades
FOR EACH ROW EXECUTE FUNCTION public.investidura_limpar_especialidade();

-- ─── Classe ──────────────────────────────────────────────────────────────────
-- A linha de classe_aprovacoes é apagada quando a classe deixa de estar completa (recalcular_classe_receber).
CREATE OR REPLACE FUNCTION public.investidura_limpar_classe()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.investidura_itens
   WHERE clube_id = OLD.clube_id AND dbv_id = OLD.dbv_id AND tipo = 'classe'
     AND aguardando = TRUE AND entregue = FALSE
     AND public.fluxo_chave_item(item_nome) = OLD.item_nome;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_investidura_limpar_classe ON public.classe_aprovacoes;
CREATE TRIGGER trg_investidura_limpar_classe
AFTER DELETE ON public.classe_aprovacoes
FOR EACH ROW EXECUTE FUNCTION public.investidura_limpar_classe();

-- ─── Limpeza única do que já sobrou ─────────────────────────────────────────
-- Especialidade aguardando que não existe mais na ficha do membro (a especialidade é sempre gravada ANTES do item).
DELETE FROM public.investidura_itens i
 WHERE i.tipo = 'especialidade' AND i.aguardando = TRUE AND i.entregue = FALSE
   AND NOT EXISTS (
     SELECT 1 FROM public.especialidades e
      WHERE e.clube_id = i.clube_id AND e.dbv_id = i.dbv_id AND e.nome = i.item_nome
   );

-- Campo da tabela progresso_classes de cada nome de classe (as mesmas grafias que o app usa).
CREATE OR REPLACE FUNCTION public.investidura_campo_classe(p_nome text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE public.mestrado_norm(regexp_replace(coalesce(p_nome, ''), '\s*-\s*agrupadas\s*$', '', 'i'))
    WHEN 'amigo' THEN 'amigo'
    WHEN 'amigo da natureza' THEN 'amigo_nat'
    WHEN 'companheiro' THEN 'companheiro'
    WHEN 'comp. excursionista' THEN 'comp_exc'
    WHEN 'companheiro de excursionismo' THEN 'comp_exc'
    WHEN 'pesquisador' THEN 'pesquisador'
    WHEN 'pesquisador c.b.' THEN 'pesquisador_cb'
    WHEN 'pesquisador de campos e bosques' THEN 'pesquisador_cb'
    WHEN 'pesquisador de campo e bosque' THEN 'pesquisador_cb'
    WHEN 'pioneiro' THEN 'pioneiro'
    WHEN 'pioneiro n.f.' THEN 'pioneiro_nf'
    WHEN 'pioneiro de novas fronteiras' THEN 'pioneiro_nf'
    WHEN 'excursionista' THEN 'excursionista'
    WHEN 'exc. da mata' THEN 'exc_mata'
    WHEN 'excursionista na mata' THEN 'exc_mata'
    WHEN 'guia' THEN 'guia'
    WHEN 'guia exploracao' THEN 'guia_exp'
    WHEN 'guia de exploracao' THEN 'guia_exp'
    WHEN 'agrupada' THEN 'agrupada'
    WHEN 'lider' THEN 'lider'
    WHEN 'lider master' THEN 'lider_master'
    WHEN 'lider ma' THEN 'lider_ma'
    ELSE NULL
  END
$$;

-- Classe aguardando cujo campo na ficha NÃO está OK e que não passou pelo fluxo de aprovação (foi marcada à mão).
DELETE FROM public.investidura_itens i
 USING public.progresso_classes pc
 WHERE i.tipo = 'classe' AND i.aguardando = TRUE AND i.entregue = FALSE
   AND pc.clube_id = i.clube_id AND pc.dbv_id = i.dbv_id
   AND public.investidura_campo_classe(i.item_nome) IS NOT NULL
   AND COALESCE(to_jsonb(pc) ->> public.investidura_campo_classe(i.item_nome), '') <> 'OK'
   AND NOT EXISTS (
     SELECT 1 FROM public.classe_aprovacoes a
      WHERE a.clube_id = i.clube_id AND a.dbv_id = i.dbv_id AND a.item_nome = public.fluxo_chave_item(i.item_nome)
   );
