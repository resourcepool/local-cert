import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, type DocCtx } from '../../_lib/prose';

export default function Others({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Outros sistemas</h1>
      <p className="lead">
        Duas receitas cobrem tudo o que não tem guia próprio: um cliente ACME genérico quando o
        sistema aceita um, a API do local-cert quando só sabe importar um certificado.
      </p>

      <h2>Identificar o caso certo</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>O sistema…</th>
              <th>Receita</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>tem um cliente ACME com URL de CA personalizado, EAB e HTTP-01</td>
              <td>
                configurá-lo com os três valores da credencial EAB, como em{' '}
                <Link href="/admin/docs/acme">Servidor ACME</Link>
              </td>
            </tr>
            <tr>
              <td>dá acesso a uma shell</td>
              <td>
                acme.sh e um hook de implementação — ver{' '}
                <Link href="/admin/docs/acme/clients">certbot, acme.sh, lego</Link>
              </td>
            </tr>
            <tr>
              <td>só sabe importar um certificado, ou apenas fazer DNS-01</td>
              <td>a API do local-cert, abaixo</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Pontos de referência por sistema</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sistema</th>
              <th>Abordagem</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>OPNsense</td>
              <td>
                Plugin <code>os-acme-client</code>: crie uma conta numa CA personalizada com o URL
                do directory e os campos EAB e, depois, um certificado com desafio HTTP-01. O
                plugin assenta no acme.sh.
              </td>
            </tr>
            <tr>
              <td>pfSense</td>
              <td>
                Pacote ACME: se a sua versão oferecer um servidor ACME personalizado com EAB, o
                mesmo procedimento. Caso contrário, acme.sh na shell e importação em{' '}
                <b>System</b> → <b>Certificates</b>.
              </td>
            </tr>
            <tr>
              <td>TrueNAS</td>
              <td>
                O seu cliente ACME só faz DNS-01 com os seus próprios fornecedores: utilize a API
                do local-cert e importe depois o certificado.
              </td>
            </tr>
            <tr>
              <td>Unraid, UniFi, impressoras, iDRAC/iLO, equipamentos de rede</td>
              <td>Importação de certificado: API do local-cert.</td>
            </tr>
            <tr>
              <td>Zoraxy, SWAG, proxies baseados no lego ou no certbot</td>
              <td>
                Se expuserem o URL da CA e o EAB, caso genérico. Caso contrário, importação.
              </td>
            </tr>
            <tr>
              <td>Envoy, proxies sem cliente ACME</td>
              <td>
                acme.sh ou lego ao lado, ficheiros montados no proxy, recarregamento por hook.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout title="Antes de experimentar um cliente ACME integrado">
        Verifique os três pré-requisitos: URL de directory livre, External Account Binding,
        desafio HTTP-01. Se faltar algum, passe diretamente à API: poupará tempo.
      </Callout>

      <h2>Receita API: o local-cert guarda a chave e renova</h2>
      <p>
        Aqui o sistema de destino não comunica com o local-cert. É o local-cert que gera a chave,
        obtém o certificado, o renova, e um script vai buscar a versão atualizada. É necessária
        uma <b>chave de API</b> (<Link href="/admin/keys">Chaves e permissões</Link>) com as
        permissões <code>cert:issue</code>, <code>cert:read</code> e <code>cert:export</code> sobre
        o domínio.
      </p>
      <h3>1. Pedir o certificado, uma vez</h3>
      <CodeBlock
        title="curl"
        code={`curl -X POST ${ctx.origin}/api/v1/certificates \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H 'content-type: application/json' \\
  -d '{"domains": ["${EX.host}"], "key_type": "ec-256", "auto_renew": true}'
# → { "id": "cert_…", "status": "pending", … }`}
      />
      <h3>2. Recolher certificado e chave, a cada execução</h3>
      <CodeBlock
        title="script agendado (cron, diário)"
        code={`#!/bin/sh
set -eu
ID=cert_XXXXXXXXXXXXXXXX
OUT=/etc/ssl/local-cert

curl -fsS -H "Authorization: Bearer $TOKEN" \\
  "${ctx.origin}/api/v1/certificates/$ID/bundle?format=pem&include=fullchain" \\
  -o "$OUT/fullchain.pem.new"
curl -fsS -H "Authorization: Bearer $TOKEN" \\
  "${ctx.origin}/api/v1/certificates/$ID/bundle?format=pem&include=key" \\
  -o "$OUT/privkey.pem.new"

# só recarrega se o certificado tiver mudado
if ! cmp -s "$OUT/fullchain.pem.new" "$OUT/fullchain.pem"; then
  mv "$OUT/fullchain.pem.new" "$OUT/fullchain.pem"
  mv "$OUT/privkey.pem.new"  "$OUT/privkey.pem"
  # aqui: o comando de importação ou de recarregamento do sistema de destino
fi`}
      />
      <p>
        Em vez de consultar todos os dias, o pedido aceita um <code>webhook_url</code> chamado a
        cada emissão e renovação. O detalhe das rotas está em <Link href="/admin/api">API</Link>.
      </p>
    </>
  );
}
