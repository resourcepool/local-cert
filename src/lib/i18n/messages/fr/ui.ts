import type { ui as en } from '../en/ui';

export const ui: typeof en = {
  modal: {
    close: "Fermer",
    confirmClose: "Confirmer la fermeture",
    keepEditing: "continuer",
    closeAnyway: "fermer",
  },
  status: {
    issued: "émis",
    pending: "en attente",
    dns_propagating: "propagation DNS",
    validating: "validation",
    failed: "échec",
    revoked: "révoqué",
    expired: "expiré",
  },
  copy: {
    action: "copier",
    done: "copié",
    failed: "échec",
    blockFailed: "copie impossible — sélectionnez le texte",
    title: "Copier",
  },
  confirm: {
    typed: "Pour confirmer, saisissez {typed}",
    cancel: "annuler",
  },
  preflight: {
    ok: "OK",
    refusedRequired: "REFUSÉ",
    refusedOptional: "refusé",
    optionalPrefix: "(optionnel) ",
  },
};
