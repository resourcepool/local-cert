import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Kubernetes({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Kubernetes</h1>
      <p className="lead">
        Con cert-manager, local-cert se declara como un <code>ClusterIssuer</code> ACME. Los
        Ingress y los recursos <code>Certificate</code> lo utilizan después como cualquier otro
        emisor.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. El secreto EAB</h2>
      <CodeBlock
        title="kubectl"
        code={`kubectl -n cert-manager create secret generic local-cert-eab \\
  --from-literal=secret=${EX.hmac}`}
      />
      <p>
        Para un <code>ClusterIssuer</code>, el secreto debe estar en el espacio de nombres
        (namespace) de cert-manager.
      </p>

      <h2>2. El ClusterIssuer</h2>
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
        title="aplicar y verificar"
        code={`kubectl apply -f local-cert-issuer.yaml
kubectl get clusterissuer local-cert -o wide   # READY debe pasar a True`}
      />
      <p>
        Sustituya <code>ingressClassName</code> por la de su controlador (<code>traefik</code> en
        k3s, por ejemplo).
      </p>

      <h2>3. Solicitar un certificado</h2>
      <p>Mediante una anotación en un Ingress:</p>
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
      <p>o de forma explícita:</p>
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

      <Callout kind="warn" title="La autocomprobación de cert-manager">
        Antes de avisar al servidor ACME, cert-manager comprueba por sí mismo que el desafío
        responde: llama a <code>http://{EX.host}/.well-known/acme-challenge/…</code> desde el
        clúster. local-cert no lo necesita, pero cert-manager sí. Por tanto, visto desde los pods,
        el nombre debe resolverse hacia su controlador Ingress y el puerto 80 debe responder allí.
        Mientras no sea así, el <code>Challenge</code> permanece pendiente con el motivo{' '}
        <i>Waiting for HTTP-01 challenge propagation</i>.
      </Callout>

      <h2>Seguir una emisión</h2>
      <CodeBlock
        title="kubectl"
        code={`kubectl get certificate,certificaterequest,order,challenge -A
kubectl describe challenge -A | tail -n 20`}
      />
      <p>
        Cuente con entre uno y tres minutos desde la presentación del desafío hasta que el{' '}
        <code>Certificate</code> pasa a <code>Ready</code>. A partir de ahí, cert-manager renueva
        por sí solo, cuando ha transcurrido dos tercios de la vida útil.
      </p>

      <h2>Variantes</h2>
      <ul>
        <li>
          <b>Un emisor por espacio de nombres</b>: utilice <code>Issuer</code> en lugar de{' '}
          <code>ClusterIssuer</code>, con el secreto EAB en el mismo espacio de nombres. Una
          credencial EAB por equipo, limitada a sus dominios, permite separarlos con claridad.
        </li>
        <li>
          <b>Gateway API</b>: sustituya el solver por{' '}
          <code>http01.gatewayHTTPRoute.parentRefs</code>.
        </li>
        <li>
          <b>Sin cert-manager</b> (k3s con Traefik): el resolver descrito en{' '}
          <Link href="/admin/docs/acme/traefik">Traefik</Link> se declara en los argumentos del
          chart mediante un <code>HelmChartConfig</code>.
        </li>
        <li>
          <b>Comodines</b>: cert-manager rechaza HTTP-01 para un comodín. Emítalo a través de la{' '}
          <Link href="/admin/api">API</Link> y cárguelo como secreto TLS.
        </li>
      </ul>
    </>
  );
}
