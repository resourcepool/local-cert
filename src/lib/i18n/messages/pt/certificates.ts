import type { certificates as en } from '../en/certificates';

export const certificates: typeof en = {
  list: {
    title: "Certificados ({count})",
    empty: "Nenhum certificado emitido. Utilize o formulário à direita ou {code}.",
    daysLeft: "{count} d restantes",
    autoRenew: "auto-renew",
    logs: "logs",
    close: "fechar",
    renew: "renovar",
    delete: "eliminar",
  },
  removeDialog: {
    title: "Eliminar certificado",
    confirm: "Eliminar",
    question: "Eliminar o certificado de <b>{names}</b>?",
    bodyIssued:
      "É revogado na Let’s Encrypt, a sua chave privada é apagada e os registos DNS criados para ele são removidos. Os serviços que ainda o utilizem deixarão de ser reconhecidos. Irreversível.",
    bodyOther:
      "A sua chave privada e o histórico são apagados, e os registos DNS criados para ele são removidos. Os serviços que ainda o utilizem deixarão de ser reconhecidos. Irreversível.",
  },
  form: {
    title: "Emitir um certificado",
    needDomain: "Declare primeiro um domínio.",
    managedDomain: "Domínio gerido",
    wildcard: "Wildcard {pattern}",
    host: "Anfitrião",
    hostHint: "parte esquerda do subdomínio",
    subject: "assunto:",
    keyType: "Tipo de chave",
    keyEc256: "ECDSA P-256 (recomendado)",
    publishA: "Publicar também o registo A",
    localIp: "IP local",
    localIpHint: "publicado na zona pública do Route53",
    autoRenew: "Renovação automática (D-30)",
    submit: "Emitir",
    asyncNote:
      "A emissão é assíncrona: o DNS-01 demora 1 a 3 minutos, o tempo necessário para o TXT se propagar por todos os NS autoritativos.",
  },
  log: { waiting: "a aguardar eventos…" },
};
