import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EabValues, type DocCtx } from '../../_lib/prose';

export default function Acme({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Servidor ACME</h1>
      <p className="lead">
        local-cert expone un punto de acceso ACME (RFC 8555) en <code>/acme/directory</code>.
        Cualquier herramienta capaz de pedir un certificado a Let&apos;s Encrypt puede pedírselo
        a local-cert en su lugar, para equipos a los que Let&apos;s Encrypt nunca podría llegar.
      </p>
      <CodeBlock title="Directory de esta instancia" code={ctx.directory} />

      <h2>Qué es y qué no es</h2>
      <p>
        No es una autoridad de certificación. local-cert no firma nada: actúa como intermediario
        entre su cliente ACME y Let&apos;s Encrypt, y el certificado que se recibe es un
        certificado real de Let&apos;s Encrypt, reconocido en todas partes.
      </p>
      <p>
        El problema que resuelve: un cliente ACME clásico demuestra que controla un nombre
        respondiendo en el puerto 80 (HTTP-01), lo que exige que Let&apos;s Encrypt pueda llegar a
        la máquina. En una LAN, eso es imposible. La prueba por DNS (DNS-01) funciona, pero obliga
        a dar credenciales DNS a cada máquina. local-cert se queda con esas credenciales y realiza
        la prueba DNS en lugar del cliente.
      </p>

      <h2>Cómo se emite un certificado</h2>
      <ol>
        <li>
          <b>Registro.</b> El cliente crea su cuenta ACME presentando una credencial EAB. Solo se
          hace una vez; después firma con su propia clave de cuenta.
        </li>
        <li>
          <b>Pedido.</b> El cliente solicita un certificado para uno o varios nombres. local-cert
          comprueba que pertenecen a un dominio gestionado y que la credencial EAB tiene permiso
          sobre él. Si no, el pedido se rechaza de inmediato.
        </li>
        <li>
          <b>Desafío.</b> local-cert propone un desafío HTTP-01, como una CA ordinaria. El cliente
          prepara su respuesta e indica que está listo.
        </li>
        <li>
          <b>Validación real.</b> local-cert nunca va a buscar la respuesta HTTP. En su lugar,
          abre un pedido en Let&apos;s Encrypt, escribe el registro TXT{' '}
          <code>_acme-challenge</code> en su zona, espera a que se propague, solicita la
          validación y después elimina el registro. El desafío del cliente pasa a{' '}
          <code>valid</code> cuando termina.
        </li>
        <li>
          <b>Finalización.</b> El cliente envía su CSR. local-cert lo transmite a Let&apos;s
          Encrypt y devuelve la cadena de certificados. La clave privada nunca ha salido del
          cliente.
        </li>
      </ol>
      <Callout title="Consecuencias prácticas">
        <ul>
          <li>
            El puerto 80 del cliente no necesita ser accesible, ni desde local-cert ni desde
            Internet. El cliente solo debe poder llamar a local-cert por HTTP(S).
          </li>
          <li>
            El paso 4 tarda de uno a tres minutos: es el tiempo de propagación del DNS. Los
            clientes esperan por sí mismos; no reduzca sus tiempos de espera.
          </li>
          <li>
            Solo se ofrece HTTP-01. Un cliente configurado únicamente para DNS-01 o TLS-ALPN-01 no
            encontrará ningún desafío compatible.
          </li>
        </ul>
      </Callout>

      <h2>Las credenciales EAB</h2>
      <p>
        EAB significa <i>External Account Binding</i>. Es el mecanismo previsto por ACME para que
        una CA solo acepte a los clientes que ya conoce: al crear su cuenta, el cliente demuestra
        que posee un secreto entregado de antemano. Aquí es lo que sustituye a la clave de API.
      </p>
      <p>Una credencial EAB se compone de dos valores, además de la URL del servidor:</p>
      <EabValues ctx={ctx} />
      <p>
        Se crea en <Link href="/admin/keys">Claves y permisos</Link> →{' '}
        <b>Credenciales EAB</b> → <b>+ nueva credencial</b>, indicando:
      </p>
      <ul>
        <li>
          un <b>nombre</b>, para saber a qué cliente se entregó;
        </li>
        <li>
          una <b>caducidad</b> opcional;
        </li>
        <li>
          los <b>dominios autorizados</b>: el cliente solo puede pedir certificados bajo esos
          dominios.
        </li>
      </ul>
      <h3>Lo que conviene saber</h3>
      <ul>
        <li>
          La clave HMAC solo se muestra una vez. Si se pierde, hay que crear una credencial nueva.
        </li>
        <li>
          El cliente solo la usa en el registro, pero local-cert vuelve a leer la credencial en
          cada petición: <b>revocarla</b> o dejar que <b>caduque</b> también corta a los clientes
          ya registrados.
        </li>
        <li>
          Una credencial puede servir a varios clientes. Una credencial por cliente permite
          cortarlos por separado y saber quién ha emitido qué.
        </li>
        <li>
          La clave está codificada en base64url, el formato que esperan todos los clientes (
          <code>hmacEncoded</code>, <code>--eab-hmac-key</code>, <code>mac_key</code>…).
        </li>
      </ul>

      <h2>Lo que el cliente debe saber hacer</h2>
      <p>Tres cosas, que casi todos los clientes ACME modernos ofrecen:</p>
      <ol>
        <li>usar una URL de directory personalizada;</li>
        <li>registrarse con un External Account Binding;</li>
        <li>resolver un desafío HTTP-01.</li>
      </ol>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Herramienta</th>
              <th>Compatibilidad</th>
              <th>Guía</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Traefik', 'nativa', 'acme/traefik'],
              ['Caddy', 'nativa', 'acme/caddy'],
              ['Apache httpd', 'nativa (mod_md)', 'acme/apache'],
              ['Nginx', 'mediante certbot o acme.sh', 'acme/nginx'],
              ['HAProxy', 'mediante acme.sh', 'acme/haproxy'],
              ['Nginx Proxy Manager', 'importación manual', 'acme/nginx-proxy-manager'],
              ['Kubernetes', 'nativa (cert-manager)', 'acme/kubernetes'],
              ['Dokploy', 'nativa (Traefik)', 'acme/dokploy'],
              ['Coolify', 'nativa (Traefik)', 'acme/coolify'],
              ['Synology DSM', 'mediante acme.sh', 'acme/synology'],
              ['Proxmox VE', 'nativa (pvenode)', 'acme/proxmox'],
              ['certbot, acme.sh, lego', 'nativa', 'acme/clients'],
            ].map(([tool, support, slug]) => (
              <tr key={slug}>
                <td>{tool}</td>
                <td>{support}</td>
                <td>
                  <Link href={`/admin/docs/${slug}`}>abrir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Para todo lo demás, consulte <Link href="/admin/docs/acme/others">Otros sistemas</Link>.
      </p>

      <h2>Reglas y límites</h2>
      <ul>
        <li>
          Un nombre fuera de los dominios gestionados se rechaza (<code>rejectedIdentifier</code>);
          también un dominio no autorizado para la credencial (<code>unauthorized</code>).
        </li>
        <li>Todos los nombres de un mismo pedido deben pertenecer al mismo dominio gestionado.</li>
        <li>
          Se aceptan los comodines (<code>*.home.example.com</code>): como la validación real se
          hace por DNS-01, no se aplica la restricción habitual de HTTP-01. Aun así, algunos
          clientes rechazan por sí mismos un comodín en HTTP-01.
        </li>
        <li>
          Estos certificados aparecen en <Link href="/admin/certificates">Certificados</Link> con
          el tipo de clave <code>external</code>, sin clave privada ni renovación automática: la
          renovación la realiza el cliente.
        </li>
        <li>
          Una cuenta ACME puede revocar los certificados que ha obtenido. La rotación de la clave
          de cuenta (<code>keyChange</code>) no está implementada.
        </li>
      </ul>

      <h2>Solución de problemas</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Síntoma</th>
              <th>Causa</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>JWS &quot;url&quot; is … but this endpoint is …</code>
              </td>
              <td>
                local-cert está detrás de un proxy que no transmite{' '}
                <code>X-Forwarded-Proto</code> / <code>X-Forwarded-Host</code>. Transmítalos o
                defina la variable <code>PUBLIC_URL</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>externalAccountRequired</code>
              </td>
              <td>El cliente se registra sin EAB. Revise su configuración.</td>
            </tr>
            <tr>
              <td>
                <code>unauthorized</code> en el registro
              </td>
              <td>Credencial desconocida, revocada o caducada, o clave HMAC incorrecta.</td>
            </tr>
            <tr>
              <td>
                <code>rejectedIdentifier</code>
              </td>
              <td>El nombre solicitado no está bajo ningún dominio gestionado.</td>
            </tr>
            <tr>
              <td>El cliente abandona tras ~1 minuto</td>
              <td>
                Su tiempo de espera es inferior al de la validación DNS. Vuelva a lanzarlo: se
                retoma el pedido en curso.
              </td>
            </tr>
            <tr>
              <td>Error TLS hacia local-cert</td>
              <td>
                local-cert se sirve con un certificado que el cliente no reconoce. Sírvalo con un
                certificado público o añada su CA al almacén del cliente.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
