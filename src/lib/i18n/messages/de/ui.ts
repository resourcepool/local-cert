import type { ui as en } from '../en/ui';

export const ui: typeof en = {
  modal: {
    close: "Schließen",
    confirmClose: "Schließen bestätigen",
    keepEditing: "weiter bearbeiten",
    closeAnyway: "schließen",
  },
  status: {
    issued: "ausgestellt",
    pending: "ausstehend",
    dns_propagating: "DNS-Verbreitung",
    validating: "Validierung",
    failed: "fehlgeschlagen",
    revoked: "widerrufen",
    expired: "abgelaufen",
  },
  copy: {
    action: "kopieren",
    done: "kopiert",
    failed: "fehlgeschlagen",
    blockFailed: "Kopieren nicht möglich — Text bitte markieren",
    title: "Kopieren",
  },
  confirm: {
    typed: "Zur Bestätigung {typed} eingeben",
    cancel: "abbrechen",
  },
  preflight: {
    ok: "OK",
    refusedRequired: "ABGELEHNT",
    refusedOptional: "abgelehnt",
    optionalPrefix: "(optional) ",
  },
};
