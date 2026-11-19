import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Kubernetes({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Kubernetes</h1>
      <p className="lead">
        Com o cert-manager, o local-cert declara-se como um <code>ClusterIssuer</code> ACME. Os
        Ingress e os recursos <code>Certificate</code> utilizam-no depois como qualquer outro
        emissor.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. O segredo EAB</h2>
      <CodeBlock
        title="kubectl"
        code={`kubectl -n cert-manager create secret generic local-cert-eab \\
  --from-literal=secret=${EX.hmac}`}
      />
      <p>
        Para um <code>ClusterIssuer</code>, o segredo tem de estar no namespace do cert-manager.
      </p>

      <h2>2. O ClusterIssuer</h2>
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
        title="aplicar e verificar"
        code={`kubectl apply -f local-cert-issuer.yaml
kubectl get clusterissuer local-cert -o wide   # READY deve passar a True`}
      />
      <p>
        Substitua <code>ingressClassName</code> pela do seu controlador (
        <code>traefik</code> no k3s, por exemplo).
      </p>

      <h2>3. Pedir um certificado</h2>
      <p>Por anotação num Ingress:</p>
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
      <p>ou explicitamente:</p>
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

      <Callout kind="warn" title="A autoverificação do cert-manager">
        Antes de avisar o servidor ACME, o cert-manager verifica por si próprio que o desafio
        responde: chama <code>http://{EX.host}/.well-known/acme-challenge/…</code> a partir do
        cluster. O local-cert não precisa disso, mas o cert-manager precisa. É, por isso,
        necessário que, visto a partir dos pods, o nome se resolva para o seu controlador Ingress
        e que a porta 80 responda aí. Enquanto tal não acontecer, o <code>Challenge</code> fica
        pendente com o motivo <i>Waiting for HTTP-01 challenge propagation</i>.
      </Callout>

      <h2>Acompanhar uma emissão</h2>
      <CodeBlock
        title="kubectl"
        code={`kubectl get certificate,certificaterequest,order,challenge -A
kubectl describe challenge -A | tail -n 20`}
      />
      <p>
        Conte com um a três minutos entre a apresentação do desafio e a passagem do{' '}
        <code>Certificate</code> a <code>Ready</code>. O cert-manager renova depois sozinho, aos
        dois terços do tempo de vida.
      </p>

      <h2>Variantes</h2>
      <ul>
        <li>
          <b>Um emissor por namespace</b>: utilize <code>Issuer</code> em vez de{' '}
          <code>ClusterIssuer</code>, com o segredo EAB no mesmo namespace. Uma credencial EAB por
          equipa, limitada aos seus domínios, compartimenta de forma limpa.
        </li>
        <li>
          <b>Gateway API</b>: substitua o solver por{' '}
          <code>http01.gatewayHTTPRoute.parentRefs</code>.
        </li>
        <li>
          <b>Sem cert-manager</b> (k3s com Traefik): o resolver descrito em{' '}
          <Link href="/admin/docs/acme/traefik">Traefik</Link> declara-se nos argumentos do chart
          através de um <code>HelmChartConfig</code>.
        </li>
        <li>
          <b>Carateres universais</b>: o cert-manager recusa o HTTP-01 para um caráter universal.
          Emita-o pela <Link href="/admin/api">API</Link> e carregue-o como segredo TLS.
        </li>
      </ul>
    </>
  );
}
