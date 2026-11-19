import type { overview as en } from '../en/overview';

export const overview: typeof en = {
  stats: {
    active: "Certificados activos",
    inflight: "En curso",
    expiring: "Caducan en < 30 d",
    failed: "Fallidos",
    domains: "Dominios gestionados",
    keys: "Claves activas",
  },
  latest: {
    title: "Últimos certificados",
    viewAll: "ver todo →",
    empty: "Aún no hay certificados. Declare primero un dominio y, a continuación, llame a {code}.",
    head: { domains: "Dominios", status: "Estado", expires: "Caduca", updated: "Actualizado" },
    daysShort: "{count} d",
  },
  acme: {
    title: "Cuenta ACME",
    environment: "Entorno",
    contact: "Contacto",
    directory: "Directory",
    account: "Cuenta",
    notCreated: "no creada",
    stagingWarning:
      "Entorno staging: los navegadores no reconocen los certificados emitidos. Cambie a {code} una vez validado el flujo.",
  },
  audit: {
    title: "Registro de auditoría",
    empty: "Nada por el momento.",
    head: { when: "Cuándo", action: "Acción", target: "Destino", ip: "IP" },
  },
};
