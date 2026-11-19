import type { ui as en } from '../en/ui';

export const ui: typeof en = {
  modal: {
    close: "Chiudi",
    confirmClose: "Conferma la chiusura",
    keepEditing: "continua",
    closeAnyway: "chiudi",
  },
  status: {
    issued: "emesso",
    pending: "in attesa",
    dns_propagating: "propagazione DNS",
    validating: "convalida",
    failed: "non riuscito",
    revoked: "revocato",
    expired: "scaduto",
  },
  copy: {
    action: "copia",
    done: "copiato",
    failed: "errore",
    blockFailed: "copia non riuscita — selezionare il testo",
    title: "Copia",
  },
  confirm: {
    typed: "Per confermare, digitare {typed}",
    cancel: "annulla",
  },
  preflight: {
    ok: "OK",
    refusedRequired: "RIFIUTATO",
    refusedOptional: "rifiutato",
    optionalPrefix: "(facoltativo) ",
  },
};
