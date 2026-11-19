import type { auth as en } from '../en/auth';

export const auth: typeof en = {
  tagline: "Certificats Let’s Encrypt pour les machines de votre réseau local.",
  login: {
    title: "Connexion",
    email: "Email",
    password: "Mot de passe",
    checking: "Vérification…",
    submit: "Se connecter",
  },
  setup: {
    intro: "Première configuration : création du compte administrateur.",
    createdTitle: "Compte créé",
    createdBody: "Compte administrateur {email} créé. Vous êtes déjà connecté.",
    keyShownOnce: "Clé d’API — affichée une seule fois",
    keyNote: "Seul son hash est en base. Notez-la maintenant : elle n’est plus récupérable. Perdue ⇒ <code>npx tsx scripts/reset-admin.ts {email} <mot-de-passe></code>.",
    openConsole: "Ouvrir la console",
    accountTitle: "Compte administrateur",
    email: "Email",
    password: "Mot de passe",
    confirmation: "Confirmation",
    moreChars: "Encore {count} caractère(s).",
    moreClasses: "Encore {count} catégorie(s) de caractères.",
    mismatch: "Les mots de passe diffèrent.",
    ownKey: "Fournir ma propre clé d’API",
    apiKey: "Clé d’API",
    apiKeyHint: "24 caractères minimum — stockée hachée, jamais réaffichée",
    generated: "Une clé sera générée et affichée une seule fois à l’étape suivante.",
    creating: "Création…",
    create: "Créer le compte",
    once: "Cette page ne s’affiche qu’une fois. Pour automatiser, définissez <code>ADMIN_EMAIL</code>, <code>ADMIN_PASSWORD</code> et éventuellement <code>ADMIN_API_KEY</code> avant le premier démarrage.",
  },
  policy: {
    none: "Aucune politique de mot de passe en environnement de développement.",
    rules: "{minLength} caractères minimum, combinant au moins {requiredClasses} catégories parmi minuscule, majuscule, chiffre et symbole. Les mots de passe courants et ceux contenant l’adresse e-mail sont refusés.",
  },
};
