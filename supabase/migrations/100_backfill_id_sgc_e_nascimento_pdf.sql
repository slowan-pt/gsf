-- Preenche id_sgc (e corrige data_nascimento/idade quando divergente) para
-- todos os membros do clube, a partir da planilha oficial exportada do SGC
-- ("Lista de Membros_SGC_Set26.pdf"). Casamento por nome, tolerante a
-- diferenças de acento, maiúsculas/minúsculas, espaços e apóstrofos (ex.:
-- "Sant'Anna" e "SANT ANNA" batem com o mesmo slug), já que o PDF vem todo
-- em caixa alta e sem os mesmos separadores do cadastro.
--
-- public.unaccent_simples já existe (migration 059_classes_requisitos.sql).
--
-- Esta migration só toca id_sgc, data_nascimento e idade — NÃO mexe em cargo
-- (o PDF usa rótulos como "SEGURANÇA DO CLUBE"/"CONSELHEIRO ASSOCIADO" que
-- não necessariamente batem 1:1 com os cargos aceitos pelo app, e cargo
-- influencia perfil de acesso; revisar cargo é mais seguro pela própria
-- ficha do membro do que por UPDATE em massa).
DO $$
DECLARE
  registro RECORD;
  atualizados INT := 0;
  sem_correspondencia TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR registro IN
    SELECT * FROM (VALUES
      ('2408162', 'ÁGATHA MIRANDA DE JESUS', '2008-04-13'::date),
      ('610049', 'ALICE DE SOUZA MIRANDA', '2011-09-12'::date),
      ('2949976', 'ANA LUIZA AVELLAR', '2012-10-31'::date),
      ('3027489', 'ANA LUIZA BATISTA DE PAULA', '2013-09-02'::date),
      ('1945641', 'BENJAMIN OLIVEIRA ROCHA', '2016-02-28'::date),
      ('3111429', 'BERNARDO RAMOS ALVES PEREIRA', '2014-09-05'::date),
      ('2473533', 'CAETANO CHAVES ALIFIAS', '2012-12-05'::date),
      ('3089935', 'CÁSSIA JAEL CONDORI MALPARTIDA', '2002-08-19'::date),
      ('123531', 'CESAR HILARION CONDORI ADUVIRI', '1975-10-21'::date),
      ('3055579', 'CESSIA VERÔNICA MALPARTIDA CONDORI', '2000-10-13'::date),
      ('2273952', 'DANIEL AZEREDO COELHO PIRES', '2015-01-20'::date),
      ('3100294', 'DAVI CARNEIRO SANT ANNA TEIXEIRA', '2012-06-18'::date),
      ('1080566', 'DAVI VITOR DE LIMA MARTINS', '2013-10-24'::date),
      ('123537', 'DENNIS JUAN ACETI DA SILVA', '1998-07-18'::date),
      ('1798979', 'DIOGO GABRIEL ACETI PEREIRA', '2008-10-06'::date),
      ('1495045', 'ENDERSON ELIAS MODESTO DOS SANTOS', '2008-10-10'::date),
      ('3092231', 'ENZO GUIMARÃES VIEIRA', '2014-12-05'::date),
      ('2277107', 'ESTHER AZEREDO COELHO PIRES', '2010-03-18'::date),
      ('2309147', 'FERNANDO DO ESPÍRITO SANTO DE MEDEIROS', '1966-12-20'::date),
      ('123476', 'FRANCISCO JOSÉ DE SOUSA ROCHA', '1975-03-17'::date),
      ('915738', 'GABRIEL DE LIMA MARTINS', '2006-10-20'::date),
      ('1414869', 'GABRIELA GUERRA MAIA', '2013-04-24'::date),
      ('1660976', 'ISABELLE DA SILVA NASCIMENTO', '2013-11-06'::date),
      ('2067462', 'JEAN CARLOS BRAGA GUIMARÃES', '1979-04-22'::date),
      ('960145', 'JOÃO GABRIEL OLIVEIRA ROSA', '2011-12-15'::date),
      ('1563046', 'JÚLIA SILVA FELIZOLA', '2013-03-19'::date),
      ('1949283', 'KALLYNE BITIATO GUIMARÃES', '2016-03-10'::date),
      ('2044904', 'KAUANE LIMA PACHECO', '2013-06-03'::date),
      ('2129524', 'KHALED RIBEIRO NASCIMENTO', '2016-05-03'::date),
      ('3055577', 'LARISSA CASTILHO BEZERRA LIMA', '1997-02-07'::date),
      ('1983661', 'LAURA ALVES PECLY', '2015-04-20'::date),
      ('1903252', 'LAURA HELENA PEDROSA RODRIGUES DA SILVA', '2010-04-27'::date),
      ('1904611', 'LUCAS BORGES DE ANDRADE', '2010-10-28'::date),
      ('1231224', 'LUCIANO NUNES MAIA', '1981-04-07'::date),
      ('1501674', 'LUIS GUSTAVO RIBEIRO DE SOUZA', '2011-10-16'::date),
      ('1978278', 'LUISY PEDROSA RODRIGUES ZAGO', '2015-12-18'::date),
      ('2337649', 'LUIZ MIGUEL DA SILVA DO AMARAL E SOUZA', '2011-10-14'::date),
      ('919374', 'MANUELA GUERRA MAIA', '2011-07-22'::date),
      ('1821079', 'MARCUS MILLER NASCIMENTO E SILVA', '2006-01-31'::date),
      ('581777', 'MARIA EDUARDA DE SOUZA MIRANDA', '2006-10-12'::date),
      ('951949', 'MARIANE SILVA QUIDORNE', '2007-04-28'::date),
      ('2357132', 'MATEUS RIBEIRO DE SOUZA', '2016-05-19'::date),
      ('1680143', 'MIGUEL JOAQUIM ARAUJO DE OLIVEIRA', '2014-02-13'::date),
      ('1231244', 'MILLENA GUERRA LOURENÇO NUNES MAIA', '1977-03-19'::date),
      ('2467505', 'MONIQUE RIBEIRO DE MOURA', '1992-03-02'::date),
      ('382297', 'NATHALY REIS PACHECO', '2011-11-24'::date),
      ('382339', 'NICOLAS COSTA GONÇALVES', '2010-07-13'::date),
      ('2206363', 'PEDRO DOMINGOS VENANCIO', '2010-09-13'::date),
      ('2102040', 'PEDRO FROSSARD PINHEL', '2014-05-05'::date),
      ('1723533', 'POLIANA PESSANHA DA SILVA', '2013-11-13'::date),
      ('2409148', 'RENAN DA SILVA VIEIRA', '2008-04-24'::date),
      ('123309', 'RODRIGO GONZALEZ CASTRO', '2000-06-18'::date),
      ('3168265', 'RUTE DA SILVA FERRAZ OLIVEIRA', '1972-06-18'::date),
      ('1880372', 'SELMA MARIA DE SOUZA', '1974-02-01'::date),
      ('486192', 'SLOAN PEREIRA DO NASCIMENTO', '1992-10-20'::date),
      ('2601851', 'TALITA SANTOS VILLAR', '2012-06-28'::date),
      ('1970148', 'THALES FROSSARD GAMA', '2013-08-26'::date),
      ('1634472', 'VALDIR EDSON MARTINS', '1979-07-09'::date),
      ('2098923', 'VALENTINA RODRIGUES MARQUES', '2015-09-01'::date),
      ('3100303', 'WILLIAM SANT ANNA TEIXEIRA MANHÃES', '2014-07-28'::date),
      ('2045470', 'YANN GUIMARÃES DE MORAIS FARO', '2009-09-25'::date)
    ) AS p(id_sgc, nome_pdf, nascimento)
  LOOP
    UPDATE public.desbravadores d
    SET id_sgc = registro.id_sgc,
        data_nascimento = registro.nascimento,
        idade = date_part('year', age(current_date, registro.nascimento))::int,
        updated_at = now()
    WHERE d.clube_id = 1 -- Fonseca; evita tocar membro de outro clube com nome igual
      AND regexp_replace(lower(public.unaccent_simples(d.nome)), '[^a-z0-9]', '', 'g')
        = regexp_replace(lower(public.unaccent_simples(registro.nome_pdf)), '[^a-z0-9]', '', 'g');

    IF FOUND THEN
      atualizados := atualizados + 1;
    ELSE
      sem_correspondencia := array_append(sem_correspondencia, registro.nome_pdf || ' (id_sgc ' || registro.id_sgc || ')');
    END IF;
  END LOOP;

  RAISE NOTICE 'id_sgc/nascimento atualizados: % membro(s).', atualizados;
  IF array_length(sem_correspondencia, 1) > 0 THEN
    RAISE WARNING 'Sem correspondencia no cadastro (confira manualmente pelo nome): %', array_to_string(sem_correspondencia, ' | ');
  END IF;
END $$;
