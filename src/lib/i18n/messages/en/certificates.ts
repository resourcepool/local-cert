export const certificates = {
  list: {
    title: "Certificates ({count})",
    empty: "No certificates issued. Use the form on the right or {code}.",
    daysLeft: "{count} d remaining",
    autoRenew: "auto-renew",
    logs: "logs",
    close: "close",
    renew: "renew",
    delete: "delete",
  },
  removeDialog: {
    title: "Delete certificate",
    confirm: "Delete",
    question: "Delete the certificate for <b>{names}</b>?",
    bodyIssued:
      "It is revoked at Let’s Encrypt, its private key is erased and the DNS records created for it are removed. Services still using it will no longer be trusted. This cannot be undone.",
    bodyOther:
      "Its private key and history are erased, and the DNS records created for it are removed. Services still using it will no longer be trusted. This cannot be undone.",
  },
  form: {
    title: "Issue a certificate",
    needDomain: "Declare a domain first.",
    managedDomain: "Managed domain",
    wildcard: "Wildcard {pattern}",
    host: "Host",
    hostHint: "left part of the subdomain",
    subject: "subject:",
    keyType: "Key type",
    keyEc256: "ECDSA P-256 (recommended)",
    publishA: "Also publish the A record",
    localIp: "Local IP",
    localIpHint: "published in the public Route53 zone",
    autoRenew: "Automatic renewal (D-30)",
    submit: "Issue",
    asyncNote:
      "Issuance is asynchronous: DNS-01 takes 1 to 3 minutes while the TXT record propagates to all authoritative NS.",
  },
  log: { waiting: "waiting for events…" },
};
