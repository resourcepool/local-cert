import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, type DocCtx } from '../../_lib/prose';

export default function Others({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Otros sistemas</h1>
      <p className="lead">
        Dos recetas cubren todo lo que no tiene guía propia: un cliente ACME genérico cuando el
        sistema admite uno, y la API de local-cert cuando solo sabe importar un certificado.
      </p>

      <h2>Reconocer el caso adecuado</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>El sistema…</th>
              <th>Receta</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>tiene un cliente ACME con URL de CA personalizada, EAB y HTTP-01</td>
              <td>
                configurarlo con los tres valores de la credencial EAB, como en{' '}
                <Link href="/admin/docs/acme">Servidor ACME</Link>
              </td>
            </tr>
            <tr>
              <td>ofrece acceso a shell</td>
              <td>
                acme.sh y un hook de despliegue; véase{' '}
                <Link href="/admin/docs/acme/clients">certbot, acme.sh, lego</Link>
              </td>
            </tr>
            <tr>
              <td>solo sabe importar un certificado, o solo hacer DNS-01</td>
              <td>la API de local-cert, a continuación</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Referencias por sistema</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sistema</th>
              <th>Planteamiento</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>OPNsense</td>
              <td>
                Plugin <code>os-acme-client</code>: cree una cuenta en una CA personalizada con la
                URL del directory y los campos EAB, y después un certificado con desafío HTTP-01.
                El plugin se apoya en acme.sh.
              </td>
            </tr>
            <tr>
              <td>pfSense</td>
              <td>
                Paquete ACME: si su versión ofrece un servidor ACME personalizado con EAB, el
                procedimiento es el mismo. Si no, acme.sh en shell y después importación en{' '}
                <b>System</b> → <b>Certificates</b>.
              </td>
            </tr>
            <tr>
              <td>TrueNAS</td>
              <td>
                Su cliente ACME solo hace DNS-01 con sus propios proveedores: utilice la API de
                local-cert e importe después el certificado.
              </td>
            </tr>
            <tr>
              <td>Unraid, UniFi, impresoras, iDRAC/iLO, equipos de red</td>
              <td>Importación de certificado: API de local-cert.</td>
            </tr>
            <tr>
              <td>Zoraxy, SWAG, proxies basados en lego o certbot</td>
              <td>
                Si exponen la URL de la CA y el EAB, caso genérico. Si no, importación.
              </td>
            </tr>
            <tr>
              <td>Envoy, proxies sin cliente ACME</td>
              <td>
                acme.sh o lego a su lado, archivos montados en el proxy y recarga mediante hook.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout title="Antes de probar un cliente ACME integrado">
        Compruebe los tres requisitos: URL de directory configurable, External Account Binding y
        desafío HTTP-01. Si falta alguno, pase directamente a la API: ahorrará tiempo.
      </Callout>

      <h2>Receta API: local-cert conserva la clave y renueva</h2>
      <p>
        Aquí el sistema de destino no habla con local-cert. Es local-cert quien genera la clave,
        obtiene el certificado y lo renueva, y un script va a buscar la versión actualizada. Se
        necesita una <b>clave de API</b> (<Link href="/admin/keys">Claves y permisos</Link>) con
        los permisos <code>cert:issue</code>, <code>cert:read</code> y <code>cert:export</code>{' '}
        sobre el dominio.
      </p>
      <h3>1. Solicitar el certificado, una sola vez</h3>
      <CodeBlock
        title="curl"
        code={`curl -X POST ${ctx.origin}/api/v1/certificates \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H 'content-type: application/json' \\
  -d '{"domains": ["${EX.host}"], "key_type": "ec-256", "auto_renew": true}'
# → { "id": "cert_…", "status": "pending", … }`}
      />
      <h3>2. Recuperar certificado y clave, en cada ejecución</h3>
      <CodeBlock
        title="script programado (cron, diario)"
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

# solo recarga si el certificado ha cambiado
if ! cmp -s "$OUT/fullchain.pem.new" "$OUT/fullchain.pem"; then
  mv "$OUT/fullchain.pem.new" "$OUT/fullchain.pem"
  mv "$OUT/privkey.pem.new"  "$OUT/privkey.pem"
  # aquí: el comando de importación o de recarga del sistema de destino
fi`}
      />
      <p>
        En lugar de consultar cada día, la solicitud admite un <code>webhook_url</code> al que se
        llama en cada emisión y renovación. El detalle de las rutas está en la{' '}
        <Link href="/admin/api">API</Link>.
      </p>
    </>
  );
}
