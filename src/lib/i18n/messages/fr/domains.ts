import type { domains as en } from '../en/domains';

export const domains: typeof en = {
  panelTitle: "Domaines gérés",
  addButton: "+ ajouter un domaine",
  empty: "Aucun domaine. Ajoutez la zone qui héberge vos sous-domaines LAN.",
  table: {
    domain: "Domaine",
    state: "État",
    provider: "Provider",
    zone: "Zone",
    ttl: "TTL",
    certs: "Certs",
  },
  status: {
    active: "actif",
    pending: "en attente · vérification {attempt}/{max}",
    error: "erreur",
  },
  envProvider: "environnement",
  envProviderTitle: "Déclaré avant les providers : credentials du processus local-cert",
  assume: "assume {arn}",
  checkNow: "vérifier maintenant",
  recheck: "relancer la vérification",
  checkFailed: "{name} : {message}",
  pendingNote:
    "Un domaine <i>en attente</i> a été ajouté avant que ses droits DNS soient en place : local-cert les reteste chaque minute, {max} fois, et l’active dès que le test passe. Après {max} échecs il passe <i>en erreur</i> : corrigez les droits chez l’hébergeur, puis relancez la vérification. Seul un domaine actif peut recevoir des certificats et des enregistrements.",
  remove: {
    title: "Retirer {name}",
    confirmWithCertsOne: "Retirer le domaine et {count} certificat",
    confirmWithCertsOther: "Retirer le domaine et {count} certificats",
    confirm: "Retirer le domaine",
    withCerts:
      "{name} porte encore {certs}. Ils seront révoqués chez Let’s Encrypt, leurs enregistrements DNS retirés, puis tout sera supprimé de local-cert. Irréversible.",
    certsOne: "{count} certificat",
    certsOther: "{count} certificats",
    bestEffort:
      "Le nettoyage DNS est fait au mieux : si l’accès à l’hébergeur est perdu, la suppression aboutit quand même et les enregistrements restants sont listés.",
    plain:
      "Retirer {name} de local-cert ? Aucun certificat n’en dépend. La zone DNS elle-même n’est pas touchée.",
  },
  wizard: {
    title: "Ajouter un domaine",
    closeGuard: "Fermer ? Le domaine n’est pas encore ajouté : la sélection sera perdue.",
    steps: {
      provider: "Provider",
      zone: "Zone",
      rights: "Droits et test",
    },
    provider: {
      none: "Aucun provider DNS. Créez-en un dans <a>Providers</a> : c’est lui qui porte les credentials AWS et qui liste vos zones.",
      legend: "Le compte qui héberge la zone DNS",
      readingZones: "Lecture des zones…",
      usableOne: "{count} zone utilisable sur ce compte",
      usableOther: "{count} zones utilisables sur ce compte",
      hiddenOne: "{count} masquée (serveurs de noms ailleurs)",
      hiddenOther: "{count} masquées (serveurs de noms ailleurs)",
    },
    zone: {
      noZones:
        "Ce compte n’a aucune zone DNS chez {host}. Créez la zone (ou déléguez-y un sous-domaine), puis revenez.",
      noUsable:
        "Aucune zone de ce compte n’est servie par {host} : leurs serveurs de noms pointent ailleurs.",
      private: "zone privée — invisible pour Let’s Encrypt, DNS-01 impossible",
      public: "publique",
      publicCountOne: "publique · {count} enregistrement",
      publicCountOther: "publique · {count} enregistrements",
      alreadyManaged: "déjà géré : {domains}",
      hiddenSummaryOne: "{count} zone masquée : ses serveurs de noms ne sont pas chez {host}",
      hiddenSummaryOther: "{count} zones masquées : leurs serveurs de noms ne sont pas chez {host}",
      noNameservers: "aucun serveur de noms public",
      hiddenExplain:
        "Un enregistrement écrit chez {host} n’y serait jamais vu par Let’s Encrypt. Pointez le domaine vers les serveurs de {host}, ou déclarez-le sur le provider qui l’héberge réellement.",
      baseName: "Nom de base",
      baseNameHint:
        "la zone elle-même, ou un sous-domaine de {zone} — tous les certificats devront être dessous",
      ttl: "TTL par défaut (s)",
      ttlHint: "{host} impose un minimum de {min} s : une valeur plus basse y sera relevée",
    },
    rights: {
      ok: "Les droits sont en place pour {zone}. Vous pouvez ajouter le domaine.",
      missing: "{provider} n’a pas encore les droits sur {zone}. Dans la console AWS :",
      stepIam: "<b>IAM</b> → {kind} → {target}",
      kindRole: "Roles",
      kindUser: "Users",
      identityFallback: "l’identité du provider",
      openConsole: "ouvrir dans la console AWS",
      roleNote:
        "C’est bien le <b>rôle</b> qu’il faut modifier : une politique collée sur l’utilisateur IAM n’a aucun effet ici.",
      stepPermissions:
        "Onglet <b>Permissions</b> : cliquez sur la politique <b>déjà existante</b>, {policyName} (celle créée avec le provider), puis <b>Edit</b> → onglet <b>JSON</b>. N’en ajoutez pas une nouvelle.",
      stepReplace:
        "Remplacez tout le contenu par le document ci-dessous, puis <b>Next</b> → <b>Save changes</b>.",
      stepRetest: "Revenez ici et relancez le test.",
      nonAws:
        "{provider} ne peut pas encore gérer {zone}. Chez {host}, les droits ne se règlent pas zone par zone : vérifiez que les identifiants du provider couvrent bien ce domaine (voir <a>le guide {host}</a>), corrigez-les dans Providers, puis retestez.",
      policyTitleOne: "Politique complète — {count} zone",
      policyTitleOther: "Politique complète — {count} zones",
      policyNote:
        "Le document couvre les zones déjà gérées par ce provider plus {zone} : il remplace l’ancien sans rien retirer. Écriture limitée aux types TXT, A, AAAA. Si aucune politique n’existe encore sur cette identité, créez-la (<b>Add permissions</b> → <b>Create inline policy</b>) sous le nom {policyName}.",
      testAws: "Test Route53 — la zone n’est jamais modifiée.",
      testOther: "Test {host} — un enregistrement TXT temporaire est créé puis supprimé.",
      testSlow: "Après un changement de droits, il peut mettre quelques minutes à passer.",
      notCovered: "La zone sert « {zoneName} », qui ne couvre pas « {name} ».",
      slowTitle: "La prise en compte peut prendre quelques minutes.",
      slowAws: "AWS n’applique pas toujours une politique tout de suite après son enregistrement.",
      slowOther: "{host} n’applique pas toujours un changement de droits tout de suite.",
      slowBody:
        "Inutile d’attendre ici : ajoutez le domaine <b>en attente</b>. local-cert refait ce test chaque minute, {max} fois, et active le domaine dès qu’il passe. Tant qu’il est en attente, aucun certificat ni enregistrement ne peut y être créé.",
      testing: "Test des permissions…",
      retest: "Retester",
      testingShort: "Test…",
      testingAttempt: "Test… {attempt}/{max}",
      addPending: "Ajouter en attente",
      addDomain: "Ajouter le domaine",
      retrying: "Droits pas encore visibles. Nouvel essai automatique ({attempt}/{max})…",
    },
  },
};
