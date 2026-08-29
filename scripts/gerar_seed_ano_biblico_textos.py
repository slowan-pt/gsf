#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Busca o texto biblico (4 traducoes de dominio publico) apenas dos capitulos
referenciados no plano do Ano Biblico, e gera
supabase/migrations/094_ano_biblico_textos_seed.sql.

Fontes (todas de dominio publico):
  - Portugues: Almeida Livre  -> midvash/bible-data (versions/pt/almeida-livre)
  - Ingles:    King James     -> midvash/bible-data (versions/en/kjv)
  - Frances:   Louis Segond 1910 -> midvash/bible-data (versions/fr/lsg)
  - Espanhol:  Reina-Valera 1909 -> api.getbible.net/v2/valera (dominio publico,
               conforme distribution_license do proprio catalogo getbible)

Depende de supabase/migrations/093_ano_biblico_seed.sql ja existir (roda
scripts/gerar_seed_ano_biblico.py antes) para saber quais (livro, capitulo)
buscar.

Uso: python scripts/gerar_seed_ano_biblico_textos.py
"""
import json
import re
import time
import urllib.request
import urllib.error

MIDVASH_RAW = 'https://raw.githubusercontent.com/midvash/bible-data/master/versions/{lang_dir}/books/{book}.json'
GETBIBLE_URL = 'https://api.getbible.net/v2/valera/{nr}/{cap}.json'

# idioma -> subpasta de versions/ no midvash/bible-data (confirmado por
# inspecao do repo: pt tem so 'almeida-livre', en usamos 'kjv', fr usamos 'lsg').
MIDVASH_LANG_DIR = {'pt': 'pt/almeida-livre', 'en': 'en/kjv', 'fr': 'fr/lsg'}

# livro_abrev (usado no catalogo, PT) -> chave de arquivo midvash (comum a
# pt/en/fr) + numero do livro (ordem protestante padrao 1-66, usado pelo
# getbible.net para o RV1909).
LIVRO_INFO = {
    'Gn':  ('Gen',    1), 'Ex':  ('Exod',   2), 'Lv':  ('Lev',    3), 'Nm':  ('Num',    4),
    'Dt':  ('Deut',   5), 'Js':  ('Josh',   6), 'Jz':  ('Judg',   7), 'Rt':  ('Ruth',   8),
    '1Sm': ('1Sam',   9), '2Sm': ('2Sam',  10), '1Rs': ('1Kgs',  11), '2Rs': ('2Kgs',  12),
    '2Cr': ('2Chr',  14), 'Ed':  ('Ezra',  15), 'Ne':  ('Neh',   16), 'Et':  ('Esth',  17),
    'Jó':  ('Job',   18), 'Sl':  ('Ps',    19), 'Pv':  ('Prov',  20), 'Ec':  ('Eccl',  21),
    'Is':  ('Isa',   23), 'Jr':  ('Jer',   24), 'Dn':  ('Dan',   27), 'Jl':  ('Joel',  29),
    'Am':  ('Amos',  30), 'Jn':  ('Jonah', 32), 'Mq':  ('Mic',   33), 'Ag':  ('Hag',   37),
    'Zc':  ('Zech',  38), 'Ml':  ('Mal',   39), 'Mt':  ('Matt',  40), 'Mc':  ('Mark',  41),
    'Lc':  ('Luke',  42), 'Jo':  ('John',  43), 'At':  ('Acts',  44), 'Rm':  ('Rom',   45),
    '1Co': ('1Cor',  46), '2Co': ('2Cor',  47), 'Gl':  ('Gal',   48), 'Ef':  ('Eph',   49),
    'Fp':  ('Phil',  50), 'Cl':  ('Col',   51), '1Ts': ('1Thess',52), '2Tm': ('2Tim',  55),
    'Hb':  ('Heb',   58), 'Tg':  ('Jas',   59), '1Pe': ('1Pet',  60), 'Ap':  ('Rev',   66),
}

FONTES = {
    'pt': 'Almeida Livre',
    'en': 'King James Version',
    'fr': 'Louis Segond 1910',
    'es': 'Reina-Valera 1909',
}

_cache_midvash = {}  # (lang_dir, book_key) -> parsed json


def buscar_json(url, tentativas=3):
    ultimo_erro = None
    for _ in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'gsf-clubes-ano-biblico/1.0'})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode('utf-8'))
        except (urllib.error.URLError, urllib.error.HTTPError) as e:
            ultimo_erro = e
            time.sleep(1)
    raise RuntimeError(f'Falha ao buscar {url}: {ultimo_erro}')


def capitulo_midvash(idioma, livro_abrev, capitulo):
    book_key, _ = LIVRO_INFO[livro_abrev]
    lang_dir = MIDVASH_LANG_DIR[idioma]
    cache_key = (lang_dir, book_key)
    if cache_key not in _cache_midvash:
        url = MIDVASH_RAW.format(lang_dir=lang_dir, book=book_key)
        _cache_midvash[cache_key] = buscar_json(url)
    livro_json = _cache_midvash[cache_key]
    for cap in livro_json['chapters']:
        if cap['chapter'] == capitulo:
            return [{'numero': v['number'], 'texto': v['text'].strip()} for v in cap['verses']]
    raise ValueError(f'{book_key} {capitulo} nao encontrado em {lang_dir}')


def capitulo_getbible(livro_abrev, capitulo):
    _, book_nr = LIVRO_INFO[livro_abrev]
    data = buscar_json(GETBIBLE_URL.format(nr=book_nr, cap=capitulo))
    return [{'numero': v['verse'], 'texto': v['text'].strip()} for v in data['verses']]


def sql_str(v):
    return "'" + str(v).replace("'", "''") + "'"


def main():
    with open('supabase/migrations/093_ano_biblico_seed.sql', encoding='utf-8') as f:
        seed_sql = f.read()

    pares = set()
    for m in re.finditer(r'"livro_abrev":\s*"([^"]+)",\s*"capitulo":\s*(\d+)', seed_sql):
        pares.add((m.group(1), int(m.group(2))))
    pares = sorted(pares)
    print(f'{len(pares)} pares (livro, capitulo) distintos a buscar.')

    linhas_sql = []
    falhas = []
    for i, (livro, capitulo) in enumerate(pares, 1):
        print(f'[{i}/{len(pares)}] {livro} {capitulo}...')
        for idioma in ('pt', 'en', 'fr', 'es'):
            try:
                if idioma == 'es':
                    versiculos = capitulo_getbible(livro, capitulo)
                else:
                    versiculos = capitulo_midvash(idioma, livro, capitulo)
            except Exception as e:
                falhas.append((livro, capitulo, idioma, str(e)))
                print(f'  FALHA {idioma}: {e}')
                continue
            versiculos_json = json.dumps(versiculos, ensure_ascii=False)
            linhas_sql.append(
                f"({sql_str(livro)}, {capitulo}, {sql_str(idioma)}, '{versiculos_json.replace(chr(39), chr(39)+chr(39))}'::jsonb, {sql_str(FONTES[idioma])})"
            )

    header = (
        "-- Seed do texto biblico (4 traducoes de dominio publico) dos capitulos\n"
        "-- referenciados no plano do Ano Biblico. Gerado por\n"
        "-- scripts/gerar_seed_ano_biblico_textos.py. Nao editar a mao.\n\n"
    )
    if falhas:
        header += "-- ATENCAO: as buscas abaixo falharam e NAO estao neste arquivo:\n"
        for livro, capitulo, idioma, erro in falhas:
            header += f"--   {livro} {capitulo} ({idioma}): {erro}\n"
        header += "\n"

    body = (
        "INSERT INTO public.ano_biblico_textos (livro_abrev, capitulo, idioma, versiculos, fonte)\n"
        "VALUES\n  " + ",\n  ".join(linhas_sql) + "\n"
        "ON CONFLICT (livro_abrev, capitulo, idioma) DO UPDATE SET\n"
        "  versiculos = EXCLUDED.versiculos,\n"
        "  fonte = EXCLUDED.fonte,\n"
        "  updated_at = now();\n"
    ) if linhas_sql else "-- Nenhum texto obtido.\n"

    with open('supabase/migrations/094_ano_biblico_textos_seed.sql', 'w', encoding='utf-8') as f:
        f.write(header + body)

    print(f'OK: {len(linhas_sql)} linhas escritas, {len(falhas)} falhas.')


if __name__ == '__main__':
    main()
