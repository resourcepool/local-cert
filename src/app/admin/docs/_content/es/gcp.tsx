import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout } from '../../_lib/prose';

export default function Gcp() {
  return (
    <>
      <h1>Proveedor Google Cloud</h1>
      <p className="lead">
        local-cert gestiona Cloud DNS como cuenta de servicio, a partir de su clave JSON. Un
        proveedor corresponde a un proyecto de Google Cloud.
      </p>

      <h2>Antes de empezar</h2>
      <ul>
        <li>
          La API de <b>Cloud DNS</b> está habilitada en el proyecto (<b>APIs y servicios</b> →{' '}
          <b>Biblioteca</b> → Cloud DNS API).
        </li>
        <li>
          La zona es <b>pública</b>. Una zona privada es invisible para Let&apos;s Encrypt.
        </li>
      </ul>

      <h2>1. Crear la cuenta de servicio</h2>
      <ol>
        <li>
          Consola de Google Cloud, proyecto que contiene sus zonas → <b>IAM y administración</b>{' '}
          → <b>Cuentas de servicio</b> → <b>Crear cuenta de servicio</b>.
        </li>
        <li>
          <b>Nombre</b>: <code>local-cert-dns</code>. <b>Crear y continuar</b>.
        </li>
        <li>
          <b>Rol</b>: <b>Administrador de DNS</b> (<code>roles/dns.admin</code>).{' '}
          <b>Continuar</b> y después <b>Listo</b>.
        </li>
      </ol>
      <p>O mediante la línea de comandos:</p>
      <CodeBlock
        title="gcloud"
        code={`PROJECT=mi-proyecto
gcloud iam service-accounts create local-cert-dns --project "$PROJECT"
gcloud projects add-iam-policy-binding "$PROJECT" \\
  --member "serviceAccount:local-cert-dns@$PROJECT.iam.gserviceaccount.com" \\
  --role roles/dns.admin`}
      />

      <h2>2. Crear la clave JSON</h2>
      <ol>
        <li>
          Abra la cuenta de servicio → pestaña <b>Claves</b> → <b>Agregar clave</b> →{' '}
          <b>Crear clave nueva</b> → <b>JSON</b>.
        </li>
        <li>Se descarga un archivo <code>.json</code>: es el único ejemplar.</li>
      </ol>
      <CodeBlock
        title="gcloud"
        code={`gcloud iam service-accounts keys create local-cert-dns.json \\
  --iam-account "local-cert-dns@$PROJECT.iam.gserviceaccount.com"`}
      />
      <Callout title="¿Creación de claves bloqueada?">
        Algunas organizaciones prohíben las claves de cuenta de servicio (restricción{' '}
        <code>iam.disableServiceAccountKeyCreation</code>). En ese caso, un administrador de la
        organización debe levantarla para este proyecto.
      </Callout>

      <h2>3. Crear el proveedor</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Proveedores</Link> → <b>+ nuevo proveedor</b> →{' '}
          <b>Google Cloud</b>.
        </li>
        <li>
          Asigne un nombre y pegue <b>todo el contenido</b> del archivo JSON. El ID del proyecto
          se lee de la clave; indíquelo solo si las zonas están en otro proyecto.
        </li>
        <li>
          <b>Probar la conexión</b> y después <b>Guardar</b>. Elimine a continuación el archivo
          descargado.
        </li>
      </ol>

      <h2>4. Añadir un dominio</h2>
      <p>
        <Link href="/admin/domains">Dominios</Link> → <b>+ añadir un dominio</b> → este proveedor
        → la zona. La prueba crea y después elimina un registro TXT temporal.
      </p>

      <h2>Conviene saber</h2>
      <ul>
        <li>
          El rol <code>roles/dns.admin</code> abarca todas las zonas del proyecto. Para aislar una
          zona, colóquela en un proyecto dedicado, o conceda el rol a nivel de zona en lugar de a
          nivel de proyecto (IAM de la zona gestionada), manteniendo para la cuenta{' '}
          <code>roles/dns.reader</code> en el proyecto para poder listar.
        </li>
        <li>
          El dominio debe estar delegado a los servidores de nombres que Cloud DNS indica para la
          zona (<code>ns-cloud-*.googledomains.com</code>).
        </li>
        <li>
          Varios proyectos: un proveedor por proyecto, cada uno con su cuenta de servicio, o una
          sola cuenta de servicio a la que cada proyecto conceda el rol, declarada en tantos
          proveedores como proyectos, con <b>ID de proyecto</b> distintos.
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
                <code>invalid_grant</code>
              </td>
              <td>Clave eliminada o cuenta de servicio desactivada; reloj del servidor desajustado.</td>
            </tr>
            <tr>
              <td>
                <code>403 … Cloud DNS API has not been used</code>
              </td>
              <td>La API de Cloud DNS no está habilitada en el proyecto.</td>
            </tr>
            <tr>
              <td>
                <code>403 Forbidden</code>
              </td>
              <td>La cuenta de servicio no tiene el rol de DNS en este proyecto.</td>
            </tr>
            <tr>
              <td>
                <code>The service account key is not valid JSON</code>
              </td>
              <td>El archivo se pegó de forma parcial.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
