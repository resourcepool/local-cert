import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, type DocCtx } from '../../_lib/prose';

export default function NginxProxyManager({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Nginx Proxy Manager</h1>
      <p className="lead">
        A interface do Nginx Proxy Manager não permite escolher nem o servidor ACME nem um EAB: a
        sua emissão integrada só comunica com o Let&apos;s Encrypt. O certificado é, por isso,
        obtido à parte e depois importado como certificado personalizado.
      </p>

      <h2>1. Obter o certificado</h2>
      <p>
        No anfitrião, com o acme.sh (ver{' '}
        <Link href="/admin/docs/acme/clients">certbot, acme.sh, lego</Link> para os pormenores):
      </p>
      <CodeBlock
        title="acme.sh"
        code={`acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid eab_XXXXXXXXXXXXXXXX --eab-hmac-key CLE_HMAC -m ops@example.com

mkdir -p /var/lib/acme-webroot /opt/npm-certs
acme.sh --issue --server ${ctx.directory} -d ${EX.host} -w /var/lib/acme-webroot
acme.sh --install-cert -d ${EX.host} \\
  --key-file       /opt/npm-certs/${EX.host}.key \\
  --fullchain-file /opt/npm-certs/${EX.host}.pem`}
      />

      <h2>2. Importá-lo</h2>
      <ol>
        <li>
          <b>SSL Certificates</b> → <b>Add SSL Certificate</b> → <b>Custom</b>.
        </li>
        <li>
          Chave: <code>{EX.host}.key</code>. Certificado: <code>{EX.host}.pem</code>.
        </li>
        <li>
          No <b>Proxy Host</b>, separador <b>SSL</b>, escolha este certificado.
        </li>
      </ol>

      <Callout kind="warn" title="A renovação não é automática">
        O acme.sh renova os ficheiros, mas o Nginx Proxy Manager mantém a cópia importada. De dois
        em dois meses, aproximadamente, volte a importar o certificado — ou, se tiver essa
        possibilidade, prefira um proxy que fale ACME com uma CA personalizada (Traefik, Caddy),
        onde tudo é automático.
      </Callout>

      <h2>Outra via: deixar o local-cert gerir a chave</h2>
      <p>
        Pela <Link href="/admin/api">API</Link>, o local-cert gera a chave, renova sozinho e expõe
        o certificado atualizado. Um script agendado só tem de transferir o pacote e enviá-lo para
        o Nginx Proxy Manager. Ver <Link href="/admin/docs/acme/others">Outros sistemas</Link>.
      </p>
    </>
  );
}
