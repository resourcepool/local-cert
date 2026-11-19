export const overview = {
  stats: {
    active: "Active certificates",
    inflight: "In progress",
    expiring: "Expiring in < 30 days",
    failed: "Failed",
    domains: "Managed domains",
    keys: "Active keys",
  },
  latest: {
    title: "Latest certificates",
    viewAll: "view all →",
    empty: "No certificates yet. Declare a domain first, then call {code}.",
    head: { domains: "Domains", status: "Status", expires: "Expires", updated: "Updated" },
    daysShort: "{count} d",
  },
  acme: {
    title: "ACME account",
    environment: "Environment",
    contact: "Contact",
    directory: "Directory",
    account: "Account",
    notCreated: "not created",
    stagingWarning:
      "Staging environment: issued certificates are not trusted by browsers. Switch to {code} once the flow is validated.",
  },
  audit: {
    title: "Audit log",
    empty: "Nothing yet.",
    head: { when: "When", action: "Action", target: "Target", ip: "IP" },
  },
};
