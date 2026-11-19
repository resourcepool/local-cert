import type { ui as en } from '../en/ui';

export const ui: typeof en = {
  modal: {
    close: "Cerrar",
    confirmClose: "Confirmar el cierre",
    keepEditing: "continuar",
    closeAnyway: "cerrar",
  },
  status: {
    issued: "emitido",
    pending: "pendiente",
    dns_propagating: "propagación DNS",
    validating: "validando",
    failed: "fallido",
    revoked: "revocado",
    expired: "caducado",
  },
  copy: {
    action: "copiar",
    done: "copiado",
    failed: "error",
    blockFailed: "no se pudo copiar — seleccione el texto",
    title: "Copiar",
  },
  confirm: {
    typed: "Para confirmar, escriba {typed}",
    cancel: "cancelar",
  },
  preflight: {
    ok: "OK",
    refusedRequired: "DENEGADO",
    refusedOptional: "denegado",
    optionalPrefix: "(opcional) ",
  },
};
