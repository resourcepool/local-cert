import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Synology({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Synology DSM</h1>
      <p className="lead">
        El asistente de certificados de DSM solo conoce Let&apos;s Encrypt y exige que el NAS sea
        accesible desde Internet. acme.sh, instalado en el NAS, obtiene el certificado de
        local-cert y lo instala en DSM con su hook <code>synology_dsm</code>.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Preparar el NAS</h2>
      <ol>
        <li>
          <b>Panel de control</b> → <b>Terminal y SNMP</b> → active SSH.
        </li>
        <li>
          Conéctese por SSH con una cuenta de administrador y ejecute <code>sudo -i</code>.
        </li>
      </ol>
      <CodeBlock
        title="instalar acme.sh fuera del volumen del sistema"
        code={`mkdir -p /usr/local/share/acme.sh/webroot
cd /tmp && wget -O acme.sh.tar.gz https://github.com/acmesh-official/acme.sh/archive/master.tar.gz
tar xzf acme.sh.tar.gz && cd acme.sh-master
./acme.sh --install --nocron --home /usr/local/share/acme.sh -m ${EX.email}
cd /usr/local/share/acme.sh`}
      />

      <h2>2. Cuenta y emisión</h2>
      <CodeBlock
        title="acme.sh"
        code={`./acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac}

./acme.sh --issue --server ${ctx.directory} \\
  -d ${EX.host} -w /usr/local/share/acme.sh/webroot`}
      />
      <p>
        La carpeta webroot permanece vacía y nada la sirve: local-cert no va a leer el desafío. El
        NAS no necesita abrir ningún puerto.
      </p>

      <h2>3. Instalar en DSM</h2>
      <CodeBlock
        title="acme.sh — hook synology_dsm"
        code={`export SYNO_SCHEME=http
export SYNO_HOSTNAME=localhost
export SYNO_PORT=5000
export SYNO_USERNAME='una-cuenta-admin'
export SYNO_PASSWORD='su-contraseña'
export SYNO_CERTIFICATE='local-cert'   # descripción del certificado en DSM
export SYNO_CREATE=1                    # crearlo si no existe

./acme.sh --deploy -d ${EX.host} --deploy-hook synology_dsm`}
      />
      <p>
        El certificado aparece en <b>Panel de control</b> → <b>Seguridad</b> → <b>Certificado</b>.
        Asígnelo a los servicios deseados con <b>Configuración</b>.
      </p>
      <Callout kind="warn" title="Cuenta y verificación en dos pasos">
        El hook se conecta a DSM con esa cuenta. Cree un administrador dedicado, sin verificación
        en dos pasos, o utilice las variables previstas para el OTP en las versiones recientes de
        acme.sh. Los nombres de las variables han cambiado a lo largo de las versiones (
        <code>SYNO_Username</code> → <code>SYNO_USERNAME</code>): si el hook no las reconoce,
        consulte la cabecera de <code>deploy/synology_dsm.sh</code>.
      </Callout>

      <h2>4. Renovación</h2>
      <p>
        <b>Panel de control</b> → <b>Programador de tareas</b> → <b>Crear</b> →{' '}
        <b>Tarea programada</b> → <b>Script definido por el usuario</b>, usuario{' '}
        <code>root</code>, todos los días:
      </p>
      <CodeBlock
        title="script"
        code={`/usr/local/share/acme.sh/acme.sh --cron --home /usr/local/share/acme.sh`}
      />
      <p>
        acme.sh solo renueva cuando se acerca el vencimiento y después repite el despliegue en DSM
        con los ajustes memorizados.
      </p>
    </>
  );
}
