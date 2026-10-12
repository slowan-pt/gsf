-- Requisitos de 27 especialidades de Estudos da Natureza conferidos com o Manual de Especialidades 2025 (fotos das paginas).
-- Regra: a lista de requisitos segue o manual; onde o manual e o banco dizem a mesma coisa, mantem-se a redacao do banco (Word);
-- o que so existe no manual e acrescentado e o que so existe no banco e removido. Nivel e origem nao mudam.
-- Tudo ou nada: se alguma especialidade nao for encontrada pelo codigo, nada e alterado.
CREATE OR REPLACE FUNCTION pg_temp.set_req(p_codigo text, p_nivel text, p_linhas text[]) RETURNS void
LANGUAGE plpgsql AS $f$
DECLARE
  v_prog integer := (SELECT id FROM public.programas WHERE nome ILIKE '%desbravador%' ORDER BY id LIMIT 1);
  em public.especialidades_modelo%ROWTYPE;
BEGIN
  SELECT * INTO em FROM public.especialidades_modelo WHERE programa_id = v_prog AND codigo = p_codigo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Especialidade % nao encontrada.', p_codigo; END IF;

  DELETE FROM public.mda_requisitos_modelo
   WHERE programa_id = v_prog AND item_tipo = 'Especialidade'
     AND (especialidade_id = em.id OR (especialidade_id IS NULL AND item_url IS NOT NULL AND item_url = em.item_url));

  INSERT INTO public.mda_requisitos_modelo (programa_id, item_tipo, item_nome, item_codigo, item_url, especialidade_id, secao, ordem, texto)
  SELECT v_prog, 'Especialidade', em.nome, em.codigo, COALESCE(em.item_url, 'manual-2025/' || em.codigo), em.id, NULL, t.ord::integer, t.txt
    FROM unnest(p_linhas) WITH ORDINALITY AS t(txt, ord);

  UPDATE public.especialidades_modelo
     SET quantidade_requisitos = array_length(p_linhas, 1),
         nivel = COALESCE(p_nivel, nivel),
         updated_at = now()
   WHERE id = em.id;
END
$f$;

DO $$
BEGIN
  PERFORM pg_temp.set_req('EN-019', NULL, ARRAY[
    '1. Qual a diferença entre arbustos e árvores?',
    '2. Em que estação do ano a maioria dos arbustos floresce? Dar o nome de um arbusto que floresce antes de suas folhas aparecerem.',
    '3. Que arbusto parasita, muito usado para decoração de interiores, cresce nos galhos mais altos de diferentes tipos de árvores?',
    '4. Dar um exemplo de arbusto cuja flor atraia pássaros.',
    '5. Que tipos de arbustos os pássaros preferem para construir seus ninhos?',
    '6. Por que uma parreira às vezes é considerada um arbusto?',
    '7. Dar o nome de um arbusto que produz castanhas comestíveis.',
    '8. Mencionar dois arbustos cultivados e dois silvestres de sua região que produzam flores vistosas.',
    '9. Coletar e identificar folhas de 10 arbustos silvestres e armazená-las adequadamente.'
  ]);

  PERFORM pg_temp.set_req('EN-035', NULL, ARRAY[
    '1. Qual o significado da palavra areia? Citar dois tipos de areia.',
    '2. Qual a diferença entre areia e solo?',
    '3. Como a areia é formada?',
    '4. O que se pode entender a partir do tamanho, forma, superfície e fragmentação de um grão de areia?',
    '5. Definir e explicar a utilidade de cada tipo de areia:',
    'a) Glaciar;',
    'b) Calcária;',
    'c) Areia movediça;',
    'd) Areia para fazer vidro;',
    'e) Areia de modelagem;',
    'f) Areia para polir;',
    'g) Areia para construção;',
    'h) Areia para filtrar;',
    'i) Areia para fornalha;',
    'j) Areia de praia.',
    '6. Cumprir uma das opções abaixo:',
    'a) Examinar cinco tipos de areia com lentes de aumento e observar as várias características;',
    'b) Fazer uma coleção de 10 variedades de areia de cores diferentes, identificando o nome da localidade de onde foi retirada. Para a coleta, levar saquinhos pequenos, lápis e uma pequena colher ou concha. Apresentar a coleção em vidros, garrafas ou saquinhos plásticos.'
  ]);

  PERFORM pg_temp.set_req('EN-033', NULL, ARRAY[
    '1. Ter a especialidade de Árvores.',
    '2. Coletar e identificar folhas de 30 espécies diferentes de árvores. Armazená-las adequadamente e identificar cada uma.',
    '3. Classificar as folhas das espécies da coleção do requisito anterior quanto à composição da folha (simples ou composta), quanto ao pecíolo (peciolada, peltada, séssil), quanto à forma do limbo foliar e quanto ao tipo de margem.',
    '4. Fazer o seguinte:',
    'a) Quais são as vantagens de usar nomes científicos?',
    'b) Para que servem os dois termos de um nome científico e por que alguns nomes aparecem com três termos?',
    '5. Dar o nome de seis famílias de angiospermas e três famílias de gimnospermas.',
    '6. Definir os termos a seguir:',
    'a) Estípula;',
    'b) Resina;',
    'c) Cerne;',
    'd) Alburno;',
    'e) Fibra;',
    'f) Câmbio;',
    'g) Xilema;',
    'h) Floema.',
    '7. Identificar 10 plantas comuns usando características que não sejam as folhas, como gavinhas, espinhos, acúleos, casca, flores, frutos, interações planta-animal, formato e hábitos de crescimento.'
  ]);

  PERFORM pg_temp.set_req('EN-002', NULL, ARRAY[
    '1. O que é astronomia?',
    '2. O que é um corpo celeste? Sobre o corpo celeste mais próximo da Terra, responder:',
    'a) Qual o nome?',
    'b) Qual a distância da Terra?',
    'c) Qual sua influência nas marés?',
    '3. Responder as seguintes perguntas:',
    'a) O que causa um eclipse?',
    'b) O que é uma estrela cadente?',
    'c) Qual é a velocidade da luz?',
    '4. Fazer um diagrama do sistema solar, colocando os planetas em ordem a partir do Sol.',
    '5. Fazer um diagrama mostrando as posições relativas da Terra, do Sol e da Lua durante os eclipses solares e lunares.',
    '6. O que é uma constelação? Identificar no céu e dar o nome de, pelo menos, cinco constelações.',
    '7. Ilustrar as constelações Cruzeiro do Sul, Órion e Escorpião.',
    '8. Responder as seguintes perguntas:',
    'a) O que é a Via Láctea e como pode ser observada no céu noturno?',
    'b) O que é a estrela da manhã e a estrela vespertina? Por que recebem esses nomes?',
    'c) O que é a aurora austral? O que a causa?'
  ]);

  PERFORM pg_temp.set_req('EN-026', NULL, ARRAY[
    '1. Ter a especialidade de Astronomia.',
    '2. Explicar os seguintes termos:',
    'a) Planeta;',
    'b) Satélite;',
    'c) Cometa;',
    'd) Meteoro;',
    'e) Nebulosa;',
    'f) Mancha solar;',
    'g) Esfera celeste;',
    'h) Polo celeste;',
    'i) Equador celeste;',
    'j) Horizonte;',
    'k) Ascensão reta;',
    'l) Declinação;',
    'm) Trânsito astronômico;',
    'n) Conjunção;',
    'o) Eclíptica;',
    'p) Zênite;',
    'q) Nadir.',
    '3. Explicar a relação entre a eclíptica e os equinócios de primavera e outono. Quais as datas normalmente associadas a eles?',
    '4. Sobre os planetas, responder:',
    'a) Quais suas características peculiares?',
    'b) Quais não podem ser vistos sem telescópio?',
    'c) Quais dois podem ser vistos apenas perto do amanhecer ou anoitecer?',
    '5. Identificar no céu e nomear as constelações que são símbolos da primavera e do outono no hemisfério sul.',
    '6. O que são constelações circumpolares e constelações sazonais? Dar exemplos.',
    '7. Dar o nome de cinco constelações visíveis entre o pôr do sol e a meia-noite no hemisfério sul, durante os meses de verão e durante os meses de inverno.',
    '8. Como as letras do alfabeto grego são usadas para nomear estrelas de uma constelação?',
    '9. Em qual época do ano Órion é melhor vista? Dar o nome e localizar suas três estrelas mais brilhantes.',
    '10. Qual a diferença entre um telescópio refrator e um refletor?',
    '11. Onde e de que maneira a Bíblia se refere à Ursa Maior, Órion (Três Marias), Plêiades (Sete-Estrelo/Sete-Cabrinhas) e recâmaras do sul (estrelas do sul)?'
  ]);

  PERFORM pg_temp.set_req('EN-003', NULL, ARRAY[
    '1. Citar quatro características que podem ser usadas para diferenciar as aves dos outros animais.',
    '2. Dar o nome de três espécies de aves que não voam, dizer o que comem e em que país ou continente vivem.',
    '3. Mencionar o dia da semana em que as aves foram criadas. Descobrir na Bíblia os nomes de cinco aves. Ser capaz de mencionar três histórias bíblicas onde, através das aves, Deus mostrou seu cuidado e amor por nós.',
    '4. Fazer uma lista de 10 aves observadas pessoalmente. Incluir imagens.',
    '5. Fazer uma lista de cinco espécies identificadas pelo som ao ar livre.',
    '6. Fazer umas das tarefas a seguir (apresentar fotos):',
    'a) Montar um posto de alimentação e relatar as aves que o visitam durante uma semana;',
    'b) Descobrir um ninho, identificar a espécie, observar sua construção e fazer uma descrição;',
    'c) Montar um bebedouro para beija-flor e usá-lo durante uma semana. Responder:',
    '• Do que é feito o néctar utilizado?',
    '• Por que não se deve usar corante ou mel?',
    '• Quando o fluido do bebedouro deve ser trocado?',
    '• Como se deve cuidar do bebedouro?',
    '7. Identificar por figuras ou fotografias 20 espécies de aves, sendo pelo menos 10 típicas de seu país. Dar o nome popular e o nome científico.'
  ]);

  PERFORM pg_temp.set_req('EN-020', NULL, ARRAY[
    '1. Conhecer as leis de seu estado ou país sobre captura, criação e exportação de aves em gaiolas e agir de acordo com elas.',
    '2. Cuidar de um pássaro ou casal de pássaros durante, pelo menos, um mês.',
    '3. Completar um dos itens a seguir:',
    'a) Se tiver um pássaro em gaiola, manter um registro dos cuidados durante, pelo menos, um mês, incluindo hábitos alimentares, água, limpeza, etc.;',
    'b) Se não tiver um pássaro em gaiola atualmente, mas teve um no ano passado, cuidar do pássaro de alguém durante, pelo menos, uma semana enquanto o dono viaja, e manter um registro dos cuidados.',
    '4. Sobre canários:',
    'a) Citar o nome de quatro variedades;',
    'b) Dar uma breve história de sua origem e desenvolvimento;',
    'c) Dar o nome e distinguir cinco sementes usadas na alimentação;',
    'd) Descrever resumidamente os cuidados gerais.',
    '5. Sobre periquitos:',
    'a) De que país são originários os periquitos?',
    'b) Descrever hábitos de alimentação, ninho e comportamento geral.',
    '6. Pesquisar em sua região um tipo de ave de estimação comum, diferente das citadas, e citar suas características, variedades e cuidados quando domesticada.'
  ]);

  PERFORM pg_temp.set_req('EN-075', NULL, ARRAY[
    '1. Quais as principais características das bactérias que as colocam em um reino separado?',
    '2. Por meio de desenhos ou figuras, identificar as estruturas de uma célula bacteriana.',
    '3. Esquematizar as quatro principais formas bacterianas.',
    '4. O que são bactérias Gram-negativas e Gram-positivas?',
    '5. Quais as formas de reprodução das bactérias? Quais condições ambientais favorecem seu crescimento?',
    '6. Como ocorre a alimentação e a respiração das bactérias?',
    '7. Citar:',
    'a) Três bactérias benéficas e explicar por quê;',
    'b) Três bactérias prejudiciais e explicar por quê;',
    'c) Uma história bíblica relacionada a uma doença bacteriana.',
    '8. Nomear cinco doenças bacterianas e descrever alguns cuidados que temos que ter para evitá-las.',
    '9. Qual a importância de não usar antimicrobianos sem prescrição médica?'
  ]);

  PERFORM pg_temp.set_req('EN-085', NULL, ARRAY[
    '1. A que ordem e família pertencem as formigas? Quantas espécies estão catalogadas em seu país?',
    '2. Descrever o ciclo de vida de uma formiga.',
    '3. Ilustrar e descrever a anatomia básica de uma formiga.',
    '4. Existem espécies de formigas que não vivem em formigueiros. Sobre essas espécies, pesquisar:',
    'a) Habitat e forma de sociedade;',
    'b) Reprodução;',
    'c) Alimentação.',
    '5. Citar três características que diferenciam as formigas de outros insetos.',
    '6. Citar dois benefícios e dois malefícios das formigas para o ser humano.',
    '7. Qual a principal forma de comunicação entre as formigas?',
    '8. Escolher 10 espécies de formigas encontradas em seu país e pesquisar sobre cada uma:',
    'a) Habitat e forma de sociedade;',
    'b) Reprodução;',
    'c) Alimentação.',
    '9. Com seu grupo ou individualmente, realizar um dos seguintes:',
    'a) Montar uma fazenda de formigas e acompanhar os passos para a sua construção e manutenção;',
    'b) Observar, diariamente, um formigueiro por uma semana e descobrir seu funcionamento e rotina.',
    '10. Fazer uma encenação, relatório, música ou poema sobre o significado de Provérbios 6:6-11.'
  ]);

  PERFORM pg_temp.set_req('EN-009', NULL, ARRAY[
    '1. Citar três características que distinguem o Reino Fungi.',
    '2. Citar três classes de fungos e dar três exemplos de cada.',
    '3. Identificar, ao natural ou através de imagens, 15 fungos comuns em seu país.',
    '4. Citar três fungos que tenham valor econômico e explicar sua utilidade.',
    '5. Descrever o ciclo de vida das três classes de fungos estudadas.',
    '6. Citar cinco doenças provocadas por fungos em seres humanos, plantas ou animais.',
    '7. Quais cuidados devemos ter ao observarmos e manusearmos diferentes tipos de fungos?',
    '8. Identificar, pessoalmente ou por meio de imagens/fotografias, a diferença entre um bolor, uma orelha de pau e um cogumelo.',
    '9. Identificar as principais partes de um basidiomiceto.',
    '10. Qual é a importância ambiental de alguns fungos?',
    '11. Quais são as condições ambientais ideais para o desenvolvimento dos fungos?',
    '12. Como um fungo se alimenta?',
    '13. Encontrar uma referência bíblica que mencione fungos.'
  ]);

  PERFORM pg_temp.set_req('EN-010', NULL, ARRAY[
    '1. Quais são as principais características dos mamíferos?',
    '2. Em que dia da criação os mamíferos foram criados?',
    '3. Apresentar uma ou mais características peculiares de cada um dos seguintes grupos de mamíferos e mencionar uma ou mais espécies de mamíferos encontradas em cada:',
    'a) Marsupiais — Marsupialia;',
    'b) Sirênios — Sirenia;',
    'c) Xenartros — Xenarthra;',
    'd) Primatas — Primates;',
    'e) Roedores — Rodentia;',
    'f) Lagomorfos — Lagomorpha;',
    'g) Quirópteros — Chiroptera;',
    'h) Carnívoros — Carnivora;',
    'i) Pinípedes — Pinnipedia;',
    'j) Perissodáctilos — Perissodactyla;',
    'k) Artiodátilos — Artiodactyla;',
    'l) Cetáceos — Cetacea.',
    '4. Citar:',
    'a) Citar quatro mamíferos domesticados e explicar sua utilidade ao ser humano;',
    'b) Quatro coisas que os mamíferos fazem e que são prejudiciais ao ser humano;',
    'c) Citar quatro mamíferos completamente aquáticos e sua distribuição geográfica.',
    '5. Qual é o maior mamífero do mundo? Onde vive? Do que se alimenta?',
    '6. Relacionar oito espécies de mamíferos silvestres que você já observou e identificou pessoalmente na natureza ou em um zoológico.',
    '7. Escrever uma história intitulada: “Mamíferos silvestres que já observei”.'
  ]);

  PERFORM pg_temp.set_req('EN-014', NULL, ARRAY[
    '1. O significa o termo molusco?',
    '2. Em relação aos moluscos das classes dos gastrópodes, cefalópodes e bivalves citar:',
    'a) Suas principais características;',
    'b) Pelo menos um representante de cada classe.',
    '3. Quais são os únicos moluscos terrestres? A qual classe eles pertencem?',
    '4. Citar três características dos moluscos.',
    '5. Identificar e compreender as seguintes estruturas:',
    'a) Em bivalves:',
    '• Concha;',
    '• Cicatriz do músculo;',
    '• Umbo.',
    'b) Em gastrópodes:',
    '• Concha;',
    '• Columela;',
    '• Ápice;',
    '• Pé;',
    '• Tentáculos;',
    '• Olhos.',
    '6. Todas as conchas são encontradas em praias? Onde podem ser encontradas? Em quais áreas do mundo há maior variedade de conchas?',
    '7. Descrever três maneiras diferentes utilizadas pelos moluscos para sua locomoção.',
    '8. Como os moluscos se protegem?',
    '9. De que formas as conchas são produzidas pela maioria dos moluscos? Do que são feitas?',
    '10. Citar cinco utilidades das conchas ou moluscos para o homem.',
    '11. Fazer uma coleção de 20 conchas diferentes, identificando cada uma e anotando a data de coleta ou aquisição e sua origem.',
    '12. De onde vêm as pérolas? Que incrível lição a pérola nos ensina? (Ler Parábolas de Jesus, págs. 115-118).',
    '13. Citar quais textos bíblicos falam que:',
    'a) Os animais aquáticos foram criados no quinto dia;',
    'b) A quantidade de criaturas marinhas é inumerável;',
    'c) As criaturas das águas perecem fora da água;',
    'd) Salomão tinha conhecimento sobre a vida marinha;',
    'e) Jesus usou um produto de conchas duas vezes para ensinar uma lição espiritual;',
    'f) Uma mulher de negócios vendia famosas tintas púrpura feitas de conchas de múrice do Mediterrâneo;',
    'g) Moluscos não são apropriados para alimentação;',
    'h) As 12 portas da Cidade Santa são 12 pérolas.'
  ]);

  PERFORM pg_temp.set_req('EN-063', NULL, ARRAY[
    '1. Qual o nome da família das palmeiras?',
    '2. Citar as características gerais das palmeiras quanto a:',
    'a) Tronco ou caule;',
    'b) Raízes;',
    'c) Folhas;',
    'd) Inflorescência/flores;',
    'e) Frutos.',
    '3. O que acontece com uma palmeira se sua coroa for cortada?',
    '4. O que acontece se o tronco de uma palmeira for danificado?',
    '5. Identificar cinco tipos de palmeiras de sua região.',
    '6. Desenhar ou fotografar oito palmeiras que você já tenha identificado na natureza.',
    '7. Quais partes das palmeiras podem ser usadas como alimento? Dar exemplos.'
  ]);

  PERFORM pg_temp.set_req('EN-052', NULL, ARRAY[
    '1. Completar uma das seguintes tarefas:',
    'a) Cuidar de um pequeno mamífero de estimação por, pelo menos, um mês. (Cães e gatos não estão incluídos). Antes da compra do animal, pesquisar o seguinte: país de origem, hábitos alimentares (variedades, frequência, quantidade), necessidade de vacinas, doenças mais comuns (que sofre e que pode transmitir ao homem), preço de mercado, necessidade de espaço, necessidade de atenção diária, clínica veterinária especializada mais próxima e estimativa de tempo de vida. Ao final do período, fazer um relatório dos cuidados com o seu pequeno animal. Incluir tópicos como alimentos favoritos, sua história preferida sobre o animal, alguns dos seus hábitos, horários em que é mais ativo, etc.;',
    'b) Caso não possua atualmente um pequeno mamífero, mas já tenha tido, cuidar do animal de alguém por, pelo menos, uma semana. Fazer um relatório dos cuidados, horários de água e comida, limpeza da gaiola, etc. Comparar o animal emprestado com o que você teve no passado.',
    '2. Completar o seguinte:',
    'a) Ser capaz de distinguir os seguintes grupos de pequenos animais de estimação:',
    '• Hamster;',
    '• Furão;',
    '• Gerbo;',
    '• Porquinho-da-índia;',
    '• Chinchila;',
    '• Esquilo-da-Mongólia;',
    '• Coelho.',
    'b) Descrever os cuidados básicos de dois desses animais e indicar semelhanças e diferenças.',
    'c) Quais desses animais não são roedores?',
    '3. Por que não se deve adotar animais silvestres como animais de estimação?',
    '4. Escrever uma redação de 250 palavras sobre a história e importância de um dos animais estudados e suas características como animal de estimação.',
    '5. Encontrar três referências bíblicas a esses animais. Eles são considerados limpos ou imundos?'
  ]);

  PERFORM pg_temp.set_req('EN-049', NULL, ARRAY[
    '1. O que é uma planta ornamental?',
    '2. Citar:',
    'a) Cinco plantas ornamentais cultivadas por causa da sua folhagem;',
    'b) Cinco plantas ornamentais cultivadas por causa das suas flores;',
    'c) Cinco plantas cultivadas por causa do seu aroma;',
    'd) Cinco trepadeiras ornamentais.',
    '3. Citar três plantas caseiras que se adaptem melhor a:',
    'a) Luz direta;',
    'b) Solo seco;',
    'c) Solo muito úmido.',
    '4. Qual a importância da umidade para plantas caseiras?',
    '5. Responder o seguinte:',
    'a) A maioria das plantas caseiras se dá bem em temperaturas de 18 a 22 graus. Citar uma que exige ambiente mais frio, de 7 a 13 graus;',
    'b) Qual é a luminosidade ideal para violetas? Em que lugar da casa devem ser colocadas?',
    'c) Todos os gerânios precisam aproximadamente das mesmas condições de crescimento. De onde são originários? Quais as condições ideais de temperatura, luz e umidade?',
    '6. Preparar uma mistura de solo com, pelo menos, três ingredientes diferentes e cultivar duas plantas nesse solo durante dois meses.',
    '7. Propagar duas plantas por meio de folhas, ramos ou divisões. Germinar uma planta a partir de semente e cuidar dela por dois meses.',
    '8. Cultivar pelo menos cinco das seguintes:',
    'a) Açafrão;',
    'b) Begônia;',
    'c) Antúrio;',
    'd) Aspidistra;',
    'e) Avenca;',
    'f) Caládio;',
    'g) Cóleo;',
    'h) Fícus;',
    'i) Filodendro;',
    'j) Gerânio;',
    'k) Gloxínia;',
    'l) Íris;',
    'm) Jacinto;',
    'n) Melindre;',
    'o) Narciso;',
    'p) Planta alumínio;',
    'q) Samambaia;',
    'r) Sanseviéria;',
    's) Trepadeiras;',
    't) Tulipa;',
    'u) Violeta;',
    'v) Uma flor à sua escolha;',
    'w) Uma folhagem à sua escolha.'
  ]);

  PERFORM pg_temp.set_req('EN-043', NULL, ARRAY[
    'Nota: esta especialidade deve ser acompanhada por um instrutor que conheça o bioma da região.',
    '1. Identificar, pelo menos, 15 plantas silvestres comestíveis, dizer seu hábito de crescimento e quais partes são comestíveis.',
    '2. Cumprir os itens a seguir:',
    'a) Por que é importante não comer cogumelos silvestres?',
    'b) Que raiz pode ser seca e moída para fazer farinha?',
    'c) Citar pelo menos três famílias de plantas que possuam espécies venenosas ou duvidosas.',
    'd) Qual é a principal regra para determinar se uma planta silvestre é comestível?',
    'e) Citar 15 Plantas Alimentícias Não Convencionais (PANCs) que são comuns para cultivar em casa.',
    '3. Identificar, preparar e comer cinco tipos de frutas silvestres, três tipos de bebidas, três plantas de saladas, três ervas e duas raízes ou tubérculos.',
    '4. Preparar um alimento usando uma planta silvestre típica de sua região.',
    '5. Demonstrar a preparação de alimentos silvestres em cada uma das maneiras a seguir:',
    'a) Ferver;',
    'b) Tostar;',
    'c) Fritar;',
    'd) Assar.',
    '6. Elaborar um manual com fotos das plantas utilizadas para o cumprimento dos requisitos anteriores, acrescentando as seguintes informações:',
    'a) Nome pela qual é conhecida na região e, se possível, o nome científico;',
    'b) Hábito (árvore, arbusto, erva, trepadeira, etc.);',
    'c) Partes comestíveis;',
    'd) Onde é encontrada (habitat);',
    'e) Presença de toxinas;',
    'f) Valores medicinais;',
    'g) Outras utilidades;',
    'h) Receitas que possam ser feitas com essa planta.'
  ]);

  PERFORM pg_temp.set_req('EN-089', NULL, ARRAY[
    '1. O que são recursos hídricos? Citar 10 atividades em que se utiliza água.',
    '2. O que é energia hidroelétrica e qual sua importância em seu país?',
    '3. Como é feito o abastecimento público de água de sua cidade ou estado?',
    '4. Citar pelo menos cinco formas de desperdício de água e como evitá-las.',
    '5. Explicar como os seguintes fatores influenciam os recursos hídricos:',
    'a) Desmatamento;',
    'b) Poluição;',
    'c) Ocupação e uso desordenado do solo;',
    'd) Falta de saneamento.',
    '6. Pesquisar a média de consumo de água em seu país nas seguintes atividades:',
    'Uso doméstico:',
    'a) Banho;',
    'b) Escovação dentária;',
    'c) Descarga sanitária;',
    'd) Lavar roupa;',
    'e) Torneira gotejando.',
    'Uso industrial:',
    'a) Produção de 1 kg de carne bovina;',
    'b) Produção de 1 kg de queijo;',
    'c) Produção de 1 litro de leite;',
    'd) Produção de 1 kg de tomate;',
    'e) Produção de um computador.',
    '7. Citar 10 maneiras de preservar os recursos hídricos e colocar algumas em prática.',
    '8. Saber o que é hidrologia e descobrir como o seu estudo é fundamental para a preservação dos recursos hídricos.',
    '9. Citar, pelo menos, três maneiras de purificar a água.',
    '10. Fazer uma das seguintes atividades:',
    'a) Realizar um projeto de preservação de uma fonte de água;',
    'b) Realizar um projeto de conscientização sobre o uso adequado da água em sua escola, igreja, trabalho ou comunidade;',
    'c) Ter a especialidade de Conservação ambiental ou Energias renováveis.'
  ]);

  PERFORM pg_temp.set_req('EN-056', NULL, ARRAY[
    '1. Ter a especialidade de Rastreio de animais.',
    '2. Citar dois animais de cada grupo:',
    'a) Que andam com os pés chatos;',
    'b) Que andam na ponta dos pés;',
    'c) Que andam na ponta dos dedos;',
    'd) Que possuem unhas ou garras.',
    '3. Citar, pelo menos, dois pássaros que, pelos seus rastros, eles:',
    'a) Saltam;',
    'b) Andam.',
    '4. Qual a diferença entre um molde de alto-relevo e um de baixo-relevo?',
    '5. Fazer um molde em baixo-relevo a partir de um molde em alto-relevo ou usando borracha.',
    '6. O que é coprologia e por que isto é importante no estudo de animais?',
    '7. Através de cuidadosa observação e análise, encontrar o maior número possível de evidências da passagem de um ou mais animais por uma trilha.',
    '8. Seguir uma trilha deixada por um animal e determinar se ele estava correndo ou andando.',
    '9. Montar uma área para rastreamento e mantê-la durante três dias:',
    'a) Selecionar um local aberto em um lugar tranquilo perto do seu acampamento, casa ou área rural;',
    'b) Alisar o chão, deixando-o propício a registrar as marcas dos animais que passarem por ali;',
    'c) Colocar comida para animais selvagens;',
    'd) Verificar diariamente se o local foi visitado e repor os alimentos, se necessário.'
  ]);

  PERFORM pg_temp.set_req('EN-050', NULL, ARRAY[
    '1. Citar, pelo menos, três coisas que os rastros de animais nos dizem.',
    '2. Identificar, pelo menos, quatro sinais da presença de mamíferos.',
    '3. Saber distinguir entre pegadas de canídeos, felídeos e outros carnívoros.',
    '4. Citar dois grupos de animais que deixam odores para outros indivíduos da mesma espécie.',
    '5. Além das pegadas, mencionar dois outros sinais da presença de aves.',
    '6. Identificar 10 pegadas diferentes, incluindo duas de aves. Fazer três moldes em alto-relevo utilizando gesso.',
    '7. Observar rastros, trilhas ou pegadas de um ou mais dos seguintes animais:',
    'a) Sapo ou rã;',
    'b) Cobra;',
    'c) Tartaruga, cágado ou jabuti;',
    'd) Molusco;',
    'e) Minhoca;',
    'f) Roedores.'
  ]);

  PERFORM pg_temp.set_req('EN-092', NULL, ARRAY[
    '1. O que significa a palavra reciclagem?',
    '2. Quais são os cinco R''s da educação ambiental?',
    '3. Definir os seguintes termos:',
    'a) Sustentabilidade;',
    'b) Impacto ambiental;',
    'c) Preservação;',
    'd) Biodegradável.',
    '4. Quais são as cores usadas para separar o lixo para reciclagem? E quais lixos são separados de acordo com cada cor?',
    '5. Fazer um relatório de, no mínimo, 300 palavras sobre a importância social e ambiental da reciclagem na atualidade.',
    '6. Fazer um cartaz ou apresentação com exemplos de resíduos naturais e artificiais, indicando seu tempo de decomposição.',
    '7. Pesquisar e apresentar em forma de desenho, escrita ou multimídia uma perspectiva de futuro, na qual se demonstre quais os impactos ambientais que o lixo irá causar ao homem e ao meio ambiente caso não haja reciclagem do lixo.',
    '8. Pesquisar em seu município, quais são as medidas públicas que estão sendo adotadas para o trabalho de coleta seletiva da cidade. Apresentar um relatório.',
    '9. Criar dois brinquedos feitos com material reciclado. Procurar fazê-los dando o melhor acabamento possível.',
    '10. Encontrar um texto bíblico que mencione a importância do cristão se conscientizar sobre a conservação, orientação, preservação e sensibilização do meio ambiente.'
  ]);

  PERFORM pg_temp.set_req('EN-011', NULL, ARRAY[
    '1. Quais são as principais características dos répteis?',
    '2. Qual substância torna a pele dos répteis impermeável?',
    '3. Quais são as principais ordens de répteis? Citar dois exemplos de cada.',
    '4. Dar o nome de 10 répteis encontrados em sua região. Dizer onde vivem e seus hábitos alimentares.',
    '5. Identificar cinco répteis peçonhentos de seu país.',
    '6. Quais são os primeiros socorros que devem ser prestados a uma vítima picada por uma serpente peçonhenta? E por uma serpente não peçonhenta?',
    '7. Identificar, pessoalmente ou por imagens, um cágado, uma tartaruga marinha e um jabuti.',
    '8. Ser capaz de contar duas histórias da Bíblia nas quais um réptil teve papel importante.'
  ]);

  PERFORM pg_temp.set_req('EN-093', NULL, ARRAY[
    '1. Ter a especialidade de Reciclagem e sustentabilidade.',
    '2. Em localidades onde há um sistema de coleta seletiva são usadas lixeiras em cores diferenciadas. Mencionar que tipo de material é identificado por cada cor:',
    'a) Azul;',
    'b) Vermelho;',
    'c) Amarelo;',
    'd) Marrom;',
    'e) Verde.',
    '3. Como funciona a coleta seletiva em residências e empresas?',
    'a) Residências;',
    'b) Empresas.',
    '4. Como a reciclagem influencia no contexto social se transformando em renda alternativa para diversas famílias?',
    '5. Como devem ser descartadas pilhas e lâmpadas fluorescentes? Identificar um posto de coleta.',
    '6. O que é um aterro sanitário? Quais são seus benefícios e malefícios?',
    '7. Restaurar um objeto que iria ser descartado, tornando-o novamente utilizável.',
    '8. Cumprir um dos itens abaixo:',
    'a) Desenvolver uma técnica para reciclar restos de madeira, cordas ou bambus após acampamentos e adotá-la em, pelo menos, um acampamento;',
    'b) Fazer um vídeo ou encenação de, pelo menos, cinco minutos com dicas sobre como ajudar o planeta através da reciclagem;',
    'c) Visitar uma cooperativa de reciclagem de resíduos e conhecer seus métodos de trabalho.'
  ]);

  PERFORM pg_temp.set_req('EN-057', NULL, ARRAY[
    '1. Ter a especialidade de Répteis.',
    '2. Como é chamado o estudo dos répteis?',
    '3. Como os répteis se protegem?',
    '4. Quais são os dois tipos principais de peçonha de serpentes e que efeitos provocam?',
    '5. Que aplicações as peçonhas de répteis possuem?',
    '6. Identificar na natureza, pelo menos, oito espécies de répteis.',
    '7. Completar uma das tarefas a seguir:',
    'a) Comparar lagartos, cobras, tartarugas e crocodilos quanto a: modo de vida, olhos, orelhas, dentes, coração, pulmões, membros, rabo e escamas;',
    'b) Encontrar um réptil e registrar suas atividades durante diferentes horas do dia, por pelo menos um dia;',
    'c) Manter um pequeno réptil em um terrário por, pelo menos, um mês e fazer um relatório dos cuidados.',
    'Obs.: ao cumprir este requisito, esteja certo de não estar infringindo nenhuma lei de seu país.'
  ]);

  PERFORM pg_temp.set_req('EN-013', NULL, ARRAY[
    '1. Ter a especialidade de Rochas e minerais.',
    '2. Definir os seguintes termos:',
    'a) Estalagmite;',
    'b) Estalactite;',
    'c) Geodo;',
    'd) Veio;',
    'e) Brecha de falha;',
    'f) Lava;',
    'g) Caliche;',
    'h) Formação ferrífera bandada;',
    'i) Kimberlito;',
    'j) Laterita.',
    '3. Citar os sete sistemas cristalinos. Fazer uma figura ou desenho de cada e citar dois minerais pertencentes a cada grupo.',
    '4. Quais metais são frequentemente encontrados na forma de rochas?',
    '5. Explicar como as rochas se formam a partir do magma, descrevendo os processos e dando exemplos.',
    '6. Adicionar, pelo menos, 10 rochas ou minerais à sua coleção. No caso de ter coletado, classificar as espécies com o nome da pessoa que a encontrou, data e local em que foi encontrada. No caso de ter adquirido, escrever o seguinte:',
    'a) Para rochas: pesquisar e escrever a mineralogia da rocha e classificá-la segundo os três grupos de rochas;',
    'b) Minerais: cor, brilho, traço, clivagem, fratura, dureza, densidade e sistema cristalino.'
  ]);

  PERFORM pg_temp.set_req('EN-041', NULL, ARRAY[
    '1. Ter a especialidade de Sementes.',
    '2. Identificar, a partir de desenhos, e conhecer o propósito de cada uma das seguintes partes de uma semente: endosperma, radícula, gêmula, micrópila.',
    '3. Explicar o seguinte:',
    'a) Qual a diferença entre uma semente monocotiledônea e uma dicotiledônea? Qual a diferença entre semente e esporo?',
    'b) A diferença entre uma semente e um esporo?',
    '4. Com sementes da sua própria coleção, demonstrar as semelhanças entre sementes de plantas da mesma família.',
    '5. Adicionar à sua coleção 15 tipos de sementes. Classificar cada uma delas com o nome, data e local em que foi encontrada, e nome da pessoa que a encontrou.',
    '6. Escrever ou apresentar oralmente duas lições que podemos aprender das sementes. Você poderá encontrar as informações que procura no livro Parábolas de Jesus, pág. 33 a 89.',
    '7. Construir um aparato para testar a germinação de sementes. Testar 100 sementes de uma espécie silvestre e 100 de uma espécie doméstica. Apresentar os resultados.'
  ]);

  PERFORM pg_temp.set_req('EN-040', NULL, ARRAY[
    '1. Qual o principal objetivo de uma semente?',
    '2. Que alimentos foram os primeiros a serem dados ao ser humano no Jardim do Éden?',
    '3. A partir de uma semente ou desenho, identificar e saber o propósito dos seguintes:',
    '4. Conhecer quatro diferentes métodos pelos quais as sementes são dispersadas pelas plantas. Mencionar exemplos de plantas que espalham suas sementes por cada método.',
    '5. Citar:',
    'a) 10 sementes usadas como alimento;',
    'b) Cinco tipos de sementes que são usadas como fonte de óleo;',
    'c) Cinco sementes usadas como condimentos.',
    '6. Quais condições são necessárias para uma semente germinar?',
    '7. Fazer uma coleção de 25 sementes diferentes. Pelo menos 15 devem ser coletadas por você. Registrar nome, data, local e pessoa que coletou.',
    '8. Plantar sementes de feijão, milho ou soja. Registrar o tempo de germinação e fazer um relatório diário do crescimento. Identificar as diferenças entre uma semente de feijão e uma de milho.'
  ]);

  PERFORM pg_temp.set_req('EN-094', NULL, ARRAY[
    '1. Quais são as diferenças entre peixes ósseos e cartilaginosos?',
    '2. Citar dois peixes cartilaginosos que não sejam tubarões.',
    '3. Explicar o seguinte:',
    'a) Como é a dentição dos tubarões e como ela se relaciona com a diversidade de alimentos?',
    'b) Como ocorre a respiração dos tubarões;',
    'c) O que são as ampolas de Lorenzini?',
    'd) Qual é o menor e o maior tubarão do mundo?',
    '4. Identificar as principais estruturas morfológicas de um tubarão através de um esquema.',
    '5. Saber identificar, por meio de figuras, fotos ou pessoalmente, cinco espécies de tubarões.',
    '6. Fazer uma das seguintes atividades:',
    'a) Visitar um aquário e observar peixes cartilaginosos. Fazer um relatório sobre o que você aprendeu;',
    'b) Assistir a um vídeo sobre tubarões e fazer um relatório.'
  ]);

END
$$;
