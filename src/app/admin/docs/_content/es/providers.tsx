import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { getMessages } from '@/lib/i18n/server';
import { localizeProvider } from '@/lib/i18n/provider-text';
import { PROVIDER_INFO, PROVIDER_TYPES } from '@/lib/dns/provider-types';
import { Callout } from '../../_lib/prose';

export default async function Providers() {
  const messages = await getMessages();
  return (
    <>
      <h1>Proveedores DNS</h1>
      <p className="lead">
        Un proveedor es una cuenta en el alojamiento de sus zonas DNS, con las credenciales que
        permiten a local-cert escribir en ellas. Por ahí pasa la prueba que exige Let&apos;s
        Encrypt: un registro TXT colocado durante el tiempo de la validación.
      </p>

      <h2>Proveedores compatibles</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Servicio</th>
              <th>Credenciales</th>
              <th>TTL mínimo</th>
              <th>Guía</th>
            </tr>
          </thead>
          <tbody>
            {PROVIDER_TYPES.map((type) => {
              const info = localizeProvider(messages, PROVIDER_INFO[type]);
              return (
                <tr key={type}>
                  <td>{info.label}</td>
                  <td>{info.product}</td>
                  <td>
                    {type === 'aws'
                      ? 'clave IAM, rol recomendado'
                      : info.fields
                          .filter((f) => f.required)
                          .map((f) => f.label)
                          .join(', ')}
                  </td>
                  <td>{info.minTtl} s</td>
                  <td>
                    <Link href={`/admin/docs/${info.docs}`}>abrir</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>El principio, sea cual sea el proveedor</h2>
      <ol>
        <li>
          Cree en el proveedor credenciales <b>limitadas al DNS</b>, nunca las de su cuenta
          principal.
        </li>
        <li>
          <Link href="/admin/providers">Proveedores</Link> → <b>+ nuevo proveedor</b>: elija el
          proveedor, pegue las credenciales, pruebe y guarde.
        </li>
        <li>
          <Link href="/admin/domains">Dominios</Link> → <b>+ añadir un dominio</b>: local-cert
          lista las zonas de la cuenta, usted elige una y él prueba sus permisos.
        </li>
      </ol>
      <p>
        Es normal tener varios proveedores del mismo servicio: uno por cuenta, o uno por ámbito
        de permisos. Los secretos se cifran en la base de datos (AES-256-GCM con{' '}
        <code>MASTER_KEY</code>) y nunca se vuelven a mostrar ni los devuelve la API.
      </p>

      <h2>Lo que difiere de un proveedor a otro</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>AWS Route53</th>
              <th>Los demás</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Permisos</td>
              <td>por zona: una política IAM que hay que ampliar con cada dominio añadido</td>
              <td>los aportan las credenciales: nada que modificar al añadir un dominio</td>
            </tr>
            <tr>
              <td>Prueba de permisos</td>
              <td>sin ninguna escritura en la zona</td>
              <td>
                se crea y después se elimina un registro TXT temporal (
                <code>_localcert-preflight-…</code>)
              </td>
            </tr>
            <tr>
              <td>Escrituras</td>
              <td>atómicas, con seguimiento hasta la propagación</td>
              <td>registro a registro</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout title="TTL mínimo">
        Gandi (300 s) y GoDaddy (600 s) rechazan los TTL cortos. local-cert eleva entonces, sin
        avisar, el valor solicitado. Esto no impide la emisión (la validación lee directamente
        los servidores autoritativos), pero un registro <code>A</code> modificado tardará ese
        tiempo en verse en todas partes.
      </Callout>

      <h2>Marcado de lo que crea local-cert</h2>
      <p>
        Cada registro publicado a petición suya va acompañado de un TXT{' '}
        <code>_local-cert.&lt;nombre&gt;</code>: es lo que permite distinguir, dentro de la zona,
        lo que procede de local-cert de lo que ya existía. La variable <code>TAG_RECORDS=0</code>{' '}
        lo desactiva.
      </p>

      <h2>Declarar un proveedor mediante variables de entorno</h2>
      <p>
        Cuando las credenciales deben proceder del despliegue y no de la base de datos, un
        proveedor se declara mediante variables. Es opcional, y el bloque se repite con otra
        etiqueta para cada cuenta.
      </p>
      <CodeBlock
        title=".env"
        code={`# PROVIDER_<PROVEEDOR>_<ETIQUETA>_NAME declara el proveedor; el resto, sus credenciales
PROVIDER_AWS_DEFAULT_NAME="Default AWS"
PROVIDER_AWS_DEFAULT_ACCESS_KEY_ID=AKIA…
PROVIDER_AWS_DEFAULT_SECRET_ACCESS_KEY=…
PROVIDER_AWS_DEFAULT_ROLE_ARN=arn:aws:iam::123456789012:role/local-cert-dns

PROVIDER_OVH_PERSO_NAME="ovh-perso"
PROVIDER_OVH_PERSO_ENDPOINT=ovh-eu
PROVIDER_OVH_PERSO_APPLICATION_KEY=…
PROVIDER_OVH_PERSO_APPLICATION_SECRET=…
PROVIDER_OVH_PERSO_CONSUMER_KEY=…

PROVIDER_GANDI_MAIN_NAME="gandi"
PROVIDER_GANDI_MAIN_TOKEN=…

PROVIDER_GODADDY_MAIN_NAME="godaddy"
PROVIDER_GODADDY_MAIN_API_KEY=…
PROVIDER_GODADDY_MAIN_API_SECRET=…

PROVIDER_GCP_MAIN_NAME="gcp"
PROVIDER_GCP_MAIN_SERVICE_ACCOUNT_JSON=<el JSON de la clave, o su codificación base64>
PROVIDER_GCP_MAIN_PROJECT_ID=mi-proyecto   # opcional`}
      />
      <ul>
        <li>
          La etiqueta (<code>DEFAULT</code>, <code>PERSO</code>, <code>MAIN</code>…) es libre:
          letras mayúsculas, cifras y guiones bajos.
        </li>
        <li>
          Estos proveedores aparecen en la consola con la indicación <i>entorno</i>. Se pueden
          probar, pero no modificarlos ni retirarlos: eso se hace en las variables, seguido de un
          reinicio. Sus secretos nunca se escriben en la base de datos.
        </li>
        <li>
          Una declaración incompleta se ignora, con un mensaje al arrancar que nombra la variable
          que falta.
        </li>
      </ul>
    </>
  );
}
