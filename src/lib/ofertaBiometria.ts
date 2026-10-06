/**
 * Oferta de "entrar com biometria": guardada só em memória entre o login e a tela Início.
 * O aviso aparece quando a Início carrega (depois do MFA, se houver), nunca antes.
 * Some ao sair da conta ou depois de mostrada.
 */
let pendente: { email: string; senha: string } | null = null;

export function guardarOfertaBiometria(email: string, senha: string): void {
  pendente = { email, senha };
}

export function pegarOfertaBiometria(): { email: string; senha: string } | null {
  const oferta = pendente;
  pendente = null;
  return oferta;
}

export function limparOfertaBiometria(): void {
  pendente = null;
}
