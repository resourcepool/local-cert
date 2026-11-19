import type { overview as en } from '../en/overview';

export const overview: typeof en = {
  stats: {
    active: "Certificados ativos",
    inflight: "Em curso",
    expiring: "Expiram em < 30 d",
    failed: "Falhados",
    domains: "Domínios geridos",
    keys: "Chaves ativas",
  },
  latest: {
    title: "Últimos certificados",
    viewAll: "ver tudo →",
    empty: "Ainda não existem certificados. Declare primeiro um domínio e, em seguida, chame {code}.",
    head: { domains: "Domínios", status: "Estado", expires: "Expira", updated: "Atualizado" },
    daysShort: "{count} d",
  },
  acme: {
    title: "Conta ACME",
    environment: "Ambiente",
    contact: "Contacto",
    directory: "Directory",
    account: "Conta",
    notCreated: "não criada",
    stagingWarning:
      "Ambiente staging: os certificados emitidos não são reconhecidos pelos navegadores. Passe para {code} depois de validado o fluxo.",
  },
  audit: {
    title: "Registo de auditoria",
    empty: "Nada por agora.",
    head: { when: "Quando", action: "Ação", target: "Destino", ip: "IP" },
  },
};
