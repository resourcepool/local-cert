import type { domains as en } from '../en/domains';

export const domains: typeof en = {
  panelTitle: "Domini gestiti",
  addButton: "+ aggiungi un dominio",
  empty: "Nessun dominio. Aggiungere la zona che ospita i sottodomini della LAN.",
  table: {
    domain: "Dominio",
    state: "Stato",
    provider: "Provider",
    zone: "Zona",
    ttl: "TTL",
    certs: "Cert.",
  },
  status: {
    active: "attivo",
    pending: "in attesa · verifica {attempt}/{max}",
    error: "errore",
  },
  envProvider: "ambiente",
  envProviderTitle: "Dichiarato prima dei provider: credenziali del processo local-cert",
  assume: "assume {arn}",
  checkNow: "verifica ora",
  recheck: "ripeti la verifica",
  checkFailed: "{name}: {message}",
  pendingNote:
    "Un dominio <i>in attesa</i> è stato aggiunto prima che i suoi permessi DNS fossero attivi: local-cert li ritesta ogni minuto, {max} volte, e lo attiva non appena il test riesce. Dopo {max} errori passa a <i>errore</i>: correggere i permessi presso l’host DNS, quindi ripetere la verifica. Solo un dominio attivo può ricevere certificati e record.",
  remove: {
    title: "Rimuovi {name}",
    confirmWithCertsOne: "Rimuovi il dominio e {count} certificato",
    confirmWithCertsOther: "Rimuovi il dominio e {count} certificati",
    confirm: "Rimuovi il dominio",
    withCerts:
      "{name} ha ancora {certs}. Verranno revocati presso Let's Encrypt, i relativi record DNS rimossi, quindi tutto sarà eliminato da local-cert. Operazione irreversibile.",
    certsOne: "{count} certificato",
    certsOther: "{count} certificati",
    bestEffort:
      "La pulizia DNS è eseguita al meglio: se l’accesso all’host DNS è perso, l’eliminazione va comunque a buon fine e i record rimanenti vengono elencati.",
    plain:
      "Rimuovere {name} da local-cert? Nessun certificato ne dipende. La zona DNS in sé non viene toccata.",
  },
  wizard: {
    title: "Aggiungi un dominio",
    closeGuard: "Chiudere? Il dominio non è ancora stato aggiunto: la selezione andrà persa.",
    steps: {
      provider: "Provider",
      zone: "Zona",
      rights: "Permessi e test",
    },
    provider: {
      none: "Nessun provider DNS. Crearne uno in <a>Provider</a>: è lui a custodire le credenziali AWS e a elencare le zone.",
      legend: "L’account che ospita la zona DNS",
      readingZones: "Lettura delle zone…",
      usableOne: "{count} zona utilizzabile su questo account",
      usableOther: "{count} zone utilizzabili su questo account",
      hiddenOne: "{count} nascosta (name server altrove)",
      hiddenOther: "{count} nascoste (name server altrove)",
    },
    zone: {
      noZones:
        "Questo account non ha nessuna zona DNS presso {host}. Creare la zona (o delegarle un sottodominio), quindi tornare.",
      noUsable:
        "Nessuna zona di questo account è servita da {host}: i loro name server puntano altrove.",
      private: "zona privata — invisibile a Let's Encrypt, DNS-01 impossibile",
      public: "pubblica",
      publicCountOne: "pubblica · {count} record",
      publicCountOther: "pubblica · {count} record",
      alreadyManaged: "già gestito: {domains}",
      hiddenSummaryOne: "{count} zona nascosta: i suoi name server non sono presso {host}",
      hiddenSummaryOther: "{count} zone nascoste: i loro name server non sono presso {host}",
      noNameservers: "nessun name server pubblico",
      hiddenExplain:
        "Un record scritto presso {host} non verrebbe mai visto da Let's Encrypt. Puntare il dominio ai name server di {host}, oppure dichiararlo sul provider che lo ospita davvero.",
      baseName: "Nome di base",
      baseNameHint:
        "la zona stessa, o un sottodominio di {zone} — tutti i certificati dovranno trovarsi al di sotto",
      ttl: "TTL predefinito (s)",
      ttlHint: "{host} impone un minimo di {min} s: un valore inferiore verrà portato a tale minimo",
    },
    rights: {
      ok: "I permessi sono attivi per {zone}. È possibile aggiungere il dominio.",
      missing: "{provider} non ha ancora i permessi su {zone}. Nella console AWS:",
      stepIam: "<b>IAM</b> → {kind} → {target}",
      kindRole: "Roles",
      kindUser: "Users",
      identityFallback: "l’identità del provider",
      openConsole: "apri nella console AWS",
      roleNote:
        "È il <b>ruolo</b> che va modificato: una policy incollata sull’utente IAM qui non ha alcun effetto.",
      stepPermissions:
        "Scheda <b>Permissions</b>: fare clic sulla policy <b>già esistente</b>, {policyName} (quella creata con il provider), poi <b>Edit</b> → scheda <b>JSON</b>. Non aggiungerne una nuova.",
      stepReplace:
        "Sostituire l’intero contenuto con il documento qui sotto, poi <b>Next</b> → <b>Save changes</b>.",
      stepRetest: "Tornare qui e rilanciare il test.",
      nonAws:
        "{provider} non può ancora gestire {zone}. Presso {host} i permessi non si impostano zona per zona: verificare che le credenziali del provider coprano questo dominio (vedere <a>la guida {host}</a>), correggerle in Provider, quindi ripetere il test.",
      policyTitleOne: "Policy completa — {count} zona",
      policyTitleOther: "Policy completa — {count} zone",
      policyNote:
        "Il documento copre le zone già gestite da questo provider più {zone}: sostituisce il precedente senza rimuovere nulla. La scrittura è limitata ai tipi TXT, A, AAAA. Se su questa identità non esiste ancora una policy, crearla (<b>Add permissions</b> → <b>Create inline policy</b>) con il nome {policyName}.",
      testAws: "Test Route53 — la zona non viene mai modificata.",
      testOther: "Test {host} — viene creato un record TXT temporaneo, poi eliminato.",
      testSlow: "Dopo una modifica dei permessi, può servire qualche minuto prima che il test riesca.",
      notCovered: "La zona serve «{zoneName}», che non copre «{name}».",
      slowTitle: "L’applicazione può richiedere qualche minuto.",
      slowAws: "AWS non sempre applica subito una policy dopo il salvataggio.",
      slowOther: "{host} non sempre applica subito una modifica dei permessi.",
      slowBody:
        "Inutile attendere qui: aggiungere il dominio <b>in attesa</b>. local-cert ripete questo test ogni minuto, {max} volte, e attiva il dominio non appena riesce. Finché è in attesa, non è possibile creare certificati né record.",
      testing: "Test dei permessi…",
      retest: "Ripeti il test",
      testingShort: "Test…",
      testingAttempt: "Test… {attempt}/{max}",
      addPending: "Aggiungi in attesa",
      addDomain: "Aggiungi il dominio",
      retrying: "Permessi non ancora visibili. Nuovo tentativo automatico ({attempt}/{max})…",
    },
  },
};
