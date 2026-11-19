import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout } from '../../_lib/prose';

const RIGHTS = `GET    /domain/zone
GET    /domain/zone/*
POST   /domain/zone/*
PUT    /domain/zone/*
DELETE /domain/zone/*`;

export default function Ovh() {
  return (
    <>
      <h1>Proveedor OVHcloud</h1>
      <p className="lead">
        local-cert gestiona las zonas DNS de OVHcloud a través de la API de OVH, con un juego de
        tres claves limitado al DNS.
      </p>

      <h2>1. Crear el token</h2>
      <p>
        OVH ofrece una página que crea las tres claves de una vez. Abra la de su región con la
        sesión iniciada en su cuenta:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cuenta</th>
              <th>Página de creación</th>
              <th>Valor de «Región de la API»</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Europa</td>
              <td>
                <code>https://eu.api.ovh.com/createToken/</code>
              </td>
              <td>
                <code>ovh-eu</code>
              </td>
            </tr>
            <tr>
              <td>Canadá</td>
              <td>
                <code>https://ca.api.ovh.com/createToken/</code>
              </td>
              <td>
                <code>ovh-ca</code>
              </td>
            </tr>
            <tr>
              <td>Estados Unidos</td>
              <td>
                <code>https://api.us.ovhcloud.com/createToken/</code>
              </td>
              <td>
                <code>ovh-us</code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <ol>
        <li>
          <b>Application name</b>: <code>local-cert</code>. Descripción libre.
        </li>
        <li>
          <b>Validity</b>: <b>Unlimited</b>. Un token de duración limitada dejaría de funcionar
          sin avisar, renovaciones incluidas.
        </li>
        <li>
          <b>Rights</b>: añada estas cinco líneas (el enlace que propone el asistente de
          local-cert las rellena de antemano):
        </li>
      </ol>
      <CodeBlock title="Permisos a conceder" code={RIGHTS} />
      <ol start={4}>
        <li>
          <b>Create keys</b>. La página muestra la <b>Application Key</b>, el{' '}
          <b>Application Secret</b> y la <b>Consumer Key</b>: anote las tres.
        </li>
      </ol>
      <Callout title="Limitar a una sola zona">
        Para dar acceso a un único dominio, sustituya <code>*</code> por su nombre en los
        permisos: <code>/domain/zone/example.com</code> y <code>/domain/zone/example.com/*</code>.
        Mantenga <code>GET /domain/zone</code>, que sirve para listar las zonas.
      </Callout>

      <h2>2. Crear el proveedor</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Proveedores</Link> → <b>+ nuevo proveedor</b> →{' '}
          <b>OVHcloud</b>.
        </li>
        <li>Elija la región, asigne un nombre y pegue las tres claves.</li>
        <li>
          <b>Probar la conexión</b>: local-cert lista sus zonas. Después, <b>Guardar</b>.
        </li>
      </ol>

      <h2>3. Añadir un dominio</h2>
      <p>
        <Link href="/admin/domains">Dominios</Link> → <b>+ añadir un dominio</b> → este proveedor
        → la zona. La prueba crea y después elimina un registro TXT temporal. No hace falta
        ningún ajuste adicional en OVH: los permisos son los del token.
      </p>

      <h2>Conviene saber</h2>
      <ul>
        <li>
          El dominio debe usar los <b>servidores DNS de OVH</b> (zona DNS activa en el área de
          cliente). Si sus servidores de nombres apuntan a otro sitio, es ese otro proveedor el
          que hay que declarar.
        </li>
        <li>
          OVH solo aplica un cambio tras un «refresco» de la zona; local-cert lo desencadena
          después de cada escritura. La propagación a los servidores secundarios puede tardar de
          uno a dos minutos: es el plazo normal de una emisión.
        </li>
        <li>TTL mínimo: 60 segundos.</li>
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
                <code>Invalid signature</code>
              </td>
              <td>Application Secret o Consumer Key mal copiados, o región equivocada.</td>
            </tr>
            <tr>
              <td>
                <code>This credential is not valid</code>
              </td>
              <td>Consumer Key caducada o revocada: cree un token nuevo con validez ilimitada.</td>
            </tr>
            <tr>
              <td>
                <code>This call has not been granted</code>
              </td>
              <td>Falta una línea en los permisos del token.</td>
            </tr>
            <tr>
              <td>
                <code>This application key is invalid</code>
              </td>
              <td>Application Key de otra región.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
