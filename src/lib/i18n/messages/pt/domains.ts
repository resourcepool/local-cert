import type { domains as en } from '../en/domains';

export const domains: typeof en = {
  panelTitle: "Domínios geridos",
  addButton: "+ adicionar um domínio",
  empty: "Nenhum domínio. Adicione a zona que aloja os seus subdomínios de LAN.",
  table: {
    domain: "Domínio",
    state: "Estado",
    provider: "Fornecedor",
    zone: "Zona",
    ttl: "TTL",
    certs: "Certs",
  },
  status: {
    active: "ativo",
    pending: "pendente · verificação {attempt}/{max}",
    error: "erro",
  },
  envProvider: "ambiente",
  envProviderTitle: "Declarado antes dos fornecedores: credenciais do processo local-cert",
  assume: "assume {arn}",
  checkNow: "verificar agora",
  recheck: "repetir a verificação",
  checkFailed: "{name}: {message}",
  pendingNote:
    "Um domínio <i>pendente</i> foi adicionado antes de as suas permissões DNS estarem configuradas: o local-cert volta a testá-las todos os minutos, {max} vezes, e ativa-o assim que o teste passar. Após {max} falhas passa a <i>erro</i>: corrija as permissões no fornecedor DNS e repita a verificação. Só um domínio ativo pode receber certificados e registos.",
  remove: {
    title: "Remover {name}",
    confirmWithCertsOne: "Remover o domínio e {count} certificado",
    confirmWithCertsOther: "Remover o domínio e {count} certificados",
    confirm: "Remover o domínio",
    withCerts:
      "{name} ainda tem {certs}. Serão revogados na Let's Encrypt, os respetivos registos DNS removidos e, por fim, tudo será eliminado do local-cert. Irreversível.",
    certsOne: "{count} certificado",
    certsOther: "{count} certificados",
    bestEffort:
      "A limpeza do DNS é feita na medida do possível: se o acesso ao fornecedor DNS se perder, a remoção conclui-se na mesma e os registos restantes são listados.",
    plain:
      "Remover {name} do local-cert? Nenhum certificado depende dele. A zona DNS em si não é alterada.",
  },
  wizard: {
    title: "Adicionar um domínio",
    closeGuard: "Fechar? O domínio ainda não foi adicionado: a seleção será perdida.",
    steps: {
      provider: "Fornecedor",
      zone: "Zona",
      rights: "Permissões e teste",
    },
    provider: {
      none: "Nenhum fornecedor DNS. Crie um em <a>Fornecedores</a>: é ele que guarda as credenciais AWS e lista as suas zonas.",
      legend: "A conta que aloja a zona DNS",
      readingZones: "A ler as zonas…",
      usableOne: "{count} zona utilizável nesta conta",
      usableOther: "{count} zonas utilizáveis nesta conta",
      hiddenOne: "{count} oculta (servidores de nomes noutro local)",
      hiddenOther: "{count} ocultas (servidores de nomes noutro local)",
    },
    zone: {
      noZones:
        "Esta conta não tem nenhuma zona DNS em {host}. Crie a zona (ou delegue nela um subdomínio) e volte.",
      noUsable:
        "Nenhuma zona desta conta é servida por {host}: os respetivos servidores de nomes apontam para outro local.",
      private: "zona privada — invisível para a Let's Encrypt, DNS-01 impossível",
      public: "pública",
      publicCountOne: "pública · {count} registo",
      publicCountOther: "pública · {count} registos",
      alreadyManaged: "já gerido: {domains}",
      hiddenSummaryOne: "{count} zona oculta: os seus servidores de nomes não estão em {host}",
      hiddenSummaryOther: "{count} zonas ocultas: os seus servidores de nomes não estão em {host}",
      noNameservers: "nenhum servidor de nomes público",
      hiddenExplain:
        "Um registo escrito em {host} nunca seria visto pela Let's Encrypt. Aponte o domínio para os servidores de {host}, ou declare-o no fornecedor que realmente o aloja.",
      baseName: "Nome de base",
      baseNameHint:
        "a própria zona, ou um subdomínio de {zone} — todos os certificados terão de ficar abaixo",
      ttl: "TTL predefinido (s)",
      ttlHint: "{host} impõe um mínimo de {min} s: um valor inferior será elevado a esse mínimo",
    },
    rights: {
      ok: "As permissões estão configuradas para {zone}. Pode adicionar o domínio.",
      missing: "{provider} ainda não tem permissões sobre {zone}. Na consola AWS:",
      stepIam: "<b>IAM</b> → {kind} → {target}",
      kindRole: "Roles",
      kindUser: "Users",
      identityFallback: "a identidade do fornecedor",
      openConsole: "abrir na consola AWS",
      roleNote:
        "É a <b>função</b> (role) que tem de ser alterada: uma política colada no utilizador IAM não tem qualquer efeito aqui.",
      stepPermissions:
        "Separador <b>Permissions</b>: clique na política <b>já existente</b>, {policyName} (a criada com o fornecedor), depois em <b>Edit</b> → separador <b>JSON</b>. Não adicione uma nova.",
      stepReplace:
        "Substitua todo o conteúdo pelo documento abaixo e depois <b>Next</b> → <b>Save changes</b>.",
      stepRetest: "Volte aqui e repita o teste.",
      nonAws:
        "{provider} ainda não consegue gerir {zone}. Em {host}, as permissões não se definem zona a zona: verifique se as credenciais do fornecedor cobrem este domínio (consulte <a>o guia {host}</a>), corrija-as em Fornecedores e repita o teste.",
      policyTitleOne: "Política completa — {count} zona",
      policyTitleOther: "Política completa — {count} zonas",
      policyNote:
        "O documento cobre as zonas já geridas por este fornecedor mais {zone}: substitui o anterior sem retirar nada. A escrita limita-se aos tipos TXT, A, AAAA. Se ainda não existir nenhuma política nesta identidade, crie-a (<b>Add permissions</b> → <b>Create inline policy</b>) com o nome {policyName}.",
      testAws: "Teste Route53 — a zona nunca é modificada.",
      testOther: "Teste {host} — é criado um registo TXT temporário e depois eliminado.",
      testSlow: "Após uma alteração de permissões, pode demorar alguns minutos a passar.",
      notCovered: "A zona serve «{zoneName}», que não cobre «{name}».",
      slowTitle: "Pode demorar alguns minutos a ter efeito.",
      slowAws: "A AWS nem sempre aplica uma política logo após a guardar.",
      slowOther: "{host} nem sempre aplica logo uma alteração de permissões.",
      slowBody:
        "Não é preciso esperar aqui: adicione o domínio <b>como pendente</b>. O local-cert repete este teste todos os minutos, {max} vezes, e ativa o domínio assim que passar. Enquanto estiver pendente, não é possível criar certificados nem registos nele.",
      testing: "A testar as permissões…",
      retest: "Repetir teste",
      testingShort: "Teste…",
      testingAttempt: "Teste… {attempt}/{max}",
      addPending: "Adicionar como pendente",
      addDomain: "Adicionar o domínio",
      retrying: "Permissões ainda não visíveis. Nova tentativa automática ({attempt}/{max})…",
    },
  },
};
