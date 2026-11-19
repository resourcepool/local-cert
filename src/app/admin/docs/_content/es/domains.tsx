import Link from 'next/link';
import { Callout } from '../../_lib/prose';

export default function Domains() {
  return (
    <>
      <h1>Añadir un dominio</h1>
      <p className="lead">
        Un dominio gestionado es un nombre base (<code>home.example.com</code>) bajo el cual
        local-cert tiene permiso para emitir. Se apoya en una zona alojada de un proveedor. El
        asistente de la página <Link href="/admin/domains">Dominios</Link> lo hace todo en tres
        pantallas.
      </p>

      <h2>Antes de empezar</h2>
      <ul>
        <li>
          Un <Link href="/admin/docs/providers">proveedor</Link> registrado cuya prueba esté en
          verde.
        </li>
        <li>
          Una zona <b>pública</b> en ese proveedor, que sea autoritativa para el nombre. Let&apos;s
          Encrypt debe poder leer el registro de validación desde Internet: una zona privada no
          sirve, aunque sus hosts sigan siendo privados.
        </li>
      </ul>
      <Callout title="Dedicar una zona a la LAN">
        No es necesario abrir su zona principal. Cree una zona Route53 para{' '}
        <code>home.example.com</code> y delegúela desde <code>example.com</code> con cuatro
        registros <code>NS</code>: local-cert solo tendrá permisos sobre ese subdominio, sea cual
        sea el proveedor de la zona padre.
      </Callout>

      <h2>1. Elegir el proveedor</h2>
      <p>
        <b>+ añadir un dominio</b> y seleccione el proveedor. local-cert consulta la cuenta y
        muestra el número de zonas visibles.
      </p>

      <h2>2. Elegir la zona</h2>
      <p>
        Las zonas de la cuenta se listan con su identificador. Una zona privada aparece
        atenuada. Si una zona ya tiene un dominio gestionado, se indica.
      </p>
      <ul>
        <li>
          <b>Nombre base</b>: por defecto, el nombre de la zona. Se puede restringir a un
          subdominio (<code>lab.home.example.com</code> en la zona <code>home.example.com</code>):
          solo los nombres situados por debajo podrán recibir un certificado.
        </li>
        <li>
          <b>TTL por defecto</b>: duración de vida de los registros que publica local-cert. 60
          segundos es un valor adecuado.
        </li>
      </ul>

      <h2>3. Conceder los permisos, probar, añadir</h2>
      <p>
        local-cert prueba de inmediato sus permisos sobre la zona. Si ya los tiene, solo queda
        confirmar. Si no, la pantalla indica qué hacer:
      </p>
      <ol>
        <li>
          En la consola de AWS, abra el rol (o el usuario) indicado → pestaña <b>Permissions</b>.
        </li>
        <li>
          Haga clic en la política <b>ya existente</b>, <code>local-cert-route53</code> (la creada
          con el proveedor) y después en <b>Edit</b> → pestaña <b>JSON</b>. No añada una segunda
          política: es esta la que se va ampliando.
        </li>
        <li>
          Sustituya todo el contenido por el documento mostrado y pulse <b>Next</b> →{' '}
          <b>Save changes</b>. Contiene las zonas ya declaradas en este proveedor <b>más</b> la
          nueva: no se elimina nada.
        </li>
        <li>
          Vuelva al asistente y haga clic en <b>Volver a probar</b>.
        </li>
        <li>
          Cuando todas las líneas requeridas estén en <code>OK</code>, pulse{' '}
          <b>Añadir el dominio</b>.
        </li>
      </ol>

      <h3>Añadir sin esperar: el estado «pending»</h3>
      <p>
        Un proveedor puede tardar unos minutos en aplicar un cambio de permisos. En lugar de
        volver a probar a mano, añada el dominio aunque la prueba siga fallando (botón{' '}
        <b>Añadir como pendiente</b>):
      </p>
      <ul>
        <li>
          el dominio queda en <b>pending</b>: local-cert repite la prueba cada minuto, cinco
          veces, y lo pasa a <b>active</b> en cuanto tiene éxito;
        </li>
        <li>
          tras cinco fallos pasa a <b>error</b>, mostrando la última denegación. Corrija los
          permisos y haga clic en <b>reintentar la verificación</b>: se inicia un nuevo ciclo;
        </li>
        <li>
          mientras no esté activo, el dominio no recibe certificados ni registros: la API
          responde <code>409</code> y el servidor ACME <code>rejectedIdentifier</code>.
        </li>
      </ul>

      <Callout title="Fuera de AWS, este paso es más corto">
        En OVHcloud, Gandi, GoDaddy y Google Cloud, los permisos los aportan las credenciales del
        proveedor: no hay ninguna política que pegar, solo la prueba. Esta crea y después elimina
        un registro TXT temporal en la zona. Los pasos anteriores y la tabla siguiente describen
        el caso de AWS.
      </Callout>

      <h3>Qué comprueba la prueba</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Llamada</th>
              <th>Requerida</th>
              <th>Para qué sirve</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>ListResourceRecordSets</code>
              </td>
              <td>sí</td>
              <td>leer la zona y comprobar que cubre el nombre base</td>
            </tr>
            <tr>
              <td>
                <code>GetHostedZone</code>
              </td>
              <td>sí</td>
              <td>encontrar los servidores de nombres a consultar durante la validación</td>
            </tr>
            <tr>
              <td>
                <code>GetChange</code>
              </td>
              <td>sí</td>
              <td>esperar la propagación de una escritura</td>
            </tr>
            <tr>
              <td>
                <code>ChangeResourceRecordSets</code> (TXT)
              </td>
              <td>sí</td>
              <td>escribir el registro de validación</td>
            </tr>
            <tr>
              <td>
                <code>ChangeResourceRecordSets</code> (A)
              </td>
              <td>no</td>
              <td>publicar la dirección de un host, si se solicita al emitir</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        El permiso de escritura se sondea eliminando un registro que no existe: AWS comprueba la
        autorización antes de constatar que no hay nada que eliminar.{' '}
        <b>La prueba nunca modifica la zona.</b>
      </p>

      <h3>Si la prueba sigue en rojo</h3>
      <ul>
        <li>
          Espere unos segundos y vuelva a probar: IAM no propaga los cambios al instante.
        </li>
        <li>
          Compruebe que la política se ha pegado en la identidad indicada, y no en el usuario
          cuando el proveedor pasa por un rol.
        </li>
        <li>
          Si todas las líneas fallan con el mismo mensaje, el problema es el propio proveedor:
          botón <b>probar</b> en <Link href="/admin/providers">Proveedores</Link>.
        </li>
        <li>
          Si existe un registro <code>CAA</code> en la zona, debe autorizar{' '}
          <code>letsencrypt.org</code>: la prueba no lo comprueba, pero la emisión fallará.
        </li>
      </ul>
      <p>
        <b>Añadir de todos modos</b> registra un dominio cuya prueba falla. Resulta útil para
        preparar una configuración; ninguna emisión se completará mientras falten los permisos.
      </p>

      <h2>A continuación</h2>
      <ul>
        <li>
          Conceda acceso al dominio en <Link href="/admin/keys">Claves y permisos</Link>: una
          clave de API con sus permisos, o una credencial EAB para un cliente ACME.
        </li>
        <li>
          Emita un primer certificado: <Link href="/admin/docs">Inicio rápido</Link>.
        </li>
      </ul>

      <h2>Retirar un dominio</h2>
      <p>
        <b>retirar</b> se rechaza mientras existan certificados. <b>forzar</b> los revoca, limpia
        la zona en la medida de lo posible y después lo elimina todo. Recuerde luego regenerar la
        política del proveedor (botón <b>política</b>) y volver a pegarla en AWS: la zona retirada
        ya no figura en ella.
      </p>
    </>
  );
}
