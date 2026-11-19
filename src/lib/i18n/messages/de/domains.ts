import type { domains as en } from '../en/domains';

export const domains: typeof en = {
  panelTitle: "Verwaltete Domains",
  addButton: "+ Domain hinzufügen",
  empty: "Keine Domains. Fügen Sie die Zone hinzu, die Ihre LAN-Subdomains hostet.",
  table: {
    domain: "Domain",
    state: "Status",
    provider: "Provider",
    zone: "Zone",
    ttl: "TTL",
    certs: "Zertif.",
  },
  status: {
    active: "aktiv",
    pending: "ausstehend · Prüfung {attempt}/{max}",
    error: "Fehler",
  },
  envProvider: "Umgebung",
  envProviderTitle: "Vor den Providern angelegt: Zugangsdaten des local-cert-Prozesses",
  assume: "assume {arn}",
  checkNow: "jetzt prüfen",
  recheck: "Prüfung wiederholen",
  checkFailed: "{name}: {message}",
  pendingNote:
    "Eine <i>ausstehende</i> Domain wurde hinzugefügt, bevor ihre DNS-Rechte eingerichtet waren: local-cert testet sie jede Minute erneut, {max}-mal, und aktiviert die Domain, sobald der Test besteht. Nach {max} Fehlschlägen wechselt sie auf <i>Fehler</i>: Korrigieren Sie die Rechte beim DNS-Anbieter und wiederholen Sie dann die Prüfung. Nur eine aktive Domain kann Zertifikate und Einträge erhalten.",
  remove: {
    title: "{name} entfernen",
    confirmWithCertsOne: "Domain und {count} Zertifikat entfernen",
    confirmWithCertsOther: "Domain und {count} Zertifikate entfernen",
    confirm: "Domain entfernen",
    withCerts:
      "{name} hat noch {certs}. Sie werden bei Let's Encrypt widerrufen, ihre DNS-Einträge entfernt und anschließend wird alles aus local-cert gelöscht. Dies lässt sich nicht rückgängig machen.",
    certsOne: "{count} Zertifikat",
    certsOther: "{count} Zertifikate",
    bestEffort:
      "Die DNS-Bereinigung erfolgt nach bestem Bemühen: Geht der Zugriff auf den DNS-Anbieter verloren, wird die Löschung trotzdem abgeschlossen und die verbleibenden Einträge werden aufgelistet.",
    plain:
      "{name} aus local-cert entfernen? Kein Zertifikat hängt davon ab. Die DNS-Zone selbst bleibt unberührt.",
  },
  wizard: {
    title: "Domain hinzufügen",
    closeGuard: "Schließen? Die Domain ist noch nicht hinzugefügt: Die Auswahl geht verloren.",
    steps: {
      provider: "Provider",
      zone: "Zone",
      rights: "Rechte und Test",
    },
    provider: {
      none: "Kein DNS-Provider vorhanden. Legen Sie unter <a>Provider</a> einen an: Er hält die AWS-Zugangsdaten und listet Ihre Zonen auf.",
      legend: "Das Konto, das die DNS-Zone hostet",
      readingZones: "Zonen werden gelesen…",
      usableOne: "{count} nutzbare Zone in diesem Konto",
      usableOther: "{count} nutzbare Zonen in diesem Konto",
      hiddenOne: "{count} ausgeblendet (Nameserver anderswo)",
      hiddenOther: "{count} ausgeblendet (Nameserver anderswo)",
    },
    zone: {
      noZones:
        "Dieses Konto hat keine DNS-Zone bei {host}. Legen Sie die Zone an (oder delegieren Sie eine Subdomain dorthin) und kehren Sie dann zurück.",
      noUsable:
        "Keine Zone dieses Kontos wird von {host} bedient: Ihre Nameserver verweisen woandershin.",
      private: "private Zone — für Let's Encrypt unsichtbar, DNS-01 nicht möglich",
      public: "öffentlich",
      publicCountOne: "öffentlich · {count} Eintrag",
      publicCountOther: "öffentlich · {count} Einträge",
      alreadyManaged: "bereits verwaltet: {domains}",
      hiddenSummaryOne: "{count} Zone ausgeblendet: Ihre Nameserver liegen nicht bei {host}",
      hiddenSummaryOther: "{count} Zonen ausgeblendet: Ihre Nameserver liegen nicht bei {host}",
      noNameservers: "kein öffentlicher Nameserver",
      hiddenExplain:
        "Ein bei {host} geschriebener Eintrag würde dort von Let's Encrypt nie gesehen. Lassen Sie die Domain auf die Nameserver von {host} zeigen oder deklarieren Sie sie beim Provider, der sie tatsächlich hostet.",
      baseName: "Basisname",
      baseNameHint:
        "die Zone selbst oder eine Subdomain von {zone} — alle Zertifikate müssen darunter liegen",
      ttl: "Standard-TTL (s)",
      ttlHint: "{host} erzwingt ein Minimum von {min} s: Ein niedrigerer Wert wird darauf angehoben",
    },
    rights: {
      ok: "Die Rechte sind für {zone} vorhanden. Sie können die Domain hinzufügen.",
      missing: "{provider} hat noch keine Rechte für {zone}. In der AWS-Konsole:",
      stepIam: "<b>IAM</b> → {kind} → {target}",
      kindRole: "Roles",
      kindUser: "Users",
      identityFallback: "die Identität des Providers",
      openConsole: "in der AWS-Konsole öffnen",
      roleNote:
        "Bearbeitet werden muss die <b>Rolle</b>: Eine auf den IAM-Benutzer eingefügte Richtlinie hat hier keine Wirkung.",
      stepPermissions:
        "Tab <b>Permissions</b>: Klicken Sie auf die <b>bereits vorhandene</b> Richtlinie {policyName} (die mit dem Provider erstellte), dann auf <b>Edit</b> → Tab <b>JSON</b>. Fügen Sie keine neue hinzu.",
      stepReplace:
        "Ersetzen Sie den gesamten Inhalt durch das untenstehende Dokument, dann <b>Next</b> → <b>Save changes</b>.",
      stepRetest: "Kehren Sie hierher zurück und starten Sie den Test erneut.",
      nonAws:
        "{provider} kann {zone} noch nicht verwalten. Bei {host} werden Rechte nicht zonenweise vergeben: Prüfen Sie, ob die Zugangsdaten des Providers diese Domain abdecken (siehe <a>die {host}-Anleitung</a>), korrigieren Sie sie unter Provider und testen Sie erneut.",
      policyTitleOne: "Vollständige Richtlinie — {count} Zone",
      policyTitleOther: "Vollständige Richtlinie — {count} Zonen",
      policyNote:
        "Das Dokument deckt die bereits von diesem Provider verwalteten Zonen plus {zone} ab: Es ersetzt das alte, ohne etwas zu entfernen. Schreibzugriff ist auf die Typen TXT, A, AAAA beschränkt. Existiert für diese Identität noch keine Richtlinie, legen Sie sie an (<b>Add permissions</b> → <b>Create inline policy</b>) mit dem Namen {policyName}.",
      testAws: "Route53-Test — die Zone wird nie verändert.",
      testOther: "{host}-Test — ein temporärer TXT-Eintrag wird angelegt und wieder gelöscht.",
      testSlow: "Nach einer Rechteänderung kann es einige Minuten dauern, bis er besteht.",
      notCovered: "Die Zone bedient „{zoneName}“, was „{name}“ nicht abdeckt.",
      slowTitle: "Die Übernahme kann einige Minuten dauern.",
      slowAws: "AWS wendet eine Richtlinie nicht immer sofort nach dem Speichern an.",
      slowOther: "{host} wendet eine Rechteänderung nicht immer sofort an.",
      slowBody:
        "Sie müssen hier nicht warten: Fügen Sie die Domain <b>als ausstehend</b> hinzu. local-cert wiederholt diesen Test jede Minute, {max}-mal, und aktiviert die Domain, sobald er besteht. Solange sie aussteht, können dafür keine Zertifikate oder Einträge erstellt werden.",
      testing: "Berechtigungen werden getestet…",
      retest: "Erneut testen",
      testingShort: "Test…",
      testingAttempt: "Test… {attempt}/{max}",
      addPending: "Als ausstehend hinzufügen",
      addDomain: "Domain hinzufügen",
      retrying: "Rechte noch nicht sichtbar. Automatischer neuer Versuch ({attempt}/{max})…",
    },
  },
};
