import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/**
 * Classes bíblicas em HTML. A original (Jóias da Eternidade) é um arquivo
 * estático do app; as demais são cadastradas pelo Admin TI na tabela
 * classes_biblicas e valem para todos os clubes. As respostas dos campos são
 * do usuário: ficam salvas no aparelho (funciona offline) e sincronizam com a
 * nuvem (classes_biblicas_respostas), valendo a edição mais recente de cada campo.
 */
export interface ClasseBiblica {
  slug: string;
  titulo: string;
  descricao: string | null;
  /** null = classe integrada ao app (arquivo estático), sem HTML no banco. */
  html: string | null;
  integrada: boolean;
}

export const SLUG_INTEGRADA = 'joias-da-eternidade';

export const CLASSE_INTEGRADA: ClasseBiblica = {
  slug: SLUG_INTEGRADA,
  titulo: 'Jóias da Eternidade',
  descricao: 'Estudo bíblico · Classe Bíblica',
  html: null,
  integrada: true,
};

const CHAVE_LISTA = 'cb_lista_v1';
const chaveHtml = (slug: string) => `cb_html_v1:${slug}`;

async function lerJson<T>(chave: string): Promise<T | null> {
  try {
    const bruto = await AsyncStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
}

async function gravarJson(chave: string, valor: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(chave, JSON.stringify(valor));
  } catch { /* cache é só conveniência */ }
}

/** Menu de classes: a integrada + as cadastradas (com cache para uso offline). */
export async function listarClasses(): Promise<ClasseBiblica[]> {
  let remotas: ClasseBiblica[] | null = null;
  try {
    const { data, error } = await supabase
      .from('classes_biblicas')
      .select('slug,titulo,descricao')
      .eq('ativo', true)
      .order('ordem')
      .order('titulo');
    if (error) throw error;
    remotas = ((data ?? []) as any[]).map((c) => ({
      slug: c.slug, titulo: c.titulo, descricao: c.descricao ?? null, html: null, integrada: false,
    }));
    await gravarJson(CHAVE_LISTA, remotas);
  } catch {
    remotas = await lerJson<ClasseBiblica[]>(CHAVE_LISTA);
  }
  return [CLASSE_INTEGRADA, ...(remotas ?? []).filter((c) => c.slug !== SLUG_INTEGRADA)];
}

/** HTML de uma classe cadastrada; sem rede usa a última cópia guardada no aparelho. */
export async function carregarClasse(slug: string): Promise<ClasseBiblica | null> {
  if (slug === SLUG_INTEGRADA) return CLASSE_INTEGRADA;
  try {
    const { data, error } = await supabase
      .from('classes_biblicas')
      .select('slug,titulo,descricao,html')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      const classe: ClasseBiblica = {
        slug: data.slug, titulo: data.titulo, descricao: data.descricao ?? null, html: data.html, integrada: false,
      };
      await gravarJson(chaveHtml(slug), classe);
      return classe;
    }
  } catch { /* offline: cai no cache */ }
  return lerJson<ClasseBiblica>(chaveHtml(slug));
}

/* ─── Respostas: local + nuvem ─────────────────────────────────── */

interface RespostaLocal { v: string; t: number }
type MapaLocal = Record<string, RespostaLocal>;

const LIMITE_CAMPOS = 500;
const LIMITE_CHAVE = 120;
const LIMITE_VALOR = 20000;

const chaveResp = (uid: string, clube: number, slug: string) => `cb_resp_v1:${uid}:${clube}:${slug}`;
const chavePend = (uid: string, clube: number, slug: string) => `cb_pend_v1:${uid}:${clube}:${slug}`;

function limparDados(dados: Record<string, unknown>): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const [campo, valor] of Object.entries(dados).slice(0, LIMITE_CAMPOS)) {
    if (!campo || campo.length > LIMITE_CHAVE) continue;
    saida[campo] = String(valor ?? '').slice(0, LIMITE_VALOR);
  }
  return saida;
}

function comoValores(mapa: MapaLocal): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const [campo, r] of Object.entries(mapa)) if (r.v !== '') valores[campo] = r.v;
  return valores;
}

/**
 * Respostas do usuário nesta classe: junta o que está no aparelho com o que
 * está na nuvem (vale a edição mais recente de cada campo) e devolve o mapa
 * campo → texto. Alterações feitas offline sobem na mesma chamada.
 */
export async function carregarRespostas(uid: string, clube: number, slug: string): Promise<Record<string, string>> {
  const local = (await lerJson<MapaLocal>(chaveResp(uid, clube, slug))) ?? {};
  try {
    const { data, error } = await supabase
      .from('classes_biblicas_respostas')
      .select('campo_id,resposta,updated_at')
      .eq('usuario_id', uid)
      .eq('clube_id', clube)
      .eq('classe_slug', slug);
    if (error) throw error;

    const mesclado: MapaLocal = { ...local };
    const remotos = new Set<string>();
    for (const r of (data ?? []) as any[]) {
      remotos.add(r.campo_id);
      const t = new Date(r.updated_at).getTime() || 0;
      if (!mesclado[r.campo_id] || mesclado[r.campo_id].t < t) {
        mesclado[r.campo_id] = { v: r.resposta ?? '', t };
      }
    }
    await gravarJson(chaveResp(uid, clube, slug), mesclado);

    // O que só existe (ou é mais novo) no aparelho sobe agora.
    const paraSubir = Object.entries(mesclado).filter(([campo, r]) => {
      const remoto = ((data ?? []) as any[]).find((x) => x.campo_id === campo);
      return !remoto ? r.v !== '' : (new Date(remoto.updated_at).getTime() || 0) < r.t;
    });
    if (paraSubir.length > 0) {
      await enviarParaNuvem(uid, clube, slug, Object.fromEntries(paraSubir.map(([campo, r]) => [campo, r.v])), mesclado);
    }
    return comoValores(mesclado);
  } catch {
    return comoValores(local);
  }
}

async function enviarParaNuvem(
  uid: string, clube: number, slug: string,
  campos: Record<string, string>, mapa: MapaLocal,
): Promise<boolean> {
  try {
    const preenchidos = Object.entries(campos).filter(([, v]) => v.trim() !== '');
    const vazios = Object.entries(campos).filter(([, v]) => v.trim() === '').map(([c]) => c);
    if (preenchidos.length > 0) {
      const { error } = await supabase.from('classes_biblicas_respostas').upsert(
        preenchidos.map(([campo_id, resposta]) => ({
          usuario_id: uid,
          clube_id: clube,
          classe_slug: slug,
          campo_id,
          resposta,
          updated_at: new Date(mapa[campo_id]?.t ?? Date.now()).toISOString(),
        })),
        { onConflict: 'usuario_id,clube_id,classe_slug,campo_id' },
      );
      if (error) throw error;
    }
    if (vazios.length > 0) {
      const { error } = await supabase
        .from('classes_biblicas_respostas')
        .delete()
        .eq('usuario_id', uid).eq('clube_id', clube).eq('classe_slug', slug)
        .in('campo_id', vazios);
      if (error) throw error;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Salva as respostas: primeiro no aparelho (nunca se perde), depois na nuvem.
 * `dados` é o retrato atual dos campos; só os que mudaram são regravados.
 * Se a nuvem falhar (offline), fica marcado como pendente e sobe no próximo acesso.
 */
export async function salvarRespostas(
  uid: string, clube: number, slug: string,
  dados: Record<string, unknown>,
  camposPermitidos?: ReadonlySet<string>,
): Promise<boolean> {
  const novos = limparDados(dados);
  const local = (await lerJson<MapaLocal>(chaveResp(uid, clube, slug))) ?? {};
  const agora = Date.now();
  const alterados: Record<string, string> = {};

  const todos = new Set([...Object.keys(novos), ...Object.keys(local)]);
  for (const campo of todos) {
    if (camposPermitidos && !camposPermitidos.has(campo)) continue;
    const atual = novos[campo] ?? '';
    if ((local[campo]?.v ?? '') === atual) continue;
    local[campo] = { v: atual, t: agora };
    alterados[campo] = atual;
  }
  if (Object.keys(alterados).length === 0) return true;

  await gravarJson(chaveResp(uid, clube, slug), local);
  const pendentes = { ...((await lerJson<Record<string, string>>(chavePend(uid, clube, slug))) ?? {}), ...alterados };
  const ok = await enviarParaNuvem(uid, clube, slug, pendentes, local);
  if (ok) await AsyncStorage.removeItem(chavePend(uid, clube, slug)).catch(() => {});
  else await gravarJson(chavePend(uid, clube, slug), pendentes);
  return ok;
}

/* ─── Ponte com o HTML ─────────────────────────────────────────── */

/**
 * Script injetado nas classes cadastradas: descobre sozinho os campos que
 * recebem resposta (input, textarea, select, contenteditable com id, name ou
 * data-campo), preenche com o que o usuário já respondeu e avisa o app a cada
 * alteração. Funciona no navegador (iframe) e no app (WebView).
 */
const SCRIPT_PONTE = `
(function () {
  var SEL = 'input:not([type=button]):not([type=submit]):not([type=reset]):not([type=file]):not([type=password]):not([type=hidden]):not([type=image]), textarea, select, [contenteditable="true"]';
  var salvo = {};
  var aplicando = false;
  var temporizador = null;

  function enviar(msg) {
    try {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      else window.parent.postMessage(msg, '*');
    } catch (e) {}
  }
  function chave(el) {
    var base = el.getAttribute('data-campo') || el.id || el.name;
    if (!base) return null;
    if (el.type === 'radio') return el.name || base;
    if (el.type === 'checkbox' && !el.getAttribute('data-campo') && !el.id && el.name) return el.name + '::' + el.value;
    return base;
  }
  function ler(el) {
    if (el.type === 'checkbox') return el.checked ? '1' : '';
    if (el.isContentEditable && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return el.innerText || '';
    return el.value || '';
  }
  function coletar() {
    var dados = {};
    var lista = document.querySelectorAll(SEL);
    for (var i = 0; i < lista.length; i++) {
      var el = lista[i];
      var k = chave(el);
      if (!k) continue;
      if (el.type === 'radio') { if (el.checked) dados[k] = el.value; else if (!(k in dados)) dados[k] = ''; }
      else dados[k] = ler(el);
    }
    return dados;
  }
  function escrever(el, v) {
    if (el.type === 'checkbox') el.checked = v === '1';
    else if (el.type === 'radio') el.checked = el.value === v;
    else if (el.isContentEditable && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') el.innerText = v;
    else el.value = v;
    var ev = document.createEvent('Event');
    ev.initEvent(el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio' ? 'change' : 'input', true, true);
    el.dispatchEvent(ev);
  }
  function aplicar() {
    aplicando = true;
    var lista = document.querySelectorAll(SEL);
    for (var i = 0; i < lista.length; i++) {
      var el = lista[i];
      var k = chave(el);
      if (!k || !(k in salvo)) continue;
      if (ler(el) !== salvo[k] && !(el.type === 'radio' && (el.checked === (el.value === salvo[k])))) escrever(el, salvo[k]);
    }
    aplicando = false;
  }
  function agendar() {
    if (aplicando) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(function () { enviar({ type: 'cb_save', dados: coletar() }); }, 600);
  }
  function receber(e) {
    var d = e && e.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (x) { return; } }
    if (!d || d.type !== 'cb_load') return;
    salvo = d.dados || {};
    aplicar();
    setTimeout(aplicar, 400);
    setTimeout(aplicar, 1500);
  }
  window.addEventListener('message', receber);
  document.addEventListener('message', receber);
  document.addEventListener('input', agendar, true);
  document.addEventListener('change', agendar, true);
  function pronto() { enviar({ type: 'cb_ready' }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pronto); else pronto();
})();
`;

/** Insere a ponte no HTML cadastrado (antes de </body>, ou no fim). */
export function htmlComPonte(html: string): string {
  const tag = `<script>${SCRIPT_PONTE}</script>`;
  const i = html.toLowerCase().lastIndexOf('</body>');
  return i >= 0 ? `${html.slice(0, i)}${tag}${html.slice(i)}` : `${html}${tag}`;
}

/** slug a partir do título: "Pérolas para a Eternidade" → "perolas-para-a-eternidade". */
export function slugDoTitulo(titulo: string): string {
  return titulo
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
