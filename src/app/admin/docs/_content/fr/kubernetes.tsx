import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Kubernetes({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Kubernetes</h1>
      <p className="lead">
        Avec cert-manager, local-cert se déclare comme un <code>ClusterIssuer</code> ACME. Les
        Ingress et les ressources <code>Certificate</code> s&apos;en servent ensuite comme de
        n&apos;importe quel émetteur.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Le secret EAB</h2>
      <CodeBlock
        title="kubectl"
        code={`kubectl -n cert-manager create secret generic local-cert-eab \\
  --from-literal=secret=${EX.hmac}`}
      />
      <p>
        Pour un <code>ClusterIssuer</code>, le secret doit se trouver dans l&apos;espace de noms de
        cert-manager.
      </p>

      <h2>2. Le ClusterIssuer</h2>
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
        title="appliquer et vérifier"
        code={`kubectl apply -f local-cert-issuer.yaml
kubectl get clusterissuer local-cert -o wide   # READY doit passer à True`}
      />
      <p>
        Remplacez <code>ingressClassName</code> par celle de votre contrôleur (
        <code>traefik</code> sur k3s, par exemple).
      </p>

      <h2>3. Demander un certificat</h2>
      <p>Par annotation sur un Ingress :</p>
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
      <p>ou explicitement :</p>
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

      <Callout kind="warn" title="L'auto-vérification de cert-manager">
        Avant de prévenir le serveur ACME, cert-manager vérifie lui-même que le challenge répond :
        il appelle <code>http://{EX.host}/.well-known/acme-challenge/…</code> depuis le cluster.
        local-cert n&apos;en a pas besoin, mais cert-manager, si. Il faut donc que, vu depuis les
        pods, le nom se résolve vers votre contrôleur Ingress et que le port 80 y réponde. Tant
        que ce n&apos;est pas le cas, le <code>Challenge</code> reste en attente avec le motif{' '}
        <i>Waiting for HTTP-01 challenge propagation</i>.
      </Callout>

      <h2>Suivre une émission</h2>
      <CodeBlock
        title="kubectl"
        code={`kubectl get certificate,certificaterequest,order,challenge -A
kubectl describe challenge -A | tail -n 20`}
      />
      <p>
        Comptez une à trois minutes entre la présentation du challenge et le passage du{' '}
        <code>Certificate</code> à <code>Ready</code>. cert-manager renouvelle ensuite seul, aux
        deux tiers de la durée de vie.
      </p>

      <h2>Variantes</h2>
      <ul>
        <li>
          <b>Un émetteur par espace de noms</b> : utilisez <code>Issuer</code> à la place de{' '}
          <code>ClusterIssuer</code>, avec le secret EAB dans le même espace de noms. Un
          identifiant EAB par équipe, limité à ses domaines, cloisonne proprement.
        </li>
        <li>
          <b>Gateway API</b> : remplacez le solveur par{' '}
          <code>http01.gatewayHTTPRoute.parentRefs</code>.
        </li>
        <li>
          <b>Sans cert-manager</b> (k3s avec Traefik) : le resolver décrit dans{' '}
          <Link href="/admin/docs/acme/traefik">Traefik</Link> se déclare dans les arguments du
          chart via un <code>HelmChartConfig</code>.
        </li>
        <li>
          <b>Jokers</b> : cert-manager refuse HTTP-01 pour un joker. Émettez-le par l&apos;
          <Link href="/admin/api">API</Link> et chargez-le comme secret TLS.
        </li>
      </ul>
    </>
  );
}
