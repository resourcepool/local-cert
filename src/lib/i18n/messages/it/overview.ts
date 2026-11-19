import type { overview as en } from '../en/overview';

export const overview: typeof en = {
  stats: {
    active: "Certificati attivi",
    inflight: "In corso",
    expiring: "In scadenza < 30 gg",
    failed: "Falliti",
    domains: "Domini gestiti",
    keys: "Chiavi attive",
  },
  latest: {
    title: "Ultimi certificati",
    viewAll: "vedi tutti →",
    empty: "Nessun certificato. Dichiarare prima un dominio, quindi chiamare {code}.",
    head: { domains: "Domini", status: "Stato", expires: "Scadenza", updated: "Aggiornato" },
    daysShort: "{count} gg",
  },
  acme: {
    title: "Account ACME",
    environment: "Ambiente",
    contact: "Contatto",
    directory: "Directory",
    account: "Account",
    notCreated: "non creato",
    stagingWarning:
      "Ambiente staging: i certificati emessi non sono riconosciuti dai browser. Passare a {code} una volta convalidato il flusso.",
  },
  audit: {
    title: "Registro di audit",
    empty: "Ancora nulla.",
    head: { when: "Quando", action: "Azione", target: "Destinazione", ip: "IP" },
  },
};
