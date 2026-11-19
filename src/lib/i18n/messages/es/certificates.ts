import type { certificates as en } from '../en/certificates';

export const certificates: typeof en = {
  list: {
    title: "Certificados ({count})",
    empty: "No se ha emitido ningún certificado. Utilice el formulario de la derecha o {code}.",
    daysLeft: "{count} d restantes",
    autoRenew: "auto-renew",
    logs: "logs",
    close: "cerrar",
    renew: "renovar",
    delete: "eliminar",
  },
  removeDialog: {
    title: "Eliminar certificado",
    confirm: "Eliminar",
    question: "¿Eliminar el certificado de <b>{names}</b>?",
    bodyIssued:
      "Se revoca en Let’s Encrypt, se borra su clave privada y se eliminan los registros DNS creados para él. Los servicios que aún lo utilicen dejarán de ser reconocidos. Esta acción es irreversible.",
    bodyOther:
      "Se borran su clave privada y su historial, y se eliminan los registros DNS creados para él. Los servicios que aún lo utilicen dejarán de ser reconocidos. Esta acción es irreversible.",
  },
  form: {
    title: "Emitir un certificado",
    needDomain: "Declare primero un dominio.",
    managedDomain: "Dominio gestionado",
    wildcard: "Wildcard {pattern}",
    host: "Host",
    hostHint: "parte izquierda del subdominio",
    subject: "sujeto:",
    keyType: "Tipo de clave",
    keyEc256: "ECDSA P-256 (recomendado)",
    publishA: "Publicar también el registro A",
    localIp: "IP local",
    localIpHint: "publicada en la zona pública de Route53",
    autoRenew: "Renovación automática (D-30)",
    submit: "Emitir",
    asyncNote:
      "La emisión es asíncrona: DNS-01 tarda de 1 a 3 minutos mientras el TXT se propaga a todos los NS autoritativos.",
  },
  log: { waiting: "esperando eventos…" },
};
