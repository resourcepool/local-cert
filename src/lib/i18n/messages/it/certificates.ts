import type { certificates as en } from '../en/certificates';

export const certificates: typeof en = {
  list: {
    title: "Certificati ({count})",
    empty: "Nessun certificato emesso. Utilizzare il modulo a destra oppure {code}.",
    daysLeft: "{count} gg rimanenti",
    autoRenew: "auto-renew",
    logs: "log",
    close: "chiudi",
    renew: "rinnova",
    delete: "elimina",
  },
  removeDialog: {
    title: "Elimina certificato",
    confirm: "Elimina",
    question: "Eliminare il certificato di <b>{names}</b>?",
    bodyIssued:
      "Viene revocato presso Let’s Encrypt, la sua chiave privata viene cancellata e i record DNS creati per esso vengono rimossi. I servizi che lo utilizzano ancora non saranno più riconosciuti. Operazione irreversibile.",
    bodyOther:
      "La sua chiave privata e la cronologia vengono cancellate e i record DNS creati per esso vengono rimossi. I servizi che lo utilizzano ancora non saranno più riconosciuti. Operazione irreversibile.",
  },
  form: {
    title: "Emetti un certificato",
    needDomain: "Dichiarare prima un dominio.",
    managedDomain: "Dominio gestito",
    wildcard: "Wildcard {pattern}",
    host: "Host",
    hostHint: "parte sinistra del sottodominio",
    subject: "soggetto:",
    keyType: "Tipo di chiave",
    keyEc256: "ECDSA P-256 (consigliato)",
    publishA: "Pubblica anche il record A",
    localIp: "IP locale",
    localIpHint: "pubblicato nella zona pubblica di Route53",
    autoRenew: "Rinnovo automatico (G-30)",
    submit: "Emetti",
    asyncNote:
      "L’emissione è asincrona: DNS-01 richiede da 1 a 3 minuti, il tempo necessario perché il TXT si propaghi a tutti gli NS autoritativi.",
  },
  log: { waiting: "in attesa di eventi…" },
};
