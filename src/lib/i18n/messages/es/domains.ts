import type { domains as en } from '../en/domains';

export const domains: typeof en = {
  panelTitle: "Dominios gestionados",
  addButton: "+ añadir un dominio",
  empty: "Ningún dominio. Añada la zona que aloja sus subdominios de LAN.",
  table: {
    domain: "Dominio",
    state: "Estado",
    provider: "Proveedor",
    zone: "Zona",
    ttl: "TTL",
    certs: "Certs",
  },
  status: {
    active: "activo",
    pending: "pendiente · comprobación {attempt}/{max}",
    error: "error",
  },
  envProvider: "entorno",
  envProviderTitle: "Declarado antes de los proveedores: credenciales del proceso local-cert",
  assume: "assume {arn}",
  checkNow: "comprobar ahora",
  recheck: "repetir la comprobación",
  checkFailed: "{name}: {message}",
  pendingNote:
    "Un dominio <i>pendiente</i> se añadió antes de que sus permisos DNS estuvieran listos: local-cert los vuelve a probar cada minuto, {max} veces, y lo activa en cuanto la prueba pasa. Tras {max} fallos pasa a <i>error</i>: corrija los permisos en el proveedor DNS y repita la comprobación. Solo un dominio activo puede recibir certificados y registros.",
  remove: {
    title: "Quitar {name}",
    confirmWithCertsOne: "Quitar el dominio y {count} certificado",
    confirmWithCertsOther: "Quitar el dominio y {count} certificados",
    confirm: "Quitar el dominio",
    withCerts:
      "{name} todavía tiene {certs}. Se revocarán en Let's Encrypt, se eliminarán sus registros DNS y después se borrará todo de local-cert. Irreversible.",
    certsOne: "{count} certificado",
    certsOther: "{count} certificados",
    bestEffort:
      "La limpieza de DNS se hace en la medida de lo posible: si se pierde el acceso al proveedor DNS, la eliminación se completa igualmente y se enumeran los registros restantes.",
    plain:
      "¿Quitar {name} de local-cert? Ningún certificado depende de él. La zona DNS en sí no se modifica.",
  },
  wizard: {
    title: "Añadir un dominio",
    closeGuard: "¿Cerrar? El dominio aún no se ha añadido: se perderá la selección.",
    steps: {
      provider: "Proveedor",
      zone: "Zona",
      rights: "Permisos y prueba",
    },
    provider: {
      none: "No hay ningún proveedor DNS. Cree uno en <a>Proveedores</a>: es quien guarda las credenciales de AWS y lista sus zonas.",
      legend: "La cuenta que aloja la zona DNS",
      readingZones: "Leyendo las zonas…",
      usableOne: "{count} zona utilizable en esta cuenta",
      usableOther: "{count} zonas utilizables en esta cuenta",
      hiddenOne: "{count} oculta (servidores de nombres en otro lugar)",
      hiddenOther: "{count} ocultas (servidores de nombres en otro lugar)",
    },
    zone: {
      noZones:
        "Esta cuenta no tiene ninguna zona DNS en {host}. Cree la zona (o delegue un subdominio en ella) y vuelva.",
      noUsable:
        "Ninguna zona de esta cuenta es servida por {host}: sus servidores de nombres apuntan a otro lugar.",
      private: "zona privada — invisible para Let's Encrypt, DNS-01 imposible",
      public: "pública",
      publicCountOne: "pública · {count} registro",
      publicCountOther: "pública · {count} registros",
      alreadyManaged: "ya gestionado: {domains}",
      hiddenSummaryOne: "{count} zona oculta: sus servidores de nombres no están en {host}",
      hiddenSummaryOther: "{count} zonas ocultas: sus servidores de nombres no están en {host}",
      noNameservers: "ningún servidor de nombres público",
      hiddenExplain:
        "Let's Encrypt nunca vería un registro escrito en {host}. Apunte el dominio a los servidores de {host}, o declárelo en el proveedor que realmente lo aloja.",
      baseName: "Nombre base",
      baseNameHint:
        "la propia zona, o un subdominio de {zone} — todos los certificados deberán estar por debajo",
      ttl: "TTL por defecto (s)",
      ttlHint: "{host} impone un mínimo de {min} s: un valor inferior se elevará a ese mínimo",
    },
    rights: {
      ok: "Los permisos están listos para {zone}. Puede añadir el dominio.",
      missing: "{provider} aún no tiene permisos sobre {zone}. En la consola de AWS:",
      stepIam: "<b>IAM</b> → {kind} → {target}",
      kindRole: "Roles",
      kindUser: "Users",
      identityFallback: "la identidad del proveedor",
      openConsole: "abrir en la consola de AWS",
      roleNote:
        "Hay que modificar el <b>rol</b>: una política pegada en el usuario IAM no tiene ningún efecto aquí.",
      stepPermissions:
        "Pestaña <b>Permissions</b>: haga clic en la política <b>ya existente</b>, {policyName} (la creada con el proveedor), y luego en <b>Edit</b> → pestaña <b>JSON</b>. No añada una nueva.",
      stepReplace:
        "Sustituya todo el contenido por el documento de abajo y pulse <b>Next</b> → <b>Save changes</b>.",
      stepRetest: "Vuelva aquí y repita la prueba.",
      nonAws:
        "{provider} aún no puede gestionar {zone}. En {host}, los permisos no se configuran zona por zona: compruebe que las credenciales del proveedor cubren este dominio (consulte <a>la guía de {host}</a>), corríjalas en Proveedores y repita la prueba.",
      policyTitleOne: "Política completa — {count} zona",
      policyTitleOther: "Política completa — {count} zonas",
      policyNote:
        "El documento cubre las zonas que este proveedor ya gestiona más {zone}: sustituye al anterior sin quitar nada. La escritura se limita a los tipos TXT, A, AAAA. Si aún no existe ninguna política en esta identidad, créela (<b>Add permissions</b> → <b>Create inline policy</b>) con el nombre {policyName}.",
      testAws: "Prueba de Route53 — la zona nunca se modifica.",
      testOther: "Prueba de {host} — se crea un registro TXT temporal y después se elimina.",
      testSlow: "Tras un cambio de permisos, puede tardar unos minutos en pasar.",
      notCovered: "La zona sirve «{zoneName}», que no cubre «{name}».",
      slowTitle: "Puede tardar unos minutos en aplicarse.",
      slowAws: "AWS no siempre aplica una política inmediatamente después de guardarla.",
      slowOther: "{host} no siempre aplica un cambio de permisos de inmediato.",
      slowBody:
        "No es necesario esperar aquí: añada el dominio <b>como pendiente</b>. local-cert repite esta prueba cada minuto, {max} veces, y activa el dominio en cuanto pase. Mientras esté pendiente, no se puede crear ningún certificado ni registro en él.",
      testing: "Probando los permisos…",
      retest: "Repetir prueba",
      testingShort: "Prueba…",
      testingAttempt: "Prueba… {attempt}/{max}",
      addPending: "Añadir como pendiente",
      addDomain: "Añadir el dominio",
      retrying: "Permisos aún no visibles. Nuevo intento automático ({attempt}/{max})…",
    },
  },
};
