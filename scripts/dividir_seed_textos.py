#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
O Supabase SQL Editor recusa a migration 094 inteira (~8MB, 1612 linhas)
com "Query is too large to be run via the SQL Editor". Este script divide
o mesmo conteudo em varios arquivos menores, cada um um INSERT completo e
independente (com seu proprio ON CONFLICT), para rodar um de cada vez.

Uso: python scripts/dividir_seed_textos.py
Le supabase/migrations/094_ano_biblico_textos_seed.sql (ja gerado por
gerar_seed_ano_biblico_textos.py) e escreve
supabase/migrations/094_ano_biblico_textos_seed_NN.sql (01, 02, ...).
"""
import re

LINHAS_POR_ARQUIVO = 100

ORIGEM = 'supabase/migrations/094_ano_biblico_textos_seed.sql'


def dividir_linhas_top_level(body: str):
    """Separa o corpo do VALUES em linhas individuais '(...)', respeitando
    parenteses aninhados (JSON) e aspas simples escapadas (dobradas)."""
    rows = []
    depth = 0
    in_str = False
    start = 0
    i = 0
    n = len(body)
    while i < n:
        c = body[i]
        if in_str:
            if c == "'":
                if i + 1 < n and body[i + 1] == "'":
                    i += 2
                    continue
                in_str = False
        else:
            if c == "'":
                in_str = True
            elif c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0:
                    rows.append(body[start:i + 1])
                    j = i + 1
                    while j < n and body[j] in ',\n \r':
                        j += 1
                    start = j
                    i = j
                    continue
        i += 1
    return rows


def main():
    with open(ORIGEM, encoding='utf-8') as f:
        content = f.read()

    m = re.search(r'VALUES\n(.*)\nON CONFLICT.*?;\n?', content, re.S)
    if not m:
        raise RuntimeError('Não encontrei o bloco VALUES...ON CONFLICT no arquivo de origem.')
    body = m.group(1)
    rows = dividir_linhas_top_level(body)
    print(f'{len(rows)} linhas encontradas no seed original.')

    conflito = (
        "ON CONFLICT (livro_abrev, capitulo, idioma) DO UPDATE SET\n"
        "  versiculos = EXCLUDED.versiculos,\n"
        "  fonte = EXCLUDED.fonte,\n"
        "  updated_at = now();\n"
    )

    total_arquivos = (len(rows) + LINHAS_POR_ARQUIVO - 1) // LINHAS_POR_ARQUIVO
    for indice in range(total_arquivos):
        lote = rows[indice * LINHAS_POR_ARQUIVO:(indice + 1) * LINHAS_POR_ARQUIVO]
        numero = str(indice + 1).zfill(2)
        caminho = f'supabase/migrations/094_ano_biblico_textos_seed_{numero}.sql'
        sql = (
            f"-- Parte {numero}/{str(total_arquivos).zfill(2)} do seed de texto biblico do Ano Biblico.\n"
            f"-- Gerado por scripts/dividir_seed_textos.py a partir de {ORIGEM}.\n"
            f"-- Rode todas as partes, em ordem, no SQL Editor do Supabase.\n\n"
            "INSERT INTO public.ano_biblico_textos (livro_abrev, capitulo, idioma, versiculos, fonte)\n"
            "VALUES\n  " + ",\n  ".join(lote) + "\n" + conflito
        )
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write(sql)
        print(f'{caminho}: {len(lote)} linhas, {len(sql)} bytes')

    print(f'OK: {total_arquivos} arquivos escritos.')


if __name__ == '__main__':
    main()
