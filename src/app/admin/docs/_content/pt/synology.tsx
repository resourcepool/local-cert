import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Synology({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Synology DSM</h1>
      <p className="lead">
        O assistente de certificados do DSM só conhece o Let&apos;s Encrypt e exige que o NAS seja
        acessível a partir da Internet. O acme.sh, instalado no NAS, obtém o certificado junto do
        local-cert e instala-o no DSM com o seu hook <code>synology_dsm</code>.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Preparar o NAS</h2>
      <ol>
        <li>
          <b>Painel de controlo</b> → <b>Terminal e SNMP</b> → ative o SSH.
        </li>
        <li>
          Ligue-se por SSH com uma conta de administrador e execute <code>sudo -i</code>.
        </li>
      </ol>
      <CodeBlock
        title="instalar o acme.sh fora do volume do sistema"
        code={`mkdir -p /usr/local/share/acme.sh/webroot
cd /tmp && wget -O acme.sh.tar.gz https://github.com/acmesh-official/acme.sh/archive/master.tar.gz
tar xzf acme.sh.tar.gz && cd acme.sh-master
./acme.sh --install --nocron --home /usr/local/share/acme.sh -m ${EX.email}
cd /usr/local/share/acme.sh`}
      />

      <h2>2. Conta e emissão</h2>
      <CodeBlock
        title="acme.sh"
        code={`./acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac}

./acme.sh --issue --server ${ctx.directory} \\
  -d ${EX.host} -w /usr/local/share/acme.sh/webroot`}
      />
      <p>
        A pasta webroot permanece vazia e não é servida por nada: o local-cert não vai ler o
        desafio. O NAS não precisa de abrir qualquer porta.
      </p>

      <h2>3. Instalar no DSM</h2>
      <CodeBlock
        title="acme.sh — hook synology_dsm"
        code={`export SYNO_SCHEME=http
export SYNO_HOSTNAME=localhost
export SYNO_PORT=5000
export SYNO_USERNAME='uma-conta-admin'
export SYNO_PASSWORD='a-sua-palavra-passe'
export SYNO_CERTIFICATE='local-cert'   # descrição do certificado no DSM
export SYNO_CREATE=1                    # criá-lo se não existir

./acme.sh --deploy -d ${EX.host} --deploy-hook synology_dsm`}
      />
      <p>
        O certificado aparece em <b>Painel de controlo</b> → <b>Segurança</b> →{' '}
        <b>Certificado</b>. Atribua-o aos serviços pretendidos com <b>Definições</b>.
      </p>
      <Callout kind="warn" title="Conta e autenticação de dois fatores">
        O hook liga-se ao DSM com esta conta. Crie um administrador dedicado, sem autenticação de
        dois fatores, ou utilize as variáveis previstas para o OTP pelas versões recentes do
        acme.sh. Os nomes das variáveis mudaram ao longo das versões (
        <code>SYNO_Username</code> → <code>SYNO_USERNAME</code>): se o hook não as vir, consulte o
        cabeçalho de <code>deploy/synology_dsm.sh</code>.
      </Callout>

      <h2>4. Renovação</h2>
      <p>
        <b>Painel de controlo</b> → <b>Agendador de tarefas</b> → <b>Criar</b> →{' '}
        <b>Tarefa agendada</b> → <b>Script definido pelo utilizador</b>, utilizador{' '}
        <code>root</code>, todos os dias:
      </p>
      <CodeBlock
        title="script"
        code={`/usr/local/share/acme.sh/acme.sh --cron --home /usr/local/share/acme.sh`}
      />
      <p>
        O acme.sh só renova quando o termo se aproxima e depois repete a implementação no DSM com
        as definições memorizadas.
      </p>
    </>
  );
}
