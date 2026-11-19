import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import {
  PLACEHOLDER_ROLE_ARN,
  PLACEHOLDER_USER_ARN,
  assumePolicy,
  permissionsPolicy,
  trustPolicy,
} from '@/lib/dns/aws-policy';
import { Callout } from '../../_lib/prose';

const json = (doc: unknown) => JSON.stringify(doc, null, 2);
const EXAMPLE = { userArn: PLACEHOLDER_USER_ARN, roleArn: PLACEHOLDER_ROLE_ARN };

export default function AwsProvider() {
  return (
    <>
      <h1>Proveedor AWS</h1>
      <p className="lead">
        Un proveedor es una identidad en una cuenta de AWS que local-cert utiliza para leer y
        escribir en Route53. Se crea uno por cuenta (<code>aws-prod</code>,{' '}
        <code>aws-lab</code>) y después se declaran sus dominios sobre él.
      </p>

      <h2>El modelo</h2>
      <p>Tres objetos en AWS, cada uno con una función precisa:</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Objeto</th>
              <th>Función</th>
              <th>Qué contiene</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Usuario IAM</td>
              <td>la identidad de local-cert</td>
              <td>un par de claves y nada más</td>
            </tr>
            <tr>
              <td>Rol IAM</td>
              <td>lo que local-cert tiene permitido hacer</td>
              <td>la política de Route53, que usted va ampliando</td>
            </tr>
            <tr>
              <td>Política del rol</td>
              <td>la lista de zonas autorizadas</td>
              <td>generada por local-cert, pegada por usted</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Así, la clave almacenada en local-cert no concede ningún permiso por sí misma: solo
        permite asumir el rol. Añadir una zona consiste en modificar la política del rol; la clave
        no cambia nunca.
      </p>
      <p>
        El asistente de la página <Link href="/admin/providers">Proveedores</Link> recorre estos
        pasos y genera cada documento con sus identificadores reales. Esta guía los detalla.
      </p>

      <h2>1. Crear el usuario IAM</h2>
      <ol>
        <li>
          Consola de AWS → <b>IAM</b> → <b>Users</b> → <b>Create user</b>.
        </li>
        <li>
          Nombre: <code>local-cert</code>. Deje sin marcar{' '}
          <i>Provide user access to the AWS Management Console</i>.
        </li>
        <li>
          En el paso de permisos: <b>no asocie nada</b>. Termine la creación.
        </li>
        <li>
          Abra el usuario → <b>Security credentials</b> → <b>Create access key</b> → caso de uso{' '}
          <i>Application running outside AWS</i>.
        </li>
        <li>
          Anote el <b>Access key ID</b> y la <b>Secret access key</b>: la segunda no se puede
          volver a consultar después.
        </li>
      </ol>

      <h2>2. Introducir la clave en local-cert</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Proveedores</Link> → <b>+ nuevo proveedor</b>.
        </li>
        <li>
          Asigne un nombre (<code>aws-prod</code>) y pegue el par de claves.
        </li>
        <li>
          <b>Verificar la clave</b>: local-cert llama a <code>sts:GetCallerIdentity</code>, que no
          requiere ningún permiso, y muestra el ARN del usuario. Ese ARN es el que sirve para
          generar lo siguiente.
        </li>
      </ol>
      <p>
        La clave secreta se cifra en la base de datos (AES-256-GCM con <code>MASTER_KEY</code>) y
        nunca se vuelve a mostrar ni la devuelve la API.
      </p>

      <h2>3. Crear el rol</h2>
      <ol>
        <li>
          <b>IAM</b> → <b>Roles</b> → <b>Create role</b> → <b>Custom trust policy</b>.
        </li>
        <li>
          Pegue la <b>política de confianza</b> que muestra el asistente. Solo autoriza a su
          usuario a asumir el rol:
        </li>
      </ol>
      <CodeBlock title="Política de confianza (ejemplo)" code={json(trustPolicy(PLACEHOLDER_USER_ARN))} />
      <ol start={3}>
        <li>
          En el paso de permisos: no añada ninguna política administrada.
        </li>
        <li>
          Nombre del rol: <code>local-cert-dns</code>. Créelo.
        </li>
        <li>
          Abra el rol → <b>Permissions</b> → <b>Add permissions</b> →{' '}
          <b>Create inline policy</b> → pestaña <b>JSON</b>, y pegue la{' '}
          <b>política de permisos</b> del asistente. En este punto solo contiene lo necesario para
          listar las zonas:
        </li>
      </ol>
      <CodeBlock title="Política de permisos inicial" code={json(permissionsPolicy([], EXAMPLE))} />
      <ol start={6}>
        <li>
          Ponga nombre a la política (<code>local-cert-route53</code>), guárdela y copie el{' '}
          <b>ARN del rol</b> en el asistente.
        </li>
      </ol>

      <h2>4. Probar y guardar</h2>
      <p>
        <b>Probar la conexión</b> encadena tres comprobaciones, cada una dependiente de la
        anterior:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Comprobación</th>
              <th>En caso de fallo</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Par de claves</td>
              <td>clave desconocida, desactivada o mal copiada</td>
            </tr>
            <tr>
              <td>Rol (AssumeRole)</td>
              <td>
                ARN del rol incorrecto, o política de confianza que no nombra al usuario correcto
              </td>
            </tr>
            <tr>
              <td>Zonas (ListHostedZones)</td>
              <td>política de permisos ausente del rol, o aún no propagada</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        IAM aplica un cambio en unos segundos: una prueba lanzada justo después de pegar puede
        fallar una vez. Cuando las tres líneas estén en <code>OK</code>, pulse{' '}
        <b>Guardar</b>.
      </p>

      <h2>5. Añadir dominios</h2>
      <p>
        El proveedor ya sabe listar sus zonas, pero todavía no tiene permiso para escribir en
        ninguna. Esos permisos se añaden zona por zona:{' '}
        <Link href="/admin/docs/domains">Añadir un dominio</Link>. Una vez declaradas algunas
        zonas, la política del rol tiene este aspecto:
      </p>
      <CodeBlock
        title="Política de permisos con dos zonas (ejemplo)"
        code={json(permissionsPolicy(['Z0123456ABCDEFGHIJK', 'Z0987654ZYXWVUTSRQP'], EXAMPLE))}
      />
      <p>
        El botón <b>política</b> de cada proveedor regenera este documento en cualquier momento a
        partir de los dominios realmente declarados.
      </p>

      <h2>Qué autoriza la política</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Acción</th>
              <th>Alcance</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>ListHostedZones</code>
              </td>
              <td>cuenta</td>
              <td>ofrecer la lista de zonas; AWS no permite restringirla</td>
            </tr>
            <tr>
              <td>
                <code>GetChange</code>
              </td>
              <td>cuenta</td>
              <td>esperar a que una escritura se propague</td>
            </tr>
            <tr>
              <td>
                <code>GetHostedZone</code>, <code>ListResourceRecordSets</code>
              </td>
              <td>zonas declaradas</td>
              <td>
                conocer los servidores de nombres a consultar y listar los registros
              </td>
            </tr>
            <tr>
              <td>
                <code>ChangeResourceRecordSets</code>
              </td>
              <td>zonas declaradas, tipos TXT / A / AAAA, acciones UPSERT / DELETE</td>
              <td>
                escribir el TXT de validación; publicar la dirección de un host si usted lo
                solicita
              </td>
            </tr>
            <tr>
              <td>
                <code>iam:ListAccessKeys</code>, <code>DeleteAccessKey</code>,{' '}
                <code>ListUserPolicies</code>, <code>DeleteUserPolicy</code>,{' '}
                <code>DeleteUser</code>
              </td>
              <td>el usuario IAM del proveedor, y solo él</td>
              <td>
                opcional: eliminarlo al retirar el proveedor (
                <a href="#nettoyage">limpieza</a>)
              </td>
            </tr>
            <tr>
              <td>
                <code>iam:ListRolePolicies</code>, <code>DeleteRolePolicy</code>
              </td>
              <td>el rol del proveedor, y solo él</td>
              <td>opcional: vaciar el rol al retirar el proveedor</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout kind="warn" title="Si modifica la política a mano">
        Dos errores producen un <code>AccessDenied</code> difícil de interpretar: quitar{' '}
        <code>TXT</code> de los tipos autorizados (ya no sería posible emitir nada) y escribir dos
        bloques <code>Condition</code> con el mismo operador (el JSON solo conserva el último). Lo
        más seguro es volver a pegar el documento generado completo.
      </Callout>

      <h2>Varias cuentas de AWS</h2>
      <p>Hay dos formas de cubrir una segunda cuenta, según lo que se quiera aislar.</p>
      <h3>Un proveedor por cuenta</h3>
      <p>
        Repita los pasos 1 a 4 en la otra cuenta y dé al proveedor el nombre correspondiente. Cada
        cuenta tiene su propia clave; revocar una no afecta a la otra. Es la configuración más
        fácil de razonar.
      </p>
      <h3>Una sola clave, un rol por cuenta</h3>
      <p>
        El usuario permanece en la cuenta A; el rol se crea en la cuenta B, con la misma política
        de confianza (el ARN del usuario de la cuenta A). Entre cuentas, el usuario debe además
        tener permiso para asumir ese rol. Asocie a su usuario esta política inline:
      </p>
      <CodeBlock
        title="Política del usuario, caso entre cuentas"
        code={json(assumePolicy(PLACEHOLDER_ROLE_ARN))}
      />
      <p>
        Cree después un segundo proveedor con el mismo par de claves y el ARN del rol de la
        cuenta B.
      </p>

      <h2>Variantes</h2>
      <h3>Sin rol</h3>
      <p>
        Desmarque <i>Usar un rol IAM</i> en el asistente: la política de permisos se pega
        entonces directamente en el usuario. Es un paso menos, a costa de que la propia clave
        lleve los permisos.
      </p>
      <h3>Sin clave</h3>
      <p>
        Si local-cert se ejecuta en AWS o en un clúster con IRSA, marque <i>Sin clave</i>: el
        proveedor utiliza las credenciales del proceso (rol de instancia, rol de pod, variables de
        entorno). Aun así, se puede asumir un rol adicional encima.
      </p>

      <h2>Declarar un proveedor mediante variables de entorno</h2>
      <p>
        Cuando las credenciales deben proceder del despliegue y no de la base de datos (secretos
        gestionados por el orquestador, infraestructura descrita como código), un proveedor se
        declara mediante variables. Todo es opcional: sin ninguna variable, los proveedores se
        gestionan únicamente desde la consola.
      </p>
      <CodeBlock
        title=".env"
        code={`PROVIDER_AWS_DEFAULT_NAME="Default AWS"
PROVIDER_AWS_DEFAULT_ACCESS_KEY_ID=AKIA…
PROVIDER_AWS_DEFAULT_SECRET_ACCESS_KEY=…
PROVIDER_AWS_DEFAULT_ROLE_ARN=arn:aws:iam::123456789012:role/local-cert-dns

# una segunda cuenta: mismo bloque, otra etiqueta
PROVIDER_AWS_PROD_NAME="aws-prod"
PROVIDER_AWS_PROD_ACCESS_KEY_ID=AKIA…
PROVIDER_AWS_PROD_SECRET_ACCESS_KEY=…`}
      />
      <ul>
        <li>
          <code>_NAME</code> declara el proveedor; es la única variable obligatoria del bloque. La
          etiqueta (<code>DEFAULT</code>, <code>PROD</code>…) es libre.
        </li>
        <li>
          Sin par de claves, el proveedor utiliza las credenciales del proceso.{' '}
          <code>_ROLE_ARN</code> y <code>_REGION</code> son opcionales.
        </li>
        <li>
          Estos proveedores aparecen en la consola con la indicación <i>entorno</i>. Se pueden
          probar y generar su política, pero no modificarlos ni retirarlos: eso se hace en las
          variables, seguido de un reinicio. Su clave secreta nunca se escribe en la base de
          datos.
        </li>
        <li>
          La etiqueta <code>DEFAULT</code> tiene una particularidad: los dominios declarados antes
          de la llegada de los proveedores se asocian a ella al arrancar.
        </li>
      </ul>

      <h2 id="nettoyage">Retirar un proveedor y limpiar AWS</h2>
      <p>
        <Link href="/admin/providers">Proveedores</Link> → <b>retirar</b> elimina el proveedor de
        local-cert. Si se marca <b>Limpiar también en AWS</b>, el proveedor deshace primero lo que
        el asistente le hizo crear:
      </p>
      <ol>
        <li>
          la sesión del rol elimina el usuario IAM: sus claves de acceso, sus políticas inline y,
          por último, el usuario;
        </li>
        <li>después elimina la política del propio rol.</li>
      </ol>
      <p>
        IAM no permite que una identidad se elimine por completo: un rol solo se puede eliminar
        una vez vaciado de políticas, y es de ellas de donde procede el permiso para hacerlo.
        Queda, por tanto, el rol <code>local-cert-dns</code>, sin ningún permiso y que ya nadie
        puede asumir. La consola muestra el comando para eliminarlo con una cuenta de
        administrador:
      </p>
      <CodeBlock title="AWS CLI" code="aws iam delete-role --role-name local-cert-dns" />
      <ul>
        <li>
          Sin rol, el proveedor solo puede eliminar su propia clave de acceso; el usuario permanece,
          sin credenciales.
        </li>
        <li>
          Los permisos correspondientes son los bloques <code>LocalCertRemove…</code> de la
          política generada. Solo se refieren al usuario y al rol del proveedor y únicamente
          permiten eliminar: una clave robada podría desactivar local-cert, pero no ampliar sus
          permisos. Quítelos del documento si no desea esta opción.
        </li>
        <li>
          Un proveedor creado antes de esta opción debe recibir primero la política actualizada
          (botón <b>política</b>). Si AWS rechaza la operación antes de eliminar nada, el
          proveedor se conserva.
        </li>
        <li>
          La opción no se ofrece cuando otro proveedor utiliza el mismo usuario o el mismo rol,
          ni para los proveedores declarados mediante variables de entorno.
        </li>
        <li>
          Si el usuario tiene políticas administradas asociadas o pertenece a un grupo, IAM
          rechaza su eliminación: la limpieza se detiene ahí y enumera lo que queda por hacer.
        </li>
      </ul>

      <h2>Rotación de la clave</h2>
      <ol>
        <li>
          En IAM, cree una <b>segunda</b> clave de acceso para el usuario.
        </li>
        <li>
          <Link href="/admin/providers">Proveedores</Link> → <b>modificar</b> →{' '}
          <i>Sustituir el par de claves</i> → <b>Probar</b> y, después, <b>Guardar</b>.
        </li>
        <li>En IAM, desactive la clave anterior y, a continuación, elimínela.</li>
      </ol>
      <p>El rol y su política no se ven afectados.</p>
    </>
  );
}
