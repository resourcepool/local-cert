import type { certificates as en } from '../en/certificates';

export const certificates: typeof en = {
  list: {
    title: "Certificats ({count})",
    empty: "Aucun certificat émis. Utilisez le formulaire à droite ou {code}.",
    daysLeft: "{count} j restants",
    autoRenew: "auto-renew",
    logs: "logs",
    close: "fermer",
    renew: "renouveler",
    delete: "supprimer",
  },
  removeDialog: {
    title: "Supprimer le certificat",
    confirm: "Supprimer",
    question: "Supprimer le certificat de <b>{names}</b> ?",
    bodyIssued:
      "Il est révoqué chez Let’s Encrypt, sa clé privée est effacée et les enregistrements DNS créés pour lui sont retirés. Les services qui l’utilisent encore cesseront d’être reconnus. Irréversible.",
    bodyOther:
      "Sa clé privée et son historique sont effacés, et les enregistrements DNS créés pour lui sont retirés. Les services qui l’utilisent encore cesseront d’être reconnus. Irréversible.",
  },
  form: {
    title: "Émettre un certificat",
    needDomain: "Déclarez d’abord un domaine.",
    managedDomain: "Domaine géré",
    wildcard: "Wildcard {pattern}",
    host: "Hôte",
    hostHint: "partie gauche du sous-domaine",
    subject: "sujet :",
    keyType: "Type de clé",
    keyEc256: "ECDSA P-256 (recommandé)",
    publishA: "Publier aussi l’enregistrement A",
    localIp: "IP locale",
    localIpHint: "publiée dans la zone publique Route53",
    autoRenew: "Renouvellement automatique (J-30)",
    submit: "Émettre",
    asyncNote:
      "L’émission est asynchrone : DNS-01 prend 1 à 3 minutes le temps que le TXT se propage sur tous les NS autoritatifs.",
  },
  log: { waiting: "en attente d’événements…" },
};
