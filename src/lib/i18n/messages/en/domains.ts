export const domains = {
  panelTitle: "Managed domains",
  addButton: "+ add a domain",
  empty: "No domains yet. Add the zone that hosts your LAN subdomains.",
  table: {
    domain: "Domain",
    state: "State",
    provider: "Provider",
    zone: "Zone",
    ttl: "TTL",
    certs: "Certs",
  },
  status: {
    active: "active",
    pending: "pending · check {attempt}/{max}",
    error: "error",
  },
  envProvider: "environment",
  envProviderTitle: "Declared before providers existed: uses the local-cert process credentials",
  assume: "assume {arn}",
  checkNow: "check now",
  recheck: "retry the check",
  checkFailed: "{name}: {message}",
  pendingNote:
    "A <i>pending</i> domain was added before its DNS rights were in place: local-cert retests them every minute, {max} times, and activates it as soon as the test passes. After {max} failures it turns <i>error</i>: fix the rights at the DNS host, then retry the check. Only an active domain can receive certificates and records.",
  remove: {
    title: "Remove {name}",
    confirmWithCertsOne: "Remove the domain and {count} certificate",
    confirmWithCertsOther: "Remove the domain and {count} certificates",
    confirm: "Remove domain",
    withCerts:
      "{name} still has {certs}. They will be revoked at Let's Encrypt, their DNS records removed, then everything will be deleted from local-cert. This cannot be undone.",
    certsOne: "{count} certificate",
    certsOther: "{count} certificates",
    bestEffort:
      "DNS cleanup is best effort: if access to the DNS host is lost, the removal still goes through and the leftover records are listed.",
    plain:
      "Remove {name} from local-cert? No certificate depends on it. The DNS zone itself is not touched.",
  },
  wizard: {
    title: "Add a domain",
    closeGuard: "Close? The domain has not been added yet: your selection will be lost.",
    steps: {
      provider: "Provider",
      zone: "Zone",
      rights: "Rights and test",
    },
    provider: {
      none: "No DNS provider. Create one in <a>Providers</a>: it holds the AWS credentials and lists your zones.",
      legend: "The account that hosts the DNS zone",
      readingZones: "Reading zones…",
      usableOne: "{count} usable zone on this account",
      usableOther: "{count} usable zones on this account",
      hiddenOne: "{count} hidden (name servers elsewhere)",
      hiddenOther: "{count} hidden (name servers elsewhere)",
    },
    zone: {
      noZones:
        "This account has no DNS zone at {host}. Create the zone (or delegate a subdomain to it), then come back.",
      noUsable:
        "None of this account's zones is served by {host}: their name servers point elsewhere.",
      private: "private zone — invisible to Let's Encrypt, DNS-01 impossible",
      public: "public",
      publicCountOne: "public · {count} record",
      publicCountOther: "public · {count} records",
      alreadyManaged: "already managed: {domains}",
      hiddenSummaryOne: "{count} zone hidden: its name servers are not at {host}",
      hiddenSummaryOther: "{count} zones hidden: their name servers are not at {host}",
      noNameservers: "no public name server",
      hiddenExplain:
        "A record written at {host} would never be seen by Let's Encrypt there. Point the domain to the {host} name servers, or declare it on the provider that actually hosts it.",
      baseName: "Base name",
      baseNameHint:
        "the zone itself, or a subdomain of {zone} — all certificates must sit below it",
      ttl: "Default TTL (s)",
      ttlHint: "{host} enforces a minimum of {min} s: a lower value will be raised to it",
    },
    rights: {
      ok: "The rights are in place for {zone}. You can add the domain.",
      missing: "{provider} does not have rights on {zone} yet. In the AWS console:",
      stepIam: "<b>IAM</b> → {kind} → {target}",
      kindRole: "Roles",
      kindUser: "Users",
      identityFallback: "the provider's identity",
      openConsole: "open in the AWS console",
      roleNote:
        "It is the <b>role</b> that must be edited: a policy pasted on the IAM user has no effect here.",
      stepPermissions:
        "<b>Permissions</b> tab: click the <b>existing</b> policy, {policyName} (the one created with the provider), then <b>Edit</b> → <b>JSON</b> tab. Do not add a new one.",
      stepReplace:
        "Replace the whole content with the document below, then <b>Next</b> → <b>Save changes</b>.",
      stepRetest: "Come back here and run the test again.",
      nonAws:
        "{provider} cannot manage {zone} yet. At {host}, rights are not set zone by zone: check that the provider's credentials do cover this domain (see <a>the {host} guide</a>), fix them in Providers, then retest.",
      policyTitleOne: "Full policy — {count} zone",
      policyTitleOther: "Full policy — {count} zones",
      policyNote:
        "The document covers the zones this provider already manages plus {zone}: it replaces the old one without removing anything. Write access is limited to TXT, A, AAAA records. If no policy exists yet on this identity, create it (<b>Add permissions</b> → <b>Create inline policy</b>) under the name {policyName}.",
      testAws: "Route53 test — the zone is never modified.",
      testOther: "{host} test — a temporary TXT record is created, then deleted.",
      testSlow: "After a rights change, it may take a few minutes to pass.",
      notCovered: "The zone serves “{zoneName}”, which does not cover “{name}”.",
      slowTitle: "It may take a few minutes to take effect.",
      slowAws: "AWS does not always apply a policy right after it is saved.",
      slowOther: "{host} does not always apply a rights change right away.",
      slowBody:
        "No need to wait here: add the domain <b>as pending</b>. local-cert reruns this test every minute, {max} times, and activates the domain as soon as it passes. While pending, no certificate or record can be created on it.",
      testing: "Testing permissions…",
      retest: "Retest",
      testingShort: "Test…",
      testingAttempt: "Test… {attempt}/{max}",
      addPending: "Add as pending",
      addDomain: "Add domain",
      retrying: "Rights not visible yet. Retrying automatically ({attempt}/{max})…",
    },
  },
};
