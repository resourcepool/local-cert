import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Kubernetes({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Kubernetes</h1>
      <p className="lead">
        Mit cert-manager wird local-cert als ACME-<code>ClusterIssuer</code> deklariert. Ingress-
        und <code>Certificate</code>-Ressourcen verwenden ihn anschließend wie jeden anderen
        Aussteller.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Das EAB-Secret</h2>
      <CodeBlock
        title="kubectl"
        code={`kubectl -n cert-manager create secret generic local-cert-eab \\
  --from-literal=secret=${EX.hmac}`}
      />
      <p>
        Bei einem <code>ClusterIssuer</code> muss das Secret im Namespace von cert-manager liegen.
      </p>

      <h2>2. Der ClusterIssuer</h2>
      <CodeBlock
        title="local-cert-issuer.yaml"
        code={`apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: local-cert
spec:
  acme:
    server: ${ctx.directory}
    email: ${EX.email}
    privateKeySecretRef:
      name: local-cert-account
    externalAccountBinding:
      keyID: ${EX.kid}
      keySecretRef:
        name: local-cert-eab
        key: secret
    solvers:
      - http01:
          ingress:
            ingressClassName: nginx`}
      />
      <CodeBlock
        title="Anwenden und prüfen"
        code={`kubectl apply -f local-cert-issuer.yaml
kubectl get clusterissuer local-cert -o wide   # READY muss auf True wechseln`}
      />
      <p>
        Ersetzen Sie <code>ingressClassName</code> durch die Ihres Controllers (z. B.{' '}
        <code>traefik</code> bei k3s).
      </p>

      <h2>3. Ein Zertifikat anfordern</h2>
      <p>Per Annotation an einem Ingress:</p>
      <CodeBlock
        title="ingress.yaml"
        code={`apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nas
  annotations:
    cert-manager.io/cluster-issuer: local-cert
spec:
  ingressClassName: nginx
  tls:
    - hosts: [${EX.host}]
      secretName: nas-tls
  rules:
    - host: ${EX.host}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: nas
                port:
                  number: 80`}
      />
      <p>oder explizit:</p>
      <CodeBlock
        title="certificate.yaml"
        code={`apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: nas
spec:
  secretName: nas-tls
  dnsNames: [${EX.host}]
  issuerRef:
    kind: ClusterIssuer
    name: local-cert`}
      />

      <Callout kind="warn" title="Die Selbstprüfung von cert-manager">
        Bevor cert-manager den ACME-Server benachrichtigt, prüft es selbst, ob die Challenge
        antwortet: Es ruft <code>http://{EX.host}/.well-known/acme-challenge/…</code> aus dem
        Cluster heraus auf. local-cert braucht das nicht, cert-manager aber schon. Aus Sicht der
        Pods muss sich der Name daher auf Ihren Ingress-Controller auflösen und Port 80 dort
        antworten. Solange das nicht der Fall ist, bleibt die <code>Challenge</code> mit dem Grund{' '}
        <i>Waiting for HTTP-01 challenge propagation</i> hängen.
      </Callout>

      <h2>Eine Ausstellung verfolgen</h2>
      <CodeBlock
        title="kubectl"
        code={`kubectl get certificate,certificaterequest,order,challenge -A
kubectl describe challenge -A | tail -n 20`}
      />
      <p>
        Rechnen Sie mit ein bis drei Minuten zwischen der Präsentation der Challenge und dem
        Wechsel des <code>Certificate</code> auf <code>Ready</code>. cert-manager erneuert danach
        selbstständig, nach zwei Dritteln der Laufzeit.
      </p>

      <h2>Varianten</h2>
      <ul>
        <li>
          <b>Ein Aussteller pro Namespace</b>: Verwenden Sie <code>Issuer</code> statt{' '}
          <code>ClusterIssuer</code>, mit dem EAB-Secret im selben Namespace. Ein EAB-Satz pro
          Team, auf dessen Domains beschränkt, sorgt für saubere Trennung.
        </li>
        <li>
          <b>Gateway API</b>: Ersetzen Sie den Solver durch{' '}
          <code>http01.gatewayHTTPRoute.parentRefs</code>.
        </li>
        <li>
          <b>Ohne cert-manager</b> (k3s mit Traefik): Der unter{' '}
          <Link href="/admin/docs/acme/traefik">Traefik</Link> beschriebene Resolver wird über ein{' '}
          <code>HelmChartConfig</code> in den Argumenten des Charts deklariert.
        </li>
        <li>
          <b>Wildcards</b>: cert-manager lehnt HTTP-01 für eine Wildcard ab. Stellen Sie sie über
          die <Link href="/admin/api">API</Link> aus und laden Sie sie als TLS-Secret.
        </li>
      </ul>
    </>
  );
}
