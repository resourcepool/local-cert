import Link from 'next/link';
import { Callout } from '../../_lib/prose';

export default function GoDaddy() {
  return (
    <>
      <h1>Proveedor GoDaddy</h1>
      <p className="lead">
        local-cert gestiona el DNS de GoDaddy con una clave de API de producción. Compruebe antes
        que su cuenta tiene derecho a ello: GoDaddy no lo habilita para todos.
      </p>

      <Callout kind="warn" title="Condición de acceso a la API">
        GoDaddy reserva sus API de gestión de dominios y de DNS a las cuentas que tienen al menos
        diez dominios, o una suscripción a Discount Domain Club. Por debajo de ese umbral, la
        clave se crea con normalidad, pero cada llamada responde <code>403 ACCESS_DENIED</code>.
        Si es su caso, la solución duradera es delegar el subdominio afectado a un proveedor de
        DNS compatible; véase el final de la página.
      </Callout>

      <h2>1. Crear la clave</h2>
      <ol>
        <li>
          Abra <code>https://developer.godaddy.com/keys</code>, con la sesión iniciada en la cuenta
          que posee los dominios.
        </li>
        <li>
          <b>Create New API Key</b>. Nombre: <code>local-cert</code>. Entorno: <b>Production</b>{' '}
          (una clave <i>OTE</i> no ve sus dominios reales).
        </li>
        <li>
          Copie la <b>Key</b> y el <b>Secret</b>: el secreto solo se muestra una vez.
        </li>
      </ol>
      <p>
        Una clave de GoDaddy da acceso a toda la cuenta: no existe restricción por dominio ni por
        tipo de operación.
      </p>

      <h2>2. Crear el proveedor</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Proveedores</Link> → <b>+ nuevo proveedor</b> →{' '}
          <b>GoDaddy</b>.
        </li>
        <li>Asigne un nombre y pegue la clave y el secreto.</li>
        <li>
          <b>Probar la conexión</b> y después <b>Guardar</b>.
        </li>
      </ol>

      <h2>3. Añadir un dominio</h2>
      <p>
        <Link href="/admin/domains">Dominios</Link> → <b>+ añadir un dominio</b> → este proveedor
        → el dominio. La prueba crea y después elimina un registro TXT temporal.
      </p>

      <h2>Conviene saber</h2>
      <ul>
        <li>
          El dominio debe usar los servidores de nombres de GoDaddy (
          <code>ns*.domaincontrol.com</code>).
        </li>
        <li>
          <b>TTL mínimo: 600 segundos.</b> local-cert eleva cualquier valor inferior. No afecta a
          la emisión de los certificados.
        </li>
      </ul>

      <h2>Si su cuenta no tiene acceso a la API</h2>
      <p>
        Mantenga el dominio en GoDaddy y delegue únicamente el subdominio de su red local a un
        proveedor que local-cert sepa gestionar:
      </p>
      <ol>
        <li>
          Cree una zona <code>home.example.com</code> en AWS Route53, OVHcloud, Gandi o Google
          Cloud DNS.
        </li>
        <li>
          En el DNS de GoDaddy de <code>example.com</code>, añada un registro <code>NS</code> por
          cada servidor de nombres de esa zona, con el nombre <code>home</code>.
        </li>
        <li>Declare el proveedor correspondiente y añada el dominio delegado.</li>
      </ol>

      <h2>Solución de problemas</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mensaje</th>
              <th>Causa</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>401 UNABLE_TO_AUTHENTICATE</code>
              </td>
              <td>Clave o secreto incorrectos, o clave OTE usada en producción.</td>
            </tr>
            <tr>
              <td>
                <code>403 ACCESS_DENIED</code>
              </td>
              <td>La cuenta no cumple la condición de acceso a la API.</td>
            </tr>
            <tr>
              <td>
                <code>422</code> al escribir
              </td>
              <td>Valor rechazado por GoDaddy (TTL, formato): el mensaje indica el campo.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
