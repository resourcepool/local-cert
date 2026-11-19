import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Clients({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>certbot, acme.sh, lego</h1>
      <p className="lead">
        Os três clientes de linha de comandos. Bastam para equipar qualquer máquina, e a maioria
        das integrações dos outros guias assenta num deles.
      </p>
      <EabValues ctx={ctx} />

      <Callout title="O desafio nunca é recolhido">
        O local-cert não vai ler a resposta HTTP-01. Pode, por isso, usar o modo <b>webroot</b>{' '}
        apontando para uma pasta qualquer, mesmo que não seja servida por nenhum servidor web: é o
        mais simples quando a porta 80 já está ocupada.
      </Callout>

      <h2>certbot</h2>
      <p>Porta 80 livre na máquina: modo autónomo.</p>
      <CodeBlock
        title="certbot — standalone"
        code={`certbot certonly --standalone -d ${EX.host} \\
  --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} \\
  --email ${EX.email} --agree-tos --no-eff-email`}
      />
      <p>Porta 80 ocupada: modo webroot, apontando para uma pasta vazia.</p>
      <CodeBlock
        title="certbot — webroot"
        code={`mkdir -p /var/lib/letsencrypt/webroot
certbot certonly --webroot -w /var/lib/letsencrypt/webroot -d ${EX.host} \\
  --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} \\
  --email ${EX.email} --agree-tos --no-eff-email \\
  --deploy-hook "systemctl reload nginx"`}
      />
      <p>
        Os ficheiros ficam em <code>/etc/letsencrypt/live/{EX.host}/</code>. O servidor e o EAB
        ficam memorizados no ficheiro de renovação: o temporizador <code>certbot renew</code>{' '}
        instalado pelo pacote renova sem mais configuração. Verifique com{' '}
        <code>certbot renew --dry-run</code>.
      </p>

      <h2>acme.sh</h2>
      <p>O registo da conta é um passo separado, feito uma vez por máquina.</p>
      <CodeBlock
        title="acme.sh"
        code={`# 1. conta, com o EAB
acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} -m ${EX.email}

# 2. emissão (webroot para uma pasta vazia)
mkdir -p /var/lib/acme-webroot
acme.sh --issue --server ${ctx.directory} \\
  -d ${EX.host} -w /var/lib/acme-webroot

# 3. instalação dos ficheiros e comando de recarregamento
acme.sh --install-cert -d ${EX.host} \\
  --key-file       /etc/ssl/private/${EX.host}.key \\
  --fullchain-file /etc/ssl/certs/${EX.host}.pem \\
  --reloadcmd      "systemctl reload nginx"`}
      />
      <p>
        Com a porta 80 livre, substitua <code>-w …</code> por <code>--standalone</code> (
        <code>socat</code> necessário). A renovação é feita pela tarefa cron instalada pelo
        acme.sh; a pasta webroot tem, por isso, de existir de forma duradoura, daí um caminho fora
        de <code>/tmp</code>.
      </p>

      <h2>lego</h2>
      <CodeBlock
        title="lego"
        code={`lego --server ${ctx.directory} \\
  --eab --kid ${EX.kid} --hmac ${EX.hmac} \\
  --email ${EX.email} --accept-tos \\
  --http --domains ${EX.host} \\
  run`}
      />
      <p>
        Os ficheiros ficam em <code>./.lego/certificates/</code>. O lego não instala nenhuma
        tarefa agendada: agende o mesmo comando, terminado em <code>renew --days 30</code>. Com a
        porta 80 ocupada, acrescente <code>--http.webroot /var/lib/acme-webroot</code>.
      </p>

      <h2>Verificar</h2>
      <CodeBlock
        title="openssl"
        code={`openssl x509 -in /etc/letsencrypt/live/${EX.host}/fullchain.pem -noout -issuer -subject -enddate`}
      />
      <p>
        O emissor deve ser o Let&apos;s Encrypt (ou <i>(STAGING)</i> enquanto o local-cert estiver
        em ambiente de testes). O certificado aparece também em{' '}
        <Link href="/admin/certificates">Certificados</Link>.
      </p>
    </>
  );
}
