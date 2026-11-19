import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Kubernetes({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Kubernetes</h1>
      <p className="lead">
        Con cert-manager, local-cert si dichiara come <code>ClusterIssuer</code> ACME. Gli
        Ingress e le risorse <code>Certificate</code> lo usano poi come qualsiasi altro emittente.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Il secret EAB</h2>
      <CodeBlock
        title="kubectl"
        code={`kubectl -n cert-manager create secret generic local-cert-eab \\
  --from-literal=secret=${EX.hmac}`}
      />
      <p>
        Per un <code>ClusterIssuer</code>, il secret deve trovarsi nel namespace di cert-manager.
      </p>

      <h2>2. Il ClusterIssuer</h2>
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
        title="applicare e verificare"
        code={`kubectl apply -f local-cert-issuer.yaml
kubectl get clusterissuer local-cert -o wide   # READY deve passare a True`}
      />
      <p>
        Sostituire <code>ingressClassName</code> con quella del proprio controller (
        <code>traefik</code> su k3s, ad esempio).
      </p>

      <h2>3. Richiedere un certificato</h2>
      <p>Tramite annotazione su un Ingress:</p>
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
      <p>oppure in modo esplicito:</p>
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

      <Callout kind="warn" title="L'autoverifica di cert-manager">
        Prima di avvisare il server ACME, cert-manager verifica da sé che la challenge risponda:
        chiama <code>http://{EX.host}/.well-known/acme-challenge/…</code> dall&apos;interno del
        cluster. local-cert non ne ha bisogno, ma cert-manager sì. Occorre quindi che, visto dai
        pod, il nome si risolva verso il controller Ingress e che la porta 80 risponda. Finché non
        è così, la <code>Challenge</code> resta in attesa con il motivo{' '}
        <i>Waiting for HTTP-01 challenge propagation</i>.
      </Callout>

      <h2>Seguire un&apos;emissione</h2>
      <CodeBlock
        title="kubectl"
        code={`kubectl get certificate,certificaterequest,order,challenge -A
kubectl describe challenge -A | tail -n 20`}
      />
      <p>
        Calcolare da uno a tre minuti tra la presentazione della challenge e il passaggio del{' '}
        <code>Certificate</code> a <code>Ready</code>. cert-manager poi rinnova da solo, dopo due
        terzi della durata di vita.
      </p>

      <h2>Varianti</h2>
      <ul>
        <li>
          <b>Un emittente per namespace</b>: usare <code>Issuer</code> al posto di{' '}
          <code>ClusterIssuer</code>, con il secret EAB nello stesso namespace. Una credenziale
          EAB per team, limitata ai suoi domini, garantisce una netta separazione.
        </li>
        <li>
          <b>Gateway API</b>: sostituire il solver con{' '}
          <code>http01.gatewayHTTPRoute.parentRefs</code>.
        </li>
        <li>
          <b>Senza cert-manager</b> (k3s con Traefik): il resolver descritto in{' '}
          <Link href="/admin/docs/acme/traefik">Traefik</Link> si dichiara negli argomenti del
          chart tramite un <code>HelmChartConfig</code>.
        </li>
        <li>
          <b>Wildcard</b>: cert-manager rifiuta HTTP-01 per un wildcard. Emetterlo tramite
          l&apos;<Link href="/admin/api">API</Link> e caricarlo come secret TLS.
        </li>
      </ul>
    </>
  );
}
