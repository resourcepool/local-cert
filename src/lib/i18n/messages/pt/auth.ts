import type { auth as en } from '../en/auth';

export const auth: typeof en = {
  tagline: "Certificados Let's Encrypt para as máquinas da sua rede local.",
  login: {
    title: "Início de sessão",
    email: "Email",
    password: "Palavra-passe",
    checking: "A verificar…",
    submit: "Iniciar sessão",
  },
  setup: {
    intro: "Primeira configuração: criação da conta de administrador.",
    createdTitle: "Conta criada",
    createdBody: "Conta de administrador {email} criada. A sessão já está iniciada.",
    keyShownOnce: "Chave de API — apresentada uma única vez",
    keyNote: "Apenas o respetivo hash é guardado. Anote-a agora: não pode ser recuperada. Em caso de perda: <code>npx tsx scripts/reset-admin.ts {email} <palavra-passe></code>.",
    openConsole: "Abrir a consola",
    accountTitle: "Conta de administrador",
    email: "Email",
    password: "Palavra-passe",
    confirmation: "Confirmação",
    moreChars: "Faltam {count} caracter(es).",
    moreClasses: "Faltam {count} categoria(s) de caracteres.",
    mismatch: "As palavras-passe não coincidem.",
    ownKey: "Usar a minha própria chave de API",
    apiKey: "Chave de API",
    apiKeyHint: "Mínimo de 24 caracteres — guardada com hash, nunca voltará a ser apresentada",
    generated: "Será gerada uma chave, apresentada uma única vez no passo seguinte.",
    creating: "A criar…",
    create: "Criar conta",
    once: "Esta página só é apresentada uma vez. Para automatizar, defina <code>ADMIN_EMAIL</code>, <code>ADMIN_PASSWORD</code> e, opcionalmente, <code>ADMIN_API_KEY</code> antes do primeiro arranque.",
  },
  policy: {
    none: "Sem política de palavras-passe no ambiente de desenvolvimento.",
    rules: "Mínimo de {minLength} caracteres, combinando pelo menos {requiredClasses} categorias entre minúscula, maiúscula, algarismo e símbolo. As palavras-passe comuns e as que contêm o endereço de e-mail são recusadas.",
  },
};
