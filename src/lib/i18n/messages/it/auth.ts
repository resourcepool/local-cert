import type { auth as en } from '../en/auth';

export const auth: typeof en = {
  tagline: "Certificati Let's Encrypt per le macchine della rete locale.",
  login: {
    title: "Accesso",
    email: "Email",
    password: "Password",
    checking: "Verifica in corso…",
    submit: "Accedi",
  },
  setup: {
    intro: "Prima configurazione: creazione dell'account amministratore.",
    createdTitle: "Account creato",
    createdBody: "Account amministratore {email} creato. L'accesso è già stato effettuato.",
    keyShownOnce: "Chiave API — mostrata una sola volta",
    keyNote: "Viene memorizzato solo il relativo hash. Annotarla ora: non sarà più recuperabile. In caso di smarrimento: <code>npx tsx scripts/reset-admin.ts {email} <password></code>.",
    openConsole: "Apri la console",
    accountTitle: "Account amministratore",
    email: "Email",
    password: "Password",
    confirmation: "Conferma",
    moreChars: "Mancano ancora {count} carattere/i.",
    moreClasses: "Mancano ancora {count} categoria/e di caratteri.",
    mismatch: "Le password non coincidono.",
    ownKey: "Usare una chiave API propria",
    apiKey: "Chiave API",
    apiKeyHint: "Almeno 24 caratteri — memorizzata come hash, mai più mostrata",
    generated: "Verrà generata una chiave, mostrata una sola volta al passaggio successivo.",
    creating: "Creazione in corso…",
    create: "Crea account",
    once: "Questa pagina viene mostrata una sola volta. Per automatizzare, impostare <code>ADMIN_EMAIL</code>, <code>ADMIN_PASSWORD</code> e, facoltativamente, <code>ADMIN_API_KEY</code> prima del primo avvio.",
  },
  policy: {
    none: "Nessuna policy per le password nell’ambiente di sviluppo.",
    rules: "Almeno {minLength} caratteri, combinando almeno {requiredClasses} categorie tra minuscola, maiuscola, cifra e simbolo. Le password comuni e quelle che contengono l’indirizzo e-mail vengono rifiutate.",
  },
};
