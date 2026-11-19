import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Kubernetes({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Kubernetes</h1>
      <p className="lead">
        With cert-manager, local-cert is declared as an ACME <code>ClusterIssuer</code>. Ingresses
        and <code>Certificate</code> resources then use it like any other issuer.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. The EAB secret</h2>
      <CodeBlock
        title="kubectl"
        code={`kubectl -n cert-manager create secret generic local-cert-eab \\
  --from-literal=secret=${EX.hmac}`}
      />
      <p>
        For a <code>ClusterIssuer</code>, the secret must be in cert-manager&apos;s namespace.
      </p>

      <h2>2. The ClusterIssuer</h2>
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
        title="apply and verify"
        code={`kubectl apply -f local-cert-issuer.yaml
kubectl get clusterissuer local-cert -o wide   # READY must turn True`}
      />
      <p>
        Replace <code>ingressClassName</code> with your controller&apos;s (<code>traefik</code> on
        k3s, for example).
      </p>

      <h2>3. Request a certificate</h2>
      <p>With an annotation on an Ingress:</p>
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
      <p>or explicitly:</p>
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

      <Callout kind="warn" title="cert-manager's self-check">
        Before notifying the ACME server, cert-manager checks for itself that the challenge
        responds: it calls <code>http://{EX.host}/.well-known/acme-challenge/…</code> from inside
        the cluster. local-cert doesn&apos;t need this, but cert-manager does. So, seen from the
        pods, the name must resolve to your Ingress controller and port 80 must answer there. Until
        that is the case, the <code>Challenge</code> stays pending with the reason{' '}
        <i>Waiting for HTTP-01 challenge propagation</i>.
      </Callout>

      <h2>Following an issuance</h2>
      <CodeBlock
        title="kubectl"
        code={`kubectl get certificate,certificaterequest,order,challenge -A
kubectl describe challenge -A | tail -n 20`}
      />
      <p>
        Allow one to three minutes between the challenge being presented and the{' '}
        <code>Certificate</code> turning <code>Ready</code>. cert-manager then renews on its own,
        at two thirds of the lifetime.
      </p>

      <h2>Variants</h2>
      <ul>
        <li>
          <b>One issuer per namespace</b>: use <code>Issuer</code> instead of{' '}
          <code>ClusterIssuer</code>, with the EAB secret in the same namespace. One EAB credential
          per team, limited to its domains, gives clean separation.
        </li>
        <li>
          <b>Gateway API</b>: replace the solver with{' '}
          <code>http01.gatewayHTTPRoute.parentRefs</code>.
        </li>
        <li>
          <b>Without cert-manager</b> (k3s with Traefik): the resolver described in{' '}
          <Link href="/admin/docs/acme/traefik">Traefik</Link> is declared in the chart&apos;s
          arguments through a <code>HelmChartConfig</code>.
        </li>
        <li>
          <b>Wildcards</b>: cert-manager refuses HTTP-01 for a wildcard. Issue it through the{' '}
          <Link href="/admin/api">API</Link> and load it as a TLS secret.
        </li>
      </ul>
    </>
  );
}
