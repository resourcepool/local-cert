import type { overview as en } from '../en/overview';

export const overview: typeof en = {
  stats: {
    active: "Aktive Zertifikate",
    inflight: "In Bearbeitung",
    expiring: "Laufen in < 30 Tagen ab",
    failed: "Fehlgeschlagen",
    domains: "Verwaltete Domains",
    keys: "Aktive Schlüssel",
  },
  latest: {
    title: "Neueste Zertifikate",
    viewAll: "alle anzeigen →",
    empty: "Noch keine Zertifikate. Zuerst eine Domain anlegen, dann {code} aufrufen.",
    head: { domains: "Domains", status: "Status", expires: "Läuft ab", updated: "Aktualisiert" },
    daysShort: "{count} T",
  },
  acme: {
    title: "ACME-Konto",
    environment: "Umgebung",
    contact: "Kontakt",
    directory: "Directory",
    account: "Konto",
    notCreated: "nicht erstellt",
    stagingWarning:
      "Staging-Umgebung: Ausgestellte Zertifikate werden von Browsern nicht anerkannt. Nach erfolgreicher Validierung auf {code} umstellen.",
  },
  audit: {
    title: "Audit-Protokoll",
    empty: "Noch nichts vorhanden.",
    head: { when: "Zeitpunkt", action: "Aktion", target: "Ziel", ip: "IP" },
  },
};
