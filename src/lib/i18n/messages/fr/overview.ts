import type { overview as en } from '../en/overview';

export const overview: typeof en = {
  stats: {
    active: "Certificats actifs",
    inflight: "En cours",
    expiring: "Expirent < 30j",
    failed: "En échec",
    domains: "Domaines gérés",
    keys: "Clés actives",
  },
  latest: {
    title: "Derniers certificats",
    viewAll: "tout voir →",
    empty: "Aucun certificat. Déclarez d’abord un domaine, puis appelez {code}.",
    head: { domains: "Domaines", status: "Statut", expires: "Expire", updated: "Maj" },
    daysShort: "{count} j",
  },
  acme: {
    title: "Compte ACME",
    environment: "Environnement",
    contact: "Contact",
    directory: "Directory",
    account: "Compte",
    notCreated: "non créé",
    stagingWarning:
      "Environnement staging : les certificats émis ne sont pas reconnus par les navigateurs. Passez {code} une fois le flux validé.",
  },
  audit: {
    title: "Journal d’audit",
    empty: "Rien pour l’instant.",
    head: { when: "Quand", action: "Action", target: "Cible", ip: "IP" },
  },
};
