import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, type DocCtx } from '../../_lib/prose';

export default function Quickstart({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Inicio rápido</h1>
      <p className="lead">
        local-cert obtiene certificados de Let&apos;s Encrypt para máquinas que no son accesibles
        desde Internet: NAS, hipervisores, servicios internos. La validación se hace por DNS
        (DNS-01), de modo que solo local-cert necesita acceso a su zona.
      </p>

      <h2>El recorrido completo</h2>
      <ol>
        <li>
          <b>Declarar un proveedor DNS.</b> Es la cuenta en el alojamiento de su zona, con sus
          credenciales: AWS, OVHcloud, Gandi, GoDaddy o Google Cloud. Página{' '}
          <Link href="/admin/providers">Proveedores</Link>, guías{' '}
          <Link href="/admin/docs/providers">Proveedores DNS</Link>.
        </li>
        <li>
          <b>Añadir un dominio.</b> Elija una zona del proveedor; local-cert genera la política
          IAM que hay que pegar, prueba los permisos y después lo registra. Página{' '}
          <Link href="/admin/domains">Dominios</Link>, guía{' '}
          <Link href="/admin/docs/domains">Añadir un dominio</Link>.
        </li>
        <li>
          <b>Conceder acceso.</b> En <Link href="/admin/keys">Claves y permisos</Link>, cree según
          la necesidad una <b>clave de API</b> (scripts, agentes) o una <b>credencial EAB</b>{' '}
          (clientes ACME: Traefik, Caddy, certbot…).
        </li>
        <li>
          <b>Emitir.</b> Mediante el servidor ACME o mediante la API; véase a continuación.
        </li>
      </ol>

      <h2>Qué vía elegir</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Servidor ACME</th>
              <th>API REST</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Para</td>
              <td>un proxy inverso o una herramienta que ya habla ACME</td>
              <td>un script, una herramienta sin ACME, un agente (MCP)</td>
            </tr>
            <tr>
              <td>Acceso</td>
              <td>credencial EAB</td>
              <td>clave de API</td>
            </tr>
            <tr>
              <td>Clave privada</td>
              <td>generada y conservada por el cliente</td>
              <td>generada por local-cert, cifrada en la base de datos</td>
            </tr>
            <tr>
              <td>Renovación</td>
              <td>por el cliente</td>
              <td>
                por local-cert (<code>auto_renew</code>)
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Vía ACME, con un solo comando</h2>
      <p>
        Con una credencial EAB autorizada sobre el dominio, cualquier cliente ACME obtiene un
        certificado. Ejemplo con certbot:
      </p>
      <CodeBlock
        title="certbot"
        code={`certbot certonly --standalone -d ${EX.host} \\
  --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac}`}
      />
      <p>
        El funcionamiento y las guías por herramienta están en{' '}
        <Link href="/admin/docs/acme">Servidor ACME</Link>.
      </p>

      <h2>Vía API, con una sola petición</h2>
      <CodeBlock
        title="curl"
        code={`curl -X POST ${ctx.origin}/api/v1/certificates \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H 'content-type: application/json' \\
  -d '{
    "domains": ["${EX.host}"],
    "key_type": "ec-256",
    "auto_renew": true,
    "dns": { "create_record": true, "target_ip": "192.168.1.50" }
  }'`}
      />
      <p>
        La respuesta es inmediata (<code>202</code>); la emisión tarda de uno a tres minutos.
        Todas las rutas se describen en la <Link href="/admin/api">API</Link>.
      </p>

      <Callout title="Durante las pruebas">
        La insignia <code>acme:staging</code> en la parte superior de la consola indica que
        local-cert habla con el entorno de pruebas de Let&apos;s Encrypt: los navegadores no
        reconocen los certificados, pero no se consume ninguna cuota. Pase a producción cuando la
        cadena esté validada.
      </Callout>
    </>
  );
}
