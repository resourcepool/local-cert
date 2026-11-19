import type { certificates as en } from '../en/certificates';

export const certificates: typeof en = {
  list: {
    title: "Zertifikate ({count})",
    empty: "Keine Zertifikate ausgestellt. Das Formular rechts verwenden oder {code} aufrufen.",
    daysLeft: "noch {count} T",
    autoRenew: "auto-renew",
    logs: "Logs",
    close: "schließen",
    renew: "erneuern",
    delete: "löschen",
  },
  removeDialog: {
    title: "Zertifikat löschen",
    confirm: "Löschen",
    question: "Das Zertifikat für <b>{names}</b> löschen?",
    bodyIssued:
      "Es wird bei Let’s Encrypt widerrufen, der private Schlüssel wird gelöscht und die dafür angelegten DNS-Einträge werden entfernt. Dienste, die es noch verwenden, werden nicht mehr als vertrauenswürdig erkannt. Nicht rückgängig zu machen.",
    bodyOther:
      "Der private Schlüssel und der Verlauf werden gelöscht, und die dafür angelegten DNS-Einträge werden entfernt. Dienste, die es noch verwenden, werden nicht mehr als vertrauenswürdig erkannt. Nicht rückgängig zu machen.",
  },
  form: {
    title: "Zertifikat ausstellen",
    needDomain: "Zuerst eine Domain anlegen.",
    managedDomain: "Verwaltete Domain",
    wildcard: "Wildcard {pattern}",
    host: "Host",
    hostHint: "linker Teil der Subdomain",
    subject: "Subjekt:",
    keyType: "Schlüsseltyp",
    keyEc256: "ECDSA P-256 (empfohlen)",
    publishA: "A-Eintrag ebenfalls veröffentlichen",
    localIp: "Lokale IP",
    localIpHint: "in der öffentlichen Route53-Zone veröffentlicht",
    autoRenew: "Automatische Erneuerung (T-30)",
    submit: "Ausstellen",
    asyncNote:
      "Die Ausstellung erfolgt asynchron: DNS-01 dauert 1 bis 3 Minuten, bis sich der TXT-Eintrag auf allen autoritativen NS verbreitet hat.",
  },
  log: { waiting: "warte auf Ereignisse…" },
};
