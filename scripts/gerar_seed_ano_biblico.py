#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera supabase/migrations/093_ano_biblico_seed.sql a partir do plano de
365 dias do "Ano Biblico" (fonte: PDF fornecido pelo usuario, transcrito
manualmente para este script).

Regra de parsing das referencias de cada dia (aplicada uniformemente a "," e
";", que no plano original nao seguem uma convencao rigida):
  - Um segmento que comeca com letras (ex.: "Gn11", "Am8") define um NOVO
    LIVRO + capitulo (e range opcional apos ":").
  - Um segmento numerico puro (ex.: "14", "20") define um NOVO CAPITULO do
    MESMO livro do segmento anterior (capitulo inteiro).
  - Um segmento "NN-NN" (com traco, sem ":") e um RANGE ADICIONAL de
    versiculos dentro do capitulo atual (o mais recente estabelecido).

Uso: python scripts/gerar_seed_ano_biblico.py
Escreve supabase/migrations/093_ano_biblico_seed.sql
"""
import json
import re

LIVROS = {
    'Gn': 'Gênesis', 'Ex': 'Êxodo', 'Lv': 'Levítico', 'Nm': 'Números', 'Dt': 'Deuteronômio',
    'Js': 'Josué', 'Jz': 'Juízes', 'Rt': 'Rute', '1Sm': '1 Samuel', '2Sm': '2 Samuel',
    '1Rs': '1 Reis', '2Rs': '2 Reis', '2Cr': '2 Crônicas', 'Ed': 'Esdras', 'Ne': 'Neemias',
    'Et': 'Ester', 'Jó': 'Jó', 'Sl': 'Salmos', 'Pv': 'Provérbios', 'Ec': 'Eclesiastes',
    'Is': 'Isaías', 'Jr': 'Jeremias', 'Dn': 'Daniel', 'Jl': 'Joel', 'Am': 'Amós',
    'Jn': 'Jonas', 'Mq': 'Miquéias', 'Ag': 'Ageu', 'Zc': 'Zacarias', 'Ml': 'Malaquias',
    'Mt': 'Mateus', 'Mc': 'Marcos', 'Lc': 'Lucas', 'Jo': 'João', 'At': 'Atos',
    'Rm': 'Romanos', '1Co': '1 Coríntios', '2Co': '2 Coríntios', 'Gl': 'Gálatas',
    'Ef': 'Efésios', 'Fp': 'Filipenses', 'Cl': 'Colossenses', '1Ts': '1 Tessalonicenses',
    '2Tm': '2 Timóteo', 'Hb': 'Hebreus', 'Tg': 'Tiago', '1Pe': '1 Pedro', 'Ap': 'Apocalipse',
}

RE_NOVO_LIVRO = re.compile(r'^([123]?[A-ZÀ-Ú][a-zà-úãõéê]*)(\d+)(?::(\d+)(?:-(\d+))?)?$')
RE_NOVO_CAPITULO = re.compile(r'^(\d+)(?::(\d+)(?:-(\d+))?)?$')
RE_RANGE_ADICIONAL = re.compile(r'^(\d+)-(\d+)$')


def parse_dia(ref: str):
    """Retorna lista de passagens [{'livro','capitulo','verso_ini','verso_fim'}]."""
    segmentos = [s.strip() for s in re.split(r'[;,]', ref) if s.strip()]
    passagens = []
    livro_atual = None
    cap_atual = None
    for seg in segmentos:
        m = RE_NOVO_LIVRO.match(seg)
        if m:
            livro_atual = m.group(1)
            cap_atual = int(m.group(2))
            v1 = int(m.group(3)) if m.group(3) else None
            v2 = int(m.group(4)) if m.group(4) else v1
            passagens.append({'livro': livro_atual, 'capitulo': cap_atual, 'verso_ini': v1, 'verso_fim': v2})
            continue
        m = RE_RANGE_ADICIONAL.match(seg)
        if m:
            v1, v2 = int(m.group(1)), int(m.group(2))
            passagens.append({'livro': livro_atual, 'capitulo': cap_atual, 'verso_ini': v1, 'verso_fim': v2})
            continue
        m = RE_NOVO_CAPITULO.match(seg)
        if m:
            cap_atual = int(m.group(1))
            v1 = int(m.group(2)) if m.group(2) else None
            v2 = int(m.group(3)) if m.group(3) else v1
            passagens.append({'livro': livro_atual, 'capitulo': cap_atual, 'verso_ini': v1, 'verso_fim': v2})
            continue
        raise ValueError(f'Segmento nao reconhecido: {seg!r} em {ref!r}')
    if not passagens:
        raise ValueError(f'Nenhuma passagem em {ref!r}')
    return passagens


# (mes, dia, referencia crua)
PLANO = []

def add_mes(mes, dias_str):
    for entrada in dias_str.strip().split('·'):
        entrada = entrada.strip()
        if not entrada:
            continue
        dia_str, ref = entrada.split('.', 1)
        PLANO.append((mes, int(dia_str.strip()), ref.strip()))


add_mes(1, """
1.Gn1 · 2.Gn2 · 3.Gn3 · 4.Gn4:1-16 · 5.Gn6 · 6.Gn7 · 7.Gn8 · 8.Gn9:1-19 · 9.Gn11:1-19,12:1-13 ·
10.Gn14 · 11.Gn15 · 12.Gn17:1-22 · 13.Gn18 · 14.Gn19:1-29 · 15.Gn21:1-21 · 16.Gn22:1-19 · 17.Gn23 ·
18.Gn24 · 19.Gn27 · 20.Gn28 · 21.Gn29:1-30 · 22.Gn31:1-3,17-18 · 23.Gn32 · 24.Gn33 · 25.Gn35:1-20 ·
26.Gn37 · 27.Gn39 · 28.Gn40 · 29.Gn41 · 30.Gn42 · 31.Gn43
""")

add_mes(2, """
1.Gn44 · 2.Gn45 · 3.Gn46:1-7,28-34 · 4.Gn47 · 5.Gn48 · 6.Gn49 · 7.Gn50 · 8.Ex1 · 9.Ex2 · 10.Ex3 ·
11.Ex4:1-17,27-31 · 12.Ex5 · 13.Ex7 · 14.Ex8 · 15.Ex9 · 16.Ex10 · 17.Ex11 · 18.Ex12 ·
19.Ex13:17-22,14 · 20.Ex15:22-27 · 21.Ex16 · 22.Ex17 · 23.Ex18 · 24.Ex19 · 25.Ex20 · 26.Ex24 ·
27.Ex32 · 28.Ex33
""")

add_mes(3, """
1.Ex34:1-14,21-25 · 2.Ex35:1-29,40 · 3.Lv11 · 4.Nm9:15-23,11 · 5.Nm13 · 6.Nm14 · 7.Nm16 ·
8.Nm17,20 · 9.Nm21 · 10.Nm22 · 11.Nm23 · 12.Nm24 · 13.Nm35 · 14.Dt1:1-17 · 15.Dt5 · 16.Dt32 ·
17.Dt33,34 · 18.Js1 · 19.Js2 · 20.Js3 · 21.Js4 · 22.Js5:10-15,6 · 23.Js7 · 24.Js8 · 25.Js10:1-27 ·
26.Js24 · 27.Jz6 · 28.Jz7 · 29.Jz13,14 · 30.Jz15,16 · 31.Rt1,2
""")

add_mes(4, """
1.Rt3,4 · 2.1Sm1 · 3.1Sm2 · 4.1Sm3 · 5.1Sm4 · 6.1Sm5,6 · 7.1Sm7 · 8.1Sm8 · 9.1Sm9 · 10.1Sm10 ·
11.1Sm11:12-15 · 12.1Sm12 · 13.1Sm13 · 14.1Sm14 · 15.1Sm15 · 16.1Sm16 · 17.1Sm17 ·
18.1Sm18:1-19 · 19.1Sm20 · 20.1Sm24 · 21.1Sm25 · 22.1Sm26 · 23.1Sm31 · 24.2Sm1 · 25.2Sm5 ·
26.2Sm7 · 27.2Sm15 · 28.2Sm17 · 29.2Sm18 · 30.1Rs1:28-53
""")

add_mes(5, """
1.1Rs3 · 2.1Rs4:20-34 · 3.1Rs5 · 4.1Rs6 · 5.1Rs7 · 6.1Rs8 · 7.1Rs10 · 8.1Rs11:6-43 · 9.1Rs12 ·
10.1Rs17 · 11.1Rs18 · 12.1Rs19 · 13.1Rs21 · 14.2Rs1 · 15.2Rs2 · 16.2Rs4 · 17.2Rs5 · 18.2Rs6:1-7 ·
19.2Rs18 · 20.2Rs19 · 21.2Rs20 · 22.2Rs22 · 23.2Rs23:36-37 · 24.2Rs24 · 25.2Rs25:1-22 ·
26.2Cr36 · 27.Ed1 · 28.Ed3,4 · 29.Ed5,6 · 30.Ed7 · 31.Ne1,2
""")

add_mes(6, """
1.Ne4 · 2.Ne5 · 3.Ne6 · 4.Ne8 · 5.Et1 · 6.Et2 · 7.Et3 · 8.Et4 · 9.Et5 · 10.Et6 · 11.Et7 · 12.Et8 ·
13.Et9 · 14.Jó1 · 15.Jó2 · 16.Jó42 · 17.Sl1,15,19 · 18.Sl23,24,27 · 19.Sl37 · 20.Sl39,42,46 ·
21.Sl67,73,84 · 22.Sl90,91,92 · 23.Sl97,98,103 · 24.Sl117,119:1-80 · 25.Sl119:81-176 ·
26.Sl121,125,148 · 27.Pv1 · 28.Pv3 · 29.Pv4 · 30.Pv10
""")

add_mes(7, """
1.Pv15 · 2.Pv25 · 3.Pv31:10-31 · 4.Ec5 · 5.Ec7 · 6.Ec11,12 · 7.Is5 · 8.Is11 · 9.Is26 · 10.Is35 ·
11.Is40 · 12.Is42,43 · 13.Is53 · 14.Is54 · 15.Is60,61 · 16.Jr9:23-26,10 · 17.Jr26 · 18.Jr52 ·
19.Dn1 · 20.Dn2 · 21.Dn3 · 22.Dn4 · 23.Dn5 · 24.Dn6 · 25.Dn7 · 26.Dn8 · 27.Dn9 · 28.Dn10 ·
29.Dn11 · 30.Dn12 · 31.Jl2,Am8
""")

add_mes(8, """
1.Jn1,2 · 2.Jn3,4 · 3.Mq4 · 4.Ag2 · 5.Zc4 · 6.Ml3,4 · 7.Mt1 · 8.Mt2 · 9.Mt3 · 10.Mt4 · 11.Mt5 ·
12.Mt6 · 13.Mt7 · 14.Mt8 · 15.Mt9 · 16.Mt10 · 17.Mt11 · 18.Mt12 · 19.Mt13 · 20.Mt14 · 21.Mt15 ·
22.Mt16 · 23.Mt17 · 24.Mt18 · 25.Mt19 · 26.Mt20 · 27.Mt21 · 28.Mt22 · 29.Mt23 · 30.Mt24 · 31.Mt25
""")

add_mes(9, """
1.Mt26 · 2.Mt27 · 3.Mt28 · 4.Mc1 · 5.Mc2 · 6.Mc3 · 7.Mc4 · 8.Mc5 · 9.Mc6 · 10.Mc7 · 11.Mc8 ·
12.Mc9 · 13.Mc10 · 14.Mc11 · 15.Mc12 · 16.Mc13 · 17.Mc14 · 18.Mc15 · 19.Mc16 · 20.Lc1 · 21.Lc2 ·
22.Lc3 · 23.Lc4 · 24.Lc5 · 25.Lc6 · 26.Lc7 · 27.Lc8 · 28.Lc9 · 29.Lc10 · 30.Lc11
""")

add_mes(10, """
1.Lc12 · 2.Lc13 · 3.Lc14 · 4.Lc15 · 5.Lc16 · 6.Lc17 · 7.Lc18 · 8.Lc19 · 9.Lc20 · 10.Lc21 · 11.Lc22 ·
12.Lc23 · 13.Lc24 · 14.Jo1 · 15.Jo2 · 16.Jo3 · 17.Jo4 · 18.Jo5 · 19.Jo6 · 20.Jo7 · 21.Jo8 · 22.Jo9 ·
23.Jo10 · 24.Jo11 · 25.Jo12 · 26.Jo13 · 27.Jo14 · 28.Jo15 · 29.Jo16 · 30.Jo17 · 31.Jo18
""")

add_mes(11, """
1.Jo19 · 2.Jo20 · 3.Jo21 · 4.At1 · 5.At2 · 6.At3 · 7.At4 · 8.At5 · 9.At6 · 10.At7 · 11.At8 · 12.At9 ·
13.At10 · 14.At11 · 15.At12 · 16.At13 · 17.At14 · 18.At15 · 19.At16 · 20.At17 · 21.At18 · 22.At19 ·
23.At20 · 24.At21 · 25.At22 · 26.At23 · 27.At24 · 28.At25 · 29.At26 · 30.At27
""")

add_mes(12, """
1.At28 · 2.Rm1 · 3.Rm3 · 4.Rm5 · 5.Rm6 · 6.Rm8 · 7.Rm12 · 8.1Co1 · 9.1Co2 · 10.1Co3 · 11.1Co6 ·
12.1Co8 · 13.1Co10 · 14.1Co11 · 15.1Co12 · 16.1Co13 · 17.1Co15 · 18.2Co4 · 19.2Co5 · 20.Gl5 ·
21.Ef2 · 22.Ef6 · 23.Fp2 · 24.Cl1 · 25.Cl3 · 26.1Ts5 · 27.2Tm3 · 28.Hb11 · 29.Tg1 · 30.1Pe1 ·
31.Ap21,22
""")

assert len(PLANO) == 365, f'esperado 365 dias, obtido {len(PLANO)}'
DIAS_POR_MES = {1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30, 7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31}
contagem = {}
for mes, dia, _ in PLANO:
    contagem[mes] = contagem.get(mes, 0) + 1
for mes, esperado in DIAS_POR_MES.items():
    assert contagem.get(mes) == esperado, f'mes {mes}: esperado {esperado}, obtido {contagem.get(mes)}'


def sql_str(v):
    if v is None:
        return 'NULL'
    return "'" + str(v).replace("'", "''") + "'"


def sql_int(v):
    return 'NULL' if v is None else str(v)


linhas_sql = []
ordem = 0
for mes, dia, ref in PLANO:
    ordem += 1
    passagens = parse_dia(ref)
    livro_abrev = passagens[0]['livro']
    livro_nome = LIVROS[livro_abrev]
    passagens_json = json.dumps(
        [{'livro_abrev': p['livro'], 'capitulo': p['capitulo'], 'verso_ini': p['verso_ini'], 'verso_fim': p['verso_fim']} for p in passagens],
        ensure_ascii=False,
    )
    linhas_sql.append(
        f"({mes}, {dia}, FALSE, {ordem}, {sql_str(livro_abrev)}, {sql_str(livro_nome)}, {sql_str(ref)}, '{passagens_json}'::jsonb)"
    )

    # Ano bissexto: 28/fev vira a 1a metade (Ex33:1-11) e 29/fev ganha uma
    # linha extra com a 2a metade (Ex33:12-23), so usadas em anos bissextos.
    if mes == 2 and dia == 28:
        passagens_bis_28 = json.dumps(
            [{'livro_abrev': 'Ex', 'capitulo': 33, 'verso_ini': 1, 'verso_fim': 11}], ensure_ascii=False
        )
        passagens_bis_29 = json.dumps(
            [{'livro_abrev': 'Ex', 'capitulo': 33, 'verso_ini': 12, 'verso_fim': 23}], ensure_ascii=False
        )
        linhas_sql.append(
            f"(2, 28, TRUE, {ordem}, 'Ex', 'Êxodo', 'Ex33:1-11', '{passagens_bis_28}'::jsonb)"
        )
        linhas_sql.append(
            f"(2, 29, TRUE, {ordem + 1}, 'Ex', 'Êxodo', 'Ex33:12-23', '{passagens_bis_29}'::jsonb)"
        )

sql = (
    "-- Seed do plano de 365 dias do Ano Biblico (gerado por "
    "scripts/gerar_seed_ano_biblico.py a partir do PDF fornecido pelo usuario).\n"
    "-- Nao editar a mao: rode o script novamente e substitua este arquivo.\n\n"
    "INSERT INTO public.ano_biblico_catalogo\n"
    "  (mes, dia, ano_bissexto, ordem_no_ano, livro_abrev, livro_nome, referencia, passagens)\n"
    "VALUES\n  "
    + ",\n  ".join(linhas_sql)
    + "\nON CONFLICT (mes, dia, ano_bissexto) DO UPDATE SET\n"
    "  ordem_no_ano = EXCLUDED.ordem_no_ano,\n"
    "  livro_abrev = EXCLUDED.livro_abrev,\n"
    "  livro_nome = EXCLUDED.livro_nome,\n"
    "  referencia = EXCLUDED.referencia,\n"
    "  passagens = EXCLUDED.passagens,\n"
    "  updated_at = now();\n"
)

out_path = 'supabase/migrations/093_ano_biblico_seed.sql'
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(sql)

print(f'OK: {len(PLANO)} dias base + 2 variantes bissextas -> {len(linhas_sql)} linhas escritas em {out_path}')
