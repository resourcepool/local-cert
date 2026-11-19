import type { auth as en } from '../en/auth';

export const auth: typeof en = {
  tagline: "Let's-Encrypt-Zertifikate für die Rechner in Ihrem lokalen Netzwerk.",
  login: {
    title: "Anmeldung",
    email: "E-Mail",
    password: "Passwort",
    checking: "Prüfung…",
    submit: "Anmelden",
  },
  setup: {
    intro: "Ersteinrichtung: Administratorkonto anlegen.",
    createdTitle: "Konto angelegt",
    createdBody: "Administratorkonto {email} angelegt. Sie sind bereits angemeldet.",
    keyShownOnce: "API-Schlüssel — wird nur einmal angezeigt",
    keyNote: "Nur der Hash wird gespeichert. Notieren Sie den Schlüssel jetzt: Er lässt sich nicht wiederherstellen. Bei Verlust: <code>npx tsx scripts/reset-admin.ts {email} <passwort></code>.",
    openConsole: "Konsole öffnen",
    accountTitle: "Administratorkonto",
    email: "E-Mail",
    password: "Passwort",
    confirmation: "Bestätigung",
    moreChars: "Noch {count} Zeichen.",
    moreClasses: "Noch {count} Zeichenkategorie(n).",
    mismatch: "Die Passwörter stimmen nicht überein.",
    ownKey: "Eigenen API-Schlüssel verwenden",
    apiKey: "API-Schlüssel",
    apiKeyHint: "Mindestens 24 Zeichen — nur als Hash gespeichert, wird nie wieder angezeigt",
    generated: "Ein Schlüssel wird erzeugt und im nächsten Schritt nur einmal angezeigt.",
    creating: "Wird angelegt…",
    create: "Konto anlegen",
    once: "Diese Seite wird nur einmal angezeigt. Zur Automatisierung vor dem ersten Start <code>ADMIN_EMAIL</code>, <code>ADMIN_PASSWORD</code> und optional <code>ADMIN_API_KEY</code> festlegen.",
  },
  policy: {
    none: "Keine Passwortrichtlinie in der Entwicklungsumgebung.",
    rules: "Mindestens {minLength} Zeichen, mit mindestens {requiredClasses} der Kategorien Kleinbuchstabe, Großbuchstabe, Ziffer und Symbol. Gängige Passwörter und solche, die die E-Mail-Adresse enthalten, werden abgelehnt.",
  },
};
