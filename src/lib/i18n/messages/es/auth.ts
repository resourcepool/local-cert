import type { auth as en } from '../en/auth';

export const auth: typeof en = {
  tagline: "Certificados Let's Encrypt para los equipos de su red local.",
  login: {
    title: "Iniciar sesión",
    email: "Correo electrónico",
    password: "Contraseña",
    checking: "Verificando…",
    submit: "Iniciar sesión",
  },
  setup: {
    intro: "Primera configuración: creación de la cuenta de administrador.",
    createdTitle: "Cuenta creada",
    createdBody: "Cuenta de administrador {email} creada. Ya ha iniciado sesión.",
    keyShownOnce: "Clave de API — se muestra una sola vez",
    keyNote: "Solo se guarda su hash. Anótela ahora: no se puede recuperar. Si se pierde: <code>npx tsx scripts/reset-admin.ts {email} <contraseña></code>.",
    openConsole: "Abrir la consola",
    accountTitle: "Cuenta de administrador",
    email: "Correo electrónico",
    password: "Contraseña",
    confirmation: "Confirmación",
    moreChars: "Faltan {count} carácter(es).",
    moreClasses: "Faltan {count} categoría(s) de caracteres.",
    mismatch: "Las contraseñas no coinciden.",
    ownKey: "Usar mi propia clave de API",
    apiKey: "Clave de API",
    apiKeyHint: "Mínimo 24 caracteres — se almacena cifrada con hash y no se vuelve a mostrar",
    generated: "Se generará una clave y se mostrará una sola vez en el siguiente paso.",
    creating: "Creando…",
    create: "Crear la cuenta",
    once: "Esta página solo se muestra una vez. Para automatizar, defina <code>ADMIN_EMAIL</code>, <code>ADMIN_PASSWORD</code> y, opcionalmente, <code>ADMIN_API_KEY</code> antes del primer arranque.",
  },
  policy: {
    none: "Sin política de contraseñas en el entorno de desarrollo.",
    rules: "Mínimo {minLength} caracteres, combinando al menos {requiredClasses} categorías entre minúscula, mayúscula, cifra y símbolo. Se rechazan las contraseñas habituales y las que contienen la dirección de correo.",
  },
};
