import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EabValues, type DocCtx } from '../../_lib/prose';

export default function Acme({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Serveur ACME</h1>
      <p className="lead">
        local-cert expose un point d&apos;entrée ACME (RFC 8555) sur <code>/acme/directory</code>.
        Tout outil qui sait demander un certificat à Let&apos;s Encrypt peut le demander à
        local-cert à la place, pour des hôtes que Let&apos;s Encrypt ne pourrait jamais joindre.
      </p>
      <CodeBlock title="Directory de cette instance" code={ctx.directory} />

      <h2>Ce que c&apos;est, et ce que ce n&apos;est pas</h2>
      <p>
        Ce n&apos;est pas une autorité de certification. local-cert ne signe rien : il sert
        d&apos;intermédiaire entre votre client ACME et Let&apos;s Encrypt, et le certificat que
        vous recevez est un vrai certificat Let&apos;s Encrypt, reconnu partout.
      </p>
      <p>
        Le problème qu&apos;il règle : un client ACME classique prouve qu&apos;il contrôle un nom
        en répondant sur le port 80 (HTTP-01), ce qui suppose que Let&apos;s Encrypt puisse
        atteindre la machine. Sur un LAN, c&apos;est impossible. La preuve par DNS (DNS-01)
        fonctionne, mais oblige à donner des credentials DNS à chaque machine. local-cert garde
        ces credentials pour lui et fait la preuve DNS à la place du client.
      </p>

      <h2>Comment un certificat est émis</h2>
      <ol>
        <li>
          <b>Enregistrement.</b> Le client crée son compte ACME en présentant un identifiant EAB.
          Une seule fois ; ensuite il signe avec sa propre clé de compte.
        </li>
        <li>
          <b>Commande.</b> Le client demande un certificat pour un ou plusieurs noms. local-cert
          vérifie qu&apos;ils appartiennent à un domaine géré, et que l&apos;identifiant EAB y a
          droit. Sinon la commande est refusée tout de suite.
        </li>
        <li>
          <b>Challenge.</b> local-cert propose un challenge HTTP-01, comme une CA ordinaire. Le
          client prépare sa réponse et signale qu&apos;il est prêt.
        </li>
        <li>
          <b>Validation réelle.</b> local-cert ne va jamais chercher la réponse HTTP. À la place,
          il ouvre une commande chez Let&apos;s Encrypt, écrit l&apos;enregistrement TXT{' '}
          <code>_acme-challenge</code> dans votre zone, attend sa propagation, fait valider, puis
          supprime l&apos;enregistrement. Le challenge du client passe à <code>valid</code> quand
          c&apos;est terminé.
        </li>
        <li>
          <b>Finalisation.</b> Le client envoie son CSR. local-cert le transmet à Let&apos;s
          Encrypt et renvoie la chaîne de certificats. La clé privée n&apos;a jamais quitté le
          client.
        </li>
      </ol>
      <Callout title="Conséquences pratiques">
        <ul>
          <li>
            Le port 80 du client n&apos;a pas besoin d&apos;être joignable, ni par local-cert ni
            par Internet. Le client doit seulement pouvoir appeler local-cert en HTTP(S).
          </li>
          <li>
            L&apos;étape 4 prend une à trois minutes : c&apos;est le temps de la propagation DNS.
            Les clients attendent d&apos;eux-mêmes ; n&apos;abaissez pas leurs délais.
          </li>
          <li>
            Seul HTTP-01 est proposé. Un client configuré uniquement en DNS-01 ou TLS-ALPN-01 ne
            trouvera pas de challenge compatible.
          </li>
        </ul>
      </Callout>

      <h2>Les identifiants EAB</h2>
      <p>
        EAB signifie <i>External Account Binding</i>. C&apos;est le mécanisme prévu par ACME pour
        qu&apos;une CA n&apos;accepte que les clients qu&apos;elle connaît déjà : au moment de
        créer son compte, le client prouve qu&apos;il détient un secret remis à l&apos;avance.
        Ici, c&apos;est ce qui remplace la clé d&apos;API.
      </p>
      <p>Un identifiant EAB se compose de deux valeurs, plus l&apos;URL du serveur :</p>
      <EabValues ctx={ctx} />
      <p>
        Il se crée dans <Link href="/admin/keys">Clés &amp; droits</Link> →{' '}
        <b>Identifiants EAB</b> → <b>+ nouvel identifiant</b>, avec :
      </p>
      <ul>
        <li>
          un <b>nom</b>, pour savoir à quel client il a été remis ;
        </li>
        <li>
          une <b>expiration</b> facultative ;
        </li>
        <li>
          les <b>domaines autorisés</b> : le client ne peut demander de certificats que sous
          ceux-là.
        </li>
      </ul>
      <h3>Ce qu&apos;il faut savoir</h3>
      <ul>
        <li>
          La clé HMAC n&apos;est affichée qu&apos;une fois. Perdue, il faut créer un nouvel
          identifiant.
        </li>
        <li>
          Le client ne s&apos;en sert qu&apos;à l&apos;enregistrement, mais local-cert relit
          l&apos;identifiant à chaque requête : le <b>révoquer</b> ou le laisser <b>expirer</b>{' '}
          coupe aussi les clients déjà enregistrés.
        </li>
        <li>
          Un identifiant peut servir à plusieurs clients. Un identifiant par client permet de les
          couper séparément et de savoir qui a émis quoi.
        </li>
        <li>
          La clé est encodée en base64url, le format attendu par tous les clients (
          <code>hmacEncoded</code>, <code>--eab-hmac-key</code>, <code>mac_key</code>…).
        </li>
      </ul>

      <h2>Ce que le client doit savoir faire</h2>
      <p>Trois choses, que la quasi-totalité des clients ACME modernes proposent :</p>
      <ol>
        <li>utiliser une URL de directory personnalisée ;</li>
        <li>s&apos;enregistrer avec un External Account Binding ;</li>
        <li>résoudre un challenge HTTP-01.</li>
      </ol>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Outil</th>
              <th>Support</th>
              <th>Guide</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Traefik', 'natif', 'acme/traefik'],
              ['Caddy', 'natif', 'acme/caddy'],
              ['Apache httpd', 'natif (mod_md)', 'acme/apache'],
              ['Nginx', 'via certbot ou acme.sh', 'acme/nginx'],
              ['HAProxy', 'via acme.sh', 'acme/haproxy'],
              ['Nginx Proxy Manager', 'import manuel', 'acme/nginx-proxy-manager'],
              ['Kubernetes', 'natif (cert-manager)', 'acme/kubernetes'],
              ['Dokploy', 'natif (Traefik)', 'acme/dokploy'],
              ['Coolify', 'natif (Traefik)', 'acme/coolify'],
              ['Synology DSM', 'via acme.sh', 'acme/synology'],
              ['Proxmox VE', 'natif (pvenode)', 'acme/proxmox'],
              ['certbot, acme.sh, lego', 'natif', 'acme/clients'],
            ].map(([tool, support, slug]) => (
              <tr key={slug}>
                <td>{tool}</td>
                <td>{support}</td>
                <td>
                  <Link href={`/admin/docs/${slug}`}>ouvrir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Pour tout le reste, voir <Link href="/admin/docs/acme/others">Autres systèmes</Link>.
      </p>

      <h2>Règles et limites</h2>
      <ul>
        <li>
          Un nom hors des domaines gérés est refusé (<code>rejectedIdentifier</code>) ; un domaine
          non autorisé pour l&apos;identifiant aussi (<code>unauthorized</code>).
        </li>
        <li>Tous les noms d&apos;une même commande doivent appartenir au même domaine géré.</li>
        <li>
          Les jokers (<code>*.home.example.com</code>) sont acceptés : la validation réelle étant
          faite en DNS-01, la restriction habituelle de HTTP-01 ne s&apos;applique pas. Certains
          clients refusent toutefois d&apos;eux-mêmes un joker en HTTP-01.
        </li>
        <li>
          Ces certificats apparaissent dans <Link href="/admin/certificates">Certificats</Link>{' '}
          avec le type de clé <code>external</code>, sans clé privée ni renouvellement automatique
          : c&apos;est le client qui renouvelle.
        </li>
        <li>
          Un compte ACME peut révoquer les certificats qu&apos;il a obtenus. La rotation de clé de
          compte (<code>keyChange</code>) n&apos;est pas implémentée.
        </li>
      </ul>

      <h2>Dépannage</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Symptôme</th>
              <th>Cause</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>JWS &quot;url&quot; is … but this endpoint is …</code>
              </td>
              <td>
                local-cert est derrière un proxy qui ne transmet pas{' '}
                <code>X-Forwarded-Proto</code> / <code>X-Forwarded-Host</code>. Transmettez-les, ou
                fixez la variable <code>PUBLIC_URL</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>externalAccountRequired</code>
              </td>
              <td>Le client s&apos;enregistre sans EAB. Vérifiez sa configuration.</td>
            </tr>
            <tr>
              <td>
                <code>unauthorized</code> à l&apos;enregistrement
              </td>
              <td>Identifiant inconnu, révoqué ou expiré, ou clé HMAC erronée.</td>
            </tr>
            <tr>
              <td>
                <code>rejectedIdentifier</code>
              </td>
              <td>Le nom demandé n&apos;est sous aucun domaine géré.</td>
            </tr>
            <tr>
              <td>Le client abandonne après ~1 minute</td>
              <td>
                Son délai d&apos;attente est plus court que la validation DNS. Relancez : la
                commande en cours est reprise.
              </td>
            </tr>
            <tr>
              <td>Erreur TLS vers local-cert</td>
              <td>
                local-cert est servi avec un certificat que le client ne reconnaît pas. Servez-le
                avec un certificat public, ou ajoutez sa CA au magasin du client.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
