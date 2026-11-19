import Link from 'next/link';
import { Callout } from '../../_lib/prose';

export default function Gandi() {
  return (
    <>
      <h1>Proveedor Gandi</h1>
      <p className="lead">
        local-cert gestiona Gandi LiveDNS con un Personal Access Token, que se limita a los
        dominios y permisos estrictamente necesarios.
      </p>

      <h2>1. Crear el token</h2>
      <ol>
        <li>
          En Gandi: <b>Organizations</b> → la organización propietaria de los dominios →{' '}
          <b>Sharing</b> → <b>Personal Access Tokens</b> → <b>Create a token</b>. Dirección
          directa: <code>https://admin.gandi.net/organizations/account/pat</code>.
        </li>
        <li>
          <b>Nombre</b>: <code>local-cert</code>. <b>Caducidad</b>: la más larga que esté dispuesto
          a aceptar; al vencer, las emisiones y renovaciones se detienen.
        </li>
        <li>
          <b>Recursos</b>: restrinja a los dominios que local-cert deba gestionar.
        </li>
        <li>
          <b>Permisos</b>: marque <b>Manage domain technical configurations</b>. Los permisos de
          lectura asociados se marcan automáticamente.
        </li>
        <li>
          <b>Create</b> y copie el token: solo se muestra una vez.
        </li>
      </ol>
      <Callout kind="warn" title="No la antigua clave de API">
        Las antiguas «claves de API» de Gandi (cabecera <code>Apikey</code>) están obsoletas y no
        son compatibles: se necesita un Personal Access Token.
      </Callout>

      <h2>2. Crear el proveedor</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Proveedores</Link> → <b>+ nuevo proveedor</b> →{' '}
          <b>Gandi</b>.
        </li>
        <li>Asigne un nombre y pegue el token.</li>
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
          El dominio debe usar <b>LiveDNS</b> (servidores <code>ns-*.gandi.net</code>). Un dominio
          registrado en Gandi pero servido por servidores de nombres externos no aparece en la
          lista.
        </li>
        <li>
          <b>TTL mínimo: 300 segundos.</b> local-cert eleva cualquier valor inferior. No afecta a
          la emisión de los certificados.
        </li>
        <li>
          Para cambiar de token cuando se acerca su caducidad:{' '}
          <Link href="/admin/providers">Proveedores</Link> → <b>modificar</b>, pegue el nuevo,{' '}
          <b>Probar</b>, <b>Guardar</b>.
        </li>
      </ul>

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
                <code>401</code>
              </td>
              <td>Token mal copiado, caducado o eliminado.</td>
            </tr>
            <tr>
              <td>
                <code>403</code>
              </td>
              <td>
                El token no tiene el permiso de configuración técnica, o el dominio no está entre
                sus recursos.
              </td>
            </tr>
            <tr>
              <td>La lista de zonas está vacía</td>
              <td>Ningún dominio del ámbito del token utiliza LiveDNS.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
