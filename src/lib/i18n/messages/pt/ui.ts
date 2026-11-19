import type { ui as en } from '../en/ui';

export const ui: typeof en = {
  modal: {
    close: "Fechar",
    confirmClose: "Confirmar o fecho",
    keepEditing: "continuar",
    closeAnyway: "fechar",
  },
  status: {
    issued: "emitido",
    pending: "pendente",
    dns_propagating: "propagação DNS",
    validating: "em validação",
    failed: "falhado",
    revoked: "revogado",
    expired: "expirado",
  },
  copy: {
    action: "copiar",
    done: "copiado",
    failed: "falhou",
    blockFailed: "não foi possível copiar — selecione o texto",
    title: "Copiar",
  },
  confirm: {
    typed: "Para confirmar, introduza {typed}",
    cancel: "cancelar",
  },
  preflight: {
    ok: "OK",
    refusedRequired: "RECUSADO",
    refusedOptional: "recusado",
    optionalPrefix: "(opcional) ",
  },
};
