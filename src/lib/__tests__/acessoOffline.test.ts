/**
 * Testes das regras do acesso offline ao AcampClasses (validade, PIN, limite de tentativas, relógio).
 * Roda com "node --test" direto (ver "npm run test:acesso-offline").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  PERIODO_AUTORIZACAO_MS, TOLERANCIA_RELOGIO_MS, FALHAS_PARA_APAGAR, TENTATIVAS_ZERADAS,
  novaConcessao, concessaoValida, registrarUso, renovarConcessao, validarFormatoPin,
  calcularBloqueio, registrarFalha, tentativaPermitida, derivarHashPin, iguaisConstante,
} from '../acessoOfflineNucleo.ts';

const sha = async (t: string) => createHash('sha256').update(t).digest('hex');
const base = { usuarioId: 'u1', nome: 'Ana', perfil: 'usuario_diretoria', clubeId: 1 };
const T0 = Date.UTC(2026, 9, 27, 12, 0, 0);

test('autorização vale dentro do período e expira depois', () => {
  const c = novaConcessao(base, T0, true);
  assert.deepEqual(concessaoValida(c, T0 + 1000), { ok: true });
  assert.deepEqual(concessaoValida(c, T0 + PERIODO_AUTORIZACAO_MS), { ok: true });
  assert.deepEqual(concessaoValida(c, T0 + PERIODO_AUTORIZACAO_MS + 1), { ok: false, motivo: 'expirada' });
});

test('sem autorização, ou de versão desconhecida, não abre', () => {
  assert.deepEqual(concessaoValida(null, T0), { ok: false, motivo: 'ausente' });
  assert.deepEqual(concessaoValida({ ...novaConcessao(base, T0, false), versao: 2 as any }, T0), { ok: false, motivo: 'ausente' });
});

test('voltar o relógio do aparelho não estende a autorização', () => {
  let c = novaConcessao(base, T0, false);
  c = registrarUso(c, T0 + PERIODO_AUTORIZACAO_MS - 1000); // usou perto do fim
  assert.deepEqual(concessaoValida(c, T0 + 1000), { ok: false, motivo: 'relogio' });
  // pequeno acerto de relógio (dentro da tolerância) é aceito
  assert.deepEqual(concessaoValida(c, c.ultimoUsoEm - TOLERANCIA_RELOGIO_MS + 1), { ok: true });
});

test('registrarUso nunca recua o último uso', () => {
  const c = registrarUso(novaConcessao(base, T0, false), T0 + 5000);
  assert.equal(registrarUso(c, T0).ultimoUsoEm, T0 + 5000);
});

test('renovar online estende o prazo e preserva a escolha de biometria', () => {
  const c = novaConcessao(base, T0, true);
  const r = renovarConcessao(c, { nome: 'Ana B.', perfil: 'admin_clube', clubeId: 1 }, T0 + 10_000);
  assert.equal(r.expiraEm, T0 + 10_000 + PERIODO_AUTORIZACAO_MS);
  assert.equal(r.biometria, true);
  assert.equal(r.nome, 'Ana B.');
});

test('formato do PIN: 6 números, sem repetição nem sequência', () => {
  assert.equal(validarFormatoPin('483920'), null);
  assert.notEqual(validarFormatoPin('12345'), null);
  assert.notEqual(validarFormatoPin('1234567'), null);
  assert.notEqual(validarFormatoPin('12a456'), null);
  assert.notEqual(validarFormatoPin('111111'), null);
  assert.notEqual(validarFormatoPin('123456'), null);
  assert.notEqual(validarFormatoPin('654321'), null);
});

test('hash do PIN: determinístico, depende do sal e não contém o PIN', async () => {
  const h1 = await derivarHashPin('483920', 'salA', sha, 50);
  assert.equal(h1, await derivarHashPin('483920', 'salA', sha, 50));
  assert.notEqual(h1, await derivarHashPin('483920', 'salB', sha, 50));
  assert.notEqual(h1, await derivarHashPin('483921', 'salA', sha, 50));
  assert.ok(!h1.includes('483920'));
  assert.match(h1, /^[0-9a-f]{64}$/);
});

test('comparação em tempo constante', () => {
  assert.equal(iguaisConstante('abc', 'abc'), true);
  assert.equal(iguaisConstante('abc', 'abd'), false);
  assert.equal(iguaisConstante('abc', 'abcd'), false);
});

test('limite de tentativas: livre até 4 erros, depois espera crescente, e apaga no 10º', () => {
  for (let n = 1; n <= 4; n++) assert.equal(calcularBloqueio(n).bloqueioMs, 0);
  const esperas = [5, 6, 7, 8, 9].map((n) => calcularBloqueio(n).bloqueioMs);
  assert.deepEqual(esperas, [...esperas].sort((a, b) => a - b));
  assert.ok(esperas[0] > 0);
  assert.equal(calcularBloqueio(FALHAS_PARA_APAGAR).apagar, true);
  assert.equal(calcularBloqueio(FALHAS_PARA_APAGAR - 1).apagar, false);
});

test('registrar falhas em sequência bloqueia, e o bloqueio libera com o tempo', () => {
  let est = TENTATIVAS_ZERADAS;
  for (let i = 0; i < 4; i++) est = registrarFalha(est, T0).estado;
  assert.deepEqual(tentativaPermitida(est, T0), { ok: true });
  est = registrarFalha(est, T0).estado; // 5º erro
  const bloqueado = tentativaPermitida(est, T0 + 1000);
  assert.equal(bloqueado.ok, false);
  assert.deepEqual(tentativaPermitida(est, T0 + 31_000), { ok: true });
});

test('o 10º erro seguido manda apagar o PIN', () => {
  let est = TENTATIVAS_ZERADAS;
  let apagar = false;
  for (let i = 0; i < FALHAS_PARA_APAGAR; i++) ({ estado: est, apagar } = registrarFalha(est, T0));
  assert.equal(apagar, true);
});
