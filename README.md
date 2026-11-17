# local-cert

Émission et renouvellement de certificats **Let's Encrypt** pour des hôtes du
**réseau local**, via le challenge **DNS-01** sur une zone **Route53**.

Un hôte en `192.168.1.50` n'est pas joignable depuis Internet : HTTP-01 et
TLS-ALPN-01 sont donc impossibles. DNS-01 est la seule voie — et Route53 s'y
prête bien.

Next.js 16 · API REST + console d'administration · SQLite ou Postgres.

---

## Démarrage

```bash
cp .env.example .env.local
openssl rand -base64 32   # -> MASTER_KEY
openssl rand -base64 48   # -> JWT_SECRET

npm install
npm run dev
```

Au **premier lancement**, l'application applique le schéma puis vous envoie sur
`/setup` — toutes les autres pages y redirigent, et l'API répond
`503 setup_required`. Le wizard demande **email + mot de passe** et crée le compte
administrateur. Aucune politique de mot de passe n'est imposée : ni longueur
minimale, ni composition, ni expiration.

Une **clé d'API** est générée au passage et affichée **une seule fois**, sur
cette page. Vous pouvez aussi fournir la vôtre.

Le wizard ne se réaffiche jamais : un drapeau `setup.completed_at` est posé dans
la même transaction que la création du compte, et `POST /api/setup` répond `409`
ensuite.

Le mot de passe est haché en **argon2id** (19 MiB, t=2, p=1 — baseline OWASP).
La clé d'API est stockée en sha256. Aucun secret n'est écrit sur disque.

### Provisionnement sans wizard

Définissez ces variables **avant le premier démarrage** — le compte est créé au
boot et le wizard est court-circuité :

```bash
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=votre-mot-de-passe
ADMIN_API_KEY=                        # optionnel
```

Sans `ADMIN_API_KEY`, une clé est générée et affichée une fois dans les logs de
démarrage. Avec, votre chaîne est adoptée telle quelle (24 caractères minimum,
stockée hachée).

Ces variables ne sont lues que tant que le setup n'est pas fait : les changer
ensuite n'a aucun effet. Pour faire tourner le mot de passe ou la clé :

```bash
npx tsx scripts/reset-admin.ts admin@example.com <nouveau-mot-de-passe>
```

### Ensuite

1. **Domaines** — déclarer la zone Route53 (`home.example.com` + `Z0123…`).
   Les permissions sont vérifiées **avant** l'enregistrement : les cinq appels
   Route53 nécessaires sont sondés, et le domaine n'est créé que s'ils passent.
2. **Clés & droits** — créer une clé par hôte, cocher les scopes par domaine.
3. **Certificats** — émettre, suivre les logs en direct, télécharger le `.pem`.

> Restez sur `ACME_ENV=staging` tant que le flux n'est pas validé. La
> production Let's Encrypt limite à **50 certificats par domaine enregistré et
> par semaine**, et le compteur ne se remet pas à zéro sur demande.

---

## Environnements

`APP_ENV` (à défaut `NODE_ENV`) pilote les deux réglages qu'il ne faut jamais se
tromper en production :

| | `development` | `production` |
|---|---|---|
| Politique de mot de passe | aucune | appliquée |
| Directory ACME par défaut | staging | production |

**Politique de production** : 12 caractères minimum, 256 maximum, au moins 3 des
4 catégories (minuscule, majuscule, chiffre, symbole), refus des mots de passe
courants et de ceux contenant l'adresse e-mail du compte. Elle s'applique au
wizard `/setup`, au provisionnement par `ADMIN_PASSWORD`, et à
`scripts/reset-admin.ts` — pas seulement au formulaire.

En développement, seule la chaîne vide est refusée. Le formulaire de setup lit
la politique active depuis `GET /api/setup` : il n'y a pas de règle dupliquée
côté client.

**ACME** : `ACME_ENV` reste prioritaire dans les deux sens. Le laisser vide fait
suivre `APP_ENV` — c'est le défaut recommandé. Le forcer à `staging` sur une
instance de production est utile le temps de valider une nouvelle zone ; le
forcer à `production` en développement est possible, et rarement une bonne idée
(50 certificats par domaine enregistré et par semaine).

L'environnement actif est affiché dans l'en-tête de la console et sur la page de
setup.

---

## Base de données

Un seul schéma, deux dialectes, choisis par variable d'environnement :

```bash
DB_DIALECT=sqlite
SQLITE_PATH=./data/local-cert.db
```

```bash
DB_DIALECT=postgres
DATABASE_URL=postgres://localcert:secret@localhost:5432/localcert
```

Les migrations s'appliquent automatiquement au démarrage
(`src/lib/db/migrate.ts`), ou via `npm run db:migrate`.

Portabilité : les timestamps sont du TEXT ISO-8601 UTC, les booléens des
INTEGER 0/1, les structures du TEXT JSON. Kysely génère le SQL des deux côtés.

---

## Modèle d'autorisation

```
api_key ──< grant >── domain
             │
             └── scopes[]
```

| Scope         | Autorise                                        |
|---------------|-------------------------------------------------|
| `cert:read`   | Lire les certificats et leurs événements        |
| `cert:issue`  | Émettre                                         |
| `cert:renew`  | Renouveler                                      |
| `cert:revoke` | Révoquer / supprimer                            |
| `cert:export` | Télécharger la **clé privée** (en plus de read) |
| `dns:read`    | Lister les enregistrements de la zone           |
| `dns:write`   | UPSERT / DELETE d'enregistrements               |
| `admin:*`     | Tout, sur tous les domaines, + console          |

Une clé sans grant ne peut rien faire. Les droits sont **par domaine** : la clé
du NAS ne peut pas émettre pour le domaine du serveur de build.

### Deux mécanismes distincts

| | Console web | API |
|---|---|---|
| Identifiant | email + mot de passe | clé d'API |
| Stockage | argon2id | sha256 |
| Transport | cookie `httpOnly` / `SameSite=lax` | en-tête `Authorization` |

Le mot de passe protège un secret à faible entropie choisi par un humain : il
lui faut un KDF lent. Une clé d'API porte 256 bits d'entropie CSPRNG — il n'y a
rien à brute-forcer, sha256 suffit et reste rapide à chaque requête.

Un compte inexistant et un mauvais mot de passe consomment le même temps de
calcul : impossible d'énumérer les comptes par la latence.

### Format des clés

```
lc_<prefix8hex>_<secret base64url 32 octets>
```

Le préfixe est indexé et affichable. Une clé fournie par l'opérateur
(`ADMIN_API_KEY`) peut être une chaîne opaque quelconque : son préfixe de
recherche dérive de son propre sha256, les deux formes partagent le même index.

### Deux façons de s'authentifier

```bash
# 1. clé d'API directement (pratique pour cron/curl)
curl -H "Authorization: Bearer lc_..." http://localhost:3000/api/v1/certificates

# 2. échange contre un JWT court (1 h), scopes embarqués dans le token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/token \
  -H "Authorization: Bearer lc_..." | jq -r .access_token)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/certificates
```

La console d'admin utilise un cookie de session `httpOnly` + `SameSite=lax`
portant un JWT équivalent, obtenu par email + mot de passe.

---

## API

### Authentification
```
GET    /api/setup                    { setup_required: bool }
POST   /api/setup                    création du compte admin (une seule fois)
POST   /api/v1/auth/token            clé d'API -> JWT
```

### Certificats
```
GET    /api/v1/certificates          ?status= &domain= &expires_within_days= &limit= &metadata.<clé>=
POST   /api/v1/certificates          202 + Location
GET    /api/v1/certificates/{id}
PATCH  /api/v1/certificates/{id}     met à jour la métadonnée
DELETE /api/v1/certificates/{id}     ?purge=true pour effacer la ligne
POST   /api/v1/certificates/{id}/renew
GET    /api/v1/certificates/{id}/bundle   ?format=json|pem &include=fullchain,cert,chain,key
GET    /api/v1/certificates/{id}/events   ?stream=1 pour du SSE
```

### Sous-domaines
```
GET    /api/v1/subdomains/{fqdn}     ce sous-domaine est-il déjà pris ?
```

### DNS
```
GET    /api/v1/dns/records           ?domain_id=
PUT    /api/v1/dns/records
DELETE /api/v1/dns/records           ?fqdn= &type= &values= &ttl=
```

### Divers
```
GET    /api/v1/acme/account
GET    /api/openapi.json             description OpenAPI 3.1 (authentifiée)
GET    /api/healthz
POST   /api/mcp                      serveur MCP pour agents IA (voir plus bas)
```

### Administration (session console)
```
POST|GET|DELETE  /api/admin/session   email+mot de passe / whoami / logout
GET|POST         /api/admin/domains
DELETE           /api/admin/domains/{id}   ?force=true pour supprimer avec ses certificats
GET|POST         /api/admin/keys
PATCH|DELETE     /api/admin/keys/{id}
GET              /api/admin/stats
```

### Émettre un certificat

```bash
curl -X POST http://localhost:3000/api/v1/certificates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H 'content-type: application/json' \
  -d '{
    "domains": ["nas.home.example.com"],
    "key_type": "ec-256",
    "auto_renew": true,
    "renew_before_days": 30,
    "webhook_url": "https://nas.home.example.com/hooks/cert",
    "dns": { "create_record": true, "target_ip": "192.168.1.50", "ttl": 60 }
  }'
```

`202 Accepted` immédiat. Suivi :

```bash
curl -N -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/certificates/$ID/events?stream=1"
```

Machine à états :

```
pending → dns_propagating → validating → issued
                                       ↘ failed (retry exponentiel, 5 essais)
issued → revoked | expired
```

`Idempotency-Key` est fortement recommandé : sans lui, un retry client
consomme un ordre Let's Encrypt pour rien.

---

## Métadonnée métier

Chaque sous-domaine porte une map clé/valeur de chaînes, fournie par le système
appelant pour le rattacher à son contexte : tenant, environnement, ticket,
identifiant interne.

```bash
curl -X POST …/api/v1/certificates -H "Authorization: Bearer $TOKEN" \
  -d '{
    "domains": ["nas.home.example.com"],
    "metadata": { "tenant_id": "acme-corp", "env": "prod", "ticket": "OPS-1421" }
  }'
```

Mise à jour — `merge` par défaut, `replace` pour écraser :

```bash
curl -X PATCH …/api/v1/certificates/$ID \
  -d '{ "metadata": { "tenant_id": "other-corp" }, "mode": "replace" }'
```

Filtrage à la liste, une clé à la fois :

```bash
curl "…/api/v1/certificates?metadata.tenant_id=acme-corp"
```

Le filtre est appliqué côté application, pas en SQL : les opérateurs JSON
diffèrent entre SQLite et Postgres et la colonne n'est indexée dans aucun des
deux, donc il n'y a rien à gagner à le pousser dans la requête.

Limites : 20 entrées, clé de 64 caractères dans `[A-Za-z0-9._:-]`, valeur de 512
caractères, 4096 octets une fois sérialisé. C'est du contexte, pas un magasin de
documents.

---

## Vérifier si un sous-domaine est pris

```bash
curl …/api/v1/subdomains/nas.home.example.com -H "Authorization: Bearer $TOKEN"
```
```json
{
  "fqdn": "nas.home.example.com",
  "available": false,
  "managed_domain": "home.example.com",
  "dns": {
    "exists": true,
    "managed": true,
    "records": [{ "type": "A", "ttl": 60, "values": ["192.168.1.50"] }]
  },
  "certificate": { "id": "cert_…", "status": "issued", "days_remaining": 89, "metadata": {} },
  "metadata": { "tenant_id": "acme-corp" }
}
```

Les deux sources de vérité sont interrogées séparément **parce qu'elles peuvent
diverger** : un enregistrement peut exister dans la zone sans que local-cert le
connaisse (créé à la main, ou par un autre outil), et un certificat peut exister
ici sans que rien ne soit publié. `available` n'est vrai que si aucune des deux
ne connaît le nom **et** que la zone était lisible — une zone illisible remonte
dans `dns.error` plutôt que de faire passer le nom pour libre.

Nécessite `cert:read` sur le domaine couvrant. La moitié DNS n'est pas protégée
davantage : c'est de la donnée publique, résolvable au `dig` par n'importe qui.

---

## Documentation OpenAPI

La description OpenAPI 3.1 complète est servie sur **`GET /api/openapi.json`**
(authentifiée — le schéma cartographie toute la surface d'un outil interne).

La console embarque un explorateur sur **`/admin/api`** : endpoints groupés par
tag, filtre, paramètres et corps pré-remplis depuis le schéma, équivalent
`curl`, et un bouton **Envoyer** qui exécute réellement la requête depuis le
navigateur avec votre cookie de session.

> Les appels partent pour de vrai, y compris ceux qui écrivent. `POST
> /api/v1/certificates` depuis l'explorateur consomme un ordre Let's Encrypt.

### Génération

Le document est **généré**, jamais écrit à la main :

| Élément | Source |
|---|---|
| Corps de requête | les schémas zod que les handlers valident (`src/lib/validation.ts`) |
| Réponses | `src/lib/api/schemas.ts`, reliées au runtime par `z.infer` |
| Opérations | `src/lib/api/routes.ts` |

Conversion via `z.toJSONSchema()` de zod 4. Les contraintes viennent donc
gratuitement des validateurs — la regex de FQDN, les bornes de TTL, les longueurs
de métadonnée apparaissent dans la spec parce qu'elles existent dans le code.

Trois garde-fous, exécutés par `npm run openapi:check` :

1. **Couverture** — chaque handler App Router sur le disque doit figurer au
   registre, et réciproquement. Une route ajoutée sans documentation fait
   échouer le check.
2. **Cohérence input/output** — aucun schéma de réponse ne doit diverger entre
   ses projections d'entrée et de sortie ; le générateur fait une passe unique,
   ce qui n'est correct que tant que c'est vrai (un `.default()` ou un
   `.transform()` sur une réponse casserait l'hypothèse).
3. **Résolution des `$ref`** — toute référence doit pointer sur un composant
   existant.

Le typage ferme la boucle : `serializeCert` retourne
`z.infer<typeof certificateSchema>`, donc changer la forme sérialisée sans
mettre à jour le schéma publié échoue à la compilation.

```
openapi:check ok — 30 operations over 19 paths, 36 component schemas, all $refs resolve.
```

---

## Serveur MCP

Les fonctionnalités de local-cert sont exposées aux agents IA par un serveur
[MCP](https://modelcontextprotocol.io) sur **`POST /api/mcp`** (transport
Streamable HTTP, sans état).

### Authentification

La même que l'API : `Authorization: Bearer <clé d'API ou JWT>`, avec les mêmes
scopes. Le cookie de session de la console n'y est **pas** accepté.

```bash
# Claude Code
claude mcp add --transport http local-cert http://localhost:3000/api/mcp \
  --header "Authorization: Bearer lc_..."
```

```jsonc
// .mcp.json, ou tout client MCP acceptant un serveur HTTP
{
  "mcpServers": {
    "local-cert": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp",
      "headers": { "Authorization": "Bearer ${LOCAL_CERT_API_KEY}" }
    }
  }
}
```

### Outils

| Outil | Équivalent REST | Scope requis |
|---|---|---|
| `whoami` | — | clé valide |
| `list_certificates` | `GET /api/v1/certificates` | grant sur le domaine |
| `request_certificate` | `POST /api/v1/certificates` | `cert:issue` (+ `dns:write` si enregistrement A) |
| `get_certificate` | `GET /api/v1/certificates/{id}` | `cert:read` |
| `get_certificate_events` | `GET …/{id}/events` | `cert:read` |
| `get_certificate_bundle` | `GET …/{id}/bundle` | `cert:read` (+ `cert:export` pour la clé) |
| `renew_certificate` | `POST …/{id}/renew` | `cert:renew` |
| `update_certificate_metadata` | `PATCH /api/v1/certificates/{id}` | `cert:issue` |
| `revoke_certificate` | `DELETE /api/v1/certificates/{id}` | `cert:revoke` |
| `check_subdomain` | `GET /api/v1/subdomains/{fqdn}` | `cert:read` |
| `list_dns_records` | `GET /api/v1/dns/records` | `dns:read` |
| `upsert_dns_record` | `PUT /api/v1/dns/records` | `dns:write` |
| `delete_dns_record` | `DELETE /api/v1/dns/records` | `dns:write` |
| `get_acme_account` | `GET /api/v1/acme/account` | clé valide |
| `admin_get_stats` | `GET /api/admin/stats` | clé admin |
| `admin_list_domains` / `admin_create_domain` / `admin_delete_domain` | `/api/admin/domains` | clé admin |
| `admin_list_api_keys` / `admin_create_api_key` / `admin_update_api_key` / `admin_delete_api_key` | `/api/admin/keys` | clé admin |

Les outils non-admin **appellent le handler REST correspondant** dans le même
processus, avec l'en-tête `Authorization` de l'appelant : authentification,
scopes, validation et journal d'audit sont ceux de l'API, par construction. Une
clé ne peut rien faire de plus par MCP que par `curl`.

Les outils `admin_*` ne sont **listés et utilisables que pour une clé admin**.
C'est la seule différence avec REST, où `/api/admin/*` n'accepte que la session
console : ici une clé admin peut gérer domaines et clés. Avant chaque appel
admin, la clé est relue en base — un JWT issu d'une clé admin révoquée ou
rétrogradée est donc refusé immédiatement, sans attendre son expiration.

`get_certificate_bundle` ne renvoie par défaut que la chaîne publique ; la clé
privée n'est incluse que sur demande explicite (`include: ["key"]`), car elle
atterrit alors dans le contexte du modèle.

Non exposés : `/api/setup`, `/api/admin/session`, `/api/v1/auth/token`,
`/api/healthz`, `/api/openapi.json` (amorçage et transport, sans objet pour un
agent) et le flux SSE des événements.

### Skills

Le serveur embarque ses propres modes d'emploi, au format `SKILL.md` :

| Skill | Couvre | Visible par |
|---|---|---|
| `local-cert-getting-started` | permissions, erreurs, `whoami`, skills | tous |
| `local-cert-certificates` | cycle de vie d'un certificat | tous |
| `local-cert-dns` | disponibilité d'un sous-domaine, enregistrements | tous |
| `local-cert-admin` | domaines, clés d'API, statistiques | clés admin |

Deux accès équivalents : les outils **`list_skills`** / **`get_skill`**, et les
ressources MCP `skill://local-cert/<nom>`. Le texte explique les enchaînements
et les pièges ; la référence de chaque outil (rôle, scope, arguments) est
**générée depuis le catalogue d'outils** (`src/lib/mcp/tools.ts`), elle ne peut
donc pas diverger de ce que le serveur expose réellement.

---

## Serveur ACME

local-cert parle aussi ACME (RFC 8555) sur **`/acme/directory`** : Traefik,
certbot, Caddy, acme.sh ou lego peuvent s'en servir comme d'une CA, avec un
challenge HTTP-01 tout ce qu'il y a de plus classique.

Ce n'est pas une CA pour autant. Le challenge HTTP-01 n'est **jamais vérifié**
(personne ne va chercher `/.well-known/acme-challenge/...`, ces hôtes sont sur
le LAN) : y répondre déclenche ce que local-cert fait d'habitude — écriture du
TXT `_acme-challenge` dans la zone Route53, validation DNS-01 auprès de Let's
Encrypt, nettoyage — et le challenge passe à `valid` quand c'est terminé. Le
certificat est ensuite émis par Let's Encrypt à partir du CSR du client.

Ce qui décide du droit d'émettre, c'est l'**identifiant EAB** avec lequel le
client s'est enregistré :

- un nom hors des domaines gérés est refusé (`rejectedIdentifier`) ;
- le domaine doit faire partie de ceux de l'identifiant (`unauthorized`) ;
- tous les noms d'un ordre doivent appartenir à la même zone gérée.

### Identifiants EAB

Ils se gèrent dans la console, page **Clés & droits**, à côté des clés d'API :
un nom, une date d'expiration facultative et les domaines autorisés. La console
affiche alors, une seule fois, les trois valeurs à donner au client : l'URL du
directory, le `kid` et la clé HMAC.

Le client s'en sert une fois, pour enregistrer son compte ACME (External Account
Binding) ; ensuite il signe avec sa propre clé. L'identifiant est relu à chaque
requête : le révoquer, ou le laisser expirer, coupe aussi les clients déjà
enregistrés. Un même identifiant peut servir à plusieurs clients ; un par client
permet de les révoquer séparément.

Même chose par l'API, réservée aux admins (session console ou clé admin) :

```bash
curl -X POST https://certs.example.com/api/v1/acme/eab \
  -H "Authorization: Bearer <clé admin>" -H "Content-Type: application/json" \
  -d '{"name": "traefik-dokploy", "expires_at": null, "domain_ids": ["dom_…"]}'
# { "id": "eab_…", "hmac_key": "…", "directory_url": "https://certs.example.com/acme/directory", … }
```

`GET /api/v1/acme/eab` les liste, `DELETE /api/v1/acme/eab/{id}` en révoque un
(`?purge=true` le supprime, avec ses comptes ACME ; les certificats émis restent).

```yaml
# Traefik
certificatesResolvers:
  localcert:
    acme:
      caServer: https://certs.example.com/acme/directory
      email: ops@example.com
      storage: /letsencrypt/localcert.json
      eab:
        kid: eab_…
        hmacEncoded: <hmac_key>
      httpChallenge:
        entryPoint: web
```

```bash
# certbot
certbot certonly --standalone -d nas.home.example.com \
  --server https://certs.example.com/acme/directory \
  --eab-kid eab_… --eab-hmac-key <hmac_key>
```

### À savoir

- Le client signe l'URL exacte qu'il appelle. Derrière un reverse proxy, soit
  celui-ci transmet `X-Forwarded-Proto` / `X-Forwarded-Host`, soit vous fixez
  `PUBLIC_URL`. Une erreur `JWS "url" is … but this endpoint is …` vient de là.
- La validation DNS prend une à trois minutes ; le client attend sur son
  challenge pendant ce temps.
- Ces certificats apparaissent dans la console (`key_type: external`) sans clé
  privée ni renouvellement automatique : la clé reste chez le client, qui
  renouvelle lui-même. `POST …/renew` les refuse.
- Révocation ACME (`revoke-cert`) : un compte peut révoquer les certificats qu'il
  a lui-même obtenus.
- Non implémenté : `keyChange` (rotation de clé de compte) et la révocation
  signée par la clé du certificat.

## Suppression et récupération

Le cas qui compte : **la zone Route53 n'est plus accessible** (rôle révoqué,
zone supprimée, credentials périmés) et il faut quand même pouvoir nettoyer la
base.

**Rien ne bloque sur une erreur d'API externe.** Supprimer un certificat révoque
au mieux auprès de la CA et nettoie au mieux la zone : si l'un des deux échoue,
la ligne est quand même supprimée et ce qui reste publié est renvoyé dans
`warnings`.

```bash
curl -X DELETE "…/api/v1/certificates/$ID?purge=true" -H "Authorization: Bearer $TOKEN"
```
```json
{
  "id": "cert_…",
  "status": "deleted",
  "warnings": [
    "Could not remove A nas.home.example.com -> 192.168.1.50 from Route53: No hosted zone found with ID: ZINACCESSIBLE. The record is still published — delete it by hand."
  ]
}
```

**Un domaine ne peut pas partir tant qu'un certificat le référence.**
`certificates.domain_id` est en `ON DELETE RESTRICT` : *toute* ligne restante
épingle le domaine — révoquée, en échec ou expirée, pas seulement les actives.
Le refus est explicite et chiffré :

```json
{
  "type": "conflict",
  "title": "Domain still has 3 certificate(s) (1 active). Delete them first, or repeat with ?force=true to remove them along with the domain.",
  "detail": { "certificates": 3, "active": 1, "by_status": { "issued": 1, "failed": 1, "expired": 1 } }
}
```

`?force=true` fait la cascade explicitement : révocation CA au mieux, nettoyage
de zone au mieux, puis suppression des certificats **et** du domaine dans une
seule transaction. Les `certificate_events` et les `grants` suivent par cascade
SQL.

```bash
curl -X DELETE "…/api/admin/domains/$ID?force=true" -b cookies.txt
```

Dans la console, « retirer » affiche le décompte en cas de refus et remplace le
bouton par **« forcer (N) »**. Les enregistrements laissés en place dans la zone
sont listés en avertissement après coup.

> Le nettoyage DNS étant au mieux, un `A` pointant vers une IP privée peut
> rester publié dans votre zone publique. C'est le compromis assumé : mieux vaut
> une ligne à nettoyer à la main qu'une base impossible à purger.

---

## Fonctionnement du DNS-01

1. Création de l'ordre ACME, récupération du token de challenge.
2. `UPSERT` du TXT `_acme-challenge.<fqdn>` dans Route53, TTL 60.
3. Attente de `INSYNC` sur le ChangeId Route53.
4. **Puis** interrogation directe des **NS autoritatifs de la zone** jusqu'à ce
   que tous voient le TXT. Pas 8.8.8.8 : un résolveur récursif met en cache les
   réponses négatives et mentira pendant tout le TTL.
5. Notification à l'ACME, validation, finalize CSR, download.
6. Suppression du TXT — y compris en cas d'échec (`finally`). Un
   `_acme-challenge` orphelin casse la tentative suivante.

Le renouvellement automatique se déclenche à `not_after - renew_before_days`,
avec un jitter déterministe de ±24 h par certificat pour éviter qu'un parc
entier ne tape Let's Encrypt à la même heure.

---

## Deux stratégies possibles

| | A — un cert par hôte | B — un wildcard |
|---|---|---|
| Enregistrement A public vers l'IP privée | oui | non |
| Certificats | 1 par sous-domaine | `*.home.example.com` partagé |
| Rate limit LE | atteint vite au-delà de ~40 hôtes | 1 seul ordre |
| Topologie interne exposée dans le DNS public | oui | non |
| Révocation | par hôte | tout ou rien |

A est plus simple et plus granulaire. Passez à B au-delà de quelques hôtes, ou
si publier vos IP privées dans une zone publique vous dérange. Les deux sont
supportés : cochez « Wildcard » dans la console.

---

## Marquage des ressources

Tout ce que local-cert crée est estampillé `managed-with-local-cert`.

**Contrainte AWS** : Route53 n'expose **aucun tag sur les resource record sets**.
`ChangeTagsForResource` n'accepte que `hostedzone` et `healthcheck`. Les vrais
tags AWS sont donc hors de portée pour des enregistrements DNS. La provenance
est inscrite par les deux seuls canaux qu'un record set autorise :

**1. Le commentaire du ChangeBatch** — sur *chaque* écriture, sans exception :

```
Comment: managed-with-local-cert | UPSERT A nas.home.example.com
Comment: managed-with-local-cert | UPSERT TXT _acme-challenge.nas.home.example.com
Comment: managed-with-local-cert | DELETE A nas.home.example.com
```

Visible dans l'historique des changements Route53 et dans l'événement CloudTrail
correspondant. Utile pour l'audit, mais non interrogeable.

**2. Un enregistrement TXT compagnon** — `_local-cert.<nom>`, valeur
`managed-with-local-cert`, écrit dans **le même ChangeBatch** que
l'enregistrement lui-même (atomique : jamais de marqueur orphelin après une
écriture partielle, et zéro appel API supplémentaire) :

```
nas.home.example.com.             A    60  192.168.1.50
_local-cert.nas.home.example.com. TXT  60  "managed-with-local-cert"
```

C'est ce qui rend la propriété **interrogeable** : un simple `dig` suffit, et ça
survit à une base qui aurait perdu la trace d'un enregistrement.

```bash
dig +short TXT _local-cert.nas.home.example.com
# "managed-with-local-cert"
```

`GET /api/v1/dns/records` résout la propriété à partir des marqueurs présents
dans la zone et annote chaque ligne :

```json
{ "name": "nas.home.example.com",  "type": "A",   "managed": true,  "marker": false }
{ "name": "_local-cert.nas.home.example.com", "type": "TXT", "managed": false, "marker": true }
{ "name": "legacy.home.example.com", "type": "A", "managed": false, "marker": false }
```

### Ce qui n'est pas marqué, et pourquoi

| | Marqueur TXT | Commentaire |
|---|---|---|
| A/AAAA/CNAME/TXT persistants | oui | oui |
| `_acme-challenge.*` | non — durée de vie ~2 min, supprimé en fin d'ordre | oui |
| Noms wildcard | non — Route53 n'accepte `*` qu'en label le plus à gauche, `_local-cert.*.x` est invalide | oui |

`TAG_RECORDS=0` désactive les marqueurs TXT ; les commentaires restent.

**Hosted zones** : local-cert n'en crée jamais, il consomme des zones
existantes. Elles ne sont donc pas taguées — ce serait modifier une ressource
qui ne lui appartient pas. Si vous voulez ce tag, posez-le vous-même :

```bash
aws route53 change-tags-for-resource --resource-type hostedzone \
  --resource-id Z0123456ABCDEFGHIJK \
  --add-tags Key=managed-with,Value=local-cert
```

---

## IAM Route53

Politique au plus juste — l'application n'a besoin d'écrire que des TXT
`_acme-challenge`, plus les A/AAAA que vous lui demandez explicitement :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "route53:ChangeResourceRecordSets",
      "Resource": "arn:aws:route53:::hostedzone/Z0123456ABCDEFGHIJK",
      "Condition": {
        "ForAllValues:StringEquals": {
          "route53:ChangeResourceRecordSetsRecordTypes": ["TXT", "A", "AAAA"]
        },
        "ForAllValues:StringLike": {
          "route53:ChangeResourceRecordSetsNormalizedRecordNames": [
            "*.home.example.com"
          ]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "route53:GetChange",
        "route53:GetHostedZone",
        "route53:ListResourceRecordSets"
      ],
      "Resource": "*"
    }
  ]
}
```

Les `TXT` couvrent à la fois les challenges `_acme-challenge` et les marqueurs
de provenance `_local-cert`.

La copie prête à l'emploi est dans **`docs/iam-policy.json`** (remplacez l'id de
zone).

### Préflight

Les permissions sont sondées **à l'ajout d'un domaine** : si un appel
nécessaire manque, le domaine n'est pas créé et la console affiche exactement
lequel et pourquoi. `?force=true` (bouton « Enregistrer quand même ») permet de
l'enregistrer malgré tout et de corriger l'IAM ensuite.

Le nom de base déclaré est aussi vérifié contre l'apex réel de la zone : entrer
`home.example.com` avec une zone qui sert `apps.exemple.co` est refusé tout de
suite.

Les mêmes contrôles en ligne de commande :

```bash
npm run aws:check -- Z0123456ABCDEFGHIJK
```

Sonde les cinq appels que le code effectue réellement et dit lesquels
manquent. L'écriture est testée par un `DELETE` d'un enregistrement qui ne peut
pas exister : Route53 évalue IAM **avant** de valider le batch, donc un
principal autorisé reçoit `InvalidChangeBatch` et un principal refusé reçoit
`AccessDenied` — dans les deux cas la zone n'est pas modifiée.

Sonder bat la lecture de la politique : le document IAM est en général
illisible depuis une clé scopée, et une condition qui ne matche pas produit
exactement le même message qu'une instruction absente.

```
zone Z0123456ABCDEFGHIJK (us-east-1) — home.example.com

  OK      ListResourceRecordSets
  DENIED  GetHostedZone                    REQUIRED — used to read the delegation set…
  OK      GetChange
  DENIED  ChangeResourceRecordSets (TXT)   REQUIRED — DNS-01 is built on TXT records…
  OK      ChangeResourceRecordSets (A)
```

### Trois pièges qui produisent le même `AccessDenied`

Le message *« because no identity-based policy allows the … action »* ne veut
pas dire qu'il n'y a aucune politique : c'est aussi ce qu'AWS renvoie quand une
politique existe mais qu'une **condition ne matche pas**.

**1. `TXT` absent de `ChangeResourceRecordSetsRecordTypes`.** DNS-01 repose
entièrement sur des enregistrements TXT — sans ce type, rien ne peut être émis.
Une politique qui n'autorise que `A` laisse passer la publication de
l'enregistrement d'hôte et refuse tout le reste.

**2. Deux blocs `Condition` avec le même opérateur.** Le JSON ne garde que le
dernier, silencieusement :

```json
"Condition": {
  "ForAllValues:StringEquals": { "route53:ChangeResourceRecordSetsRecordTypes": ["TXT","A"] },
  "ForAllValues:StringEquals": { "route53:ChangeResourceRecordSetsActions": ["UPSERT","DELETE"] }
}
```

La contrainte sur les types disparaît. Fusionnez les clés dans **un seul** bloc
par opérateur.

**3. `GetHostedZone` oublié.** Souvent absent des politiques « minimales »
trouvées en ligne, parce que la plupart des clients ACME ne s'en servent pas.
local-cert en a besoin pour lire le delegation set et interroger les NS
autoritatifs — sans lui, l'émission échoue à l'étape de propagation, *après*
avoir écrit le TXT de challenge.

> Rappel : le marqueur de provenance TXT part dans le **même ChangeBatch** que
> l'enregistrement A. Une politique qui autorise `A` mais pas `TXT` fait donc
> échouer aussi la création du A. `TAG_RECORDS=0` supprime ce couplage.

Les credentials viennent de la chaîne AWS standard (env, `~/.aws/credentials`,
IRSA, rôle d'instance). Un `aws_role_arn` par domaine permet d'assumer un rôle
dédié par zone — utile en multi-comptes.

Vérifiez aussi l'enregistrement **CAA** de la zone : s'il existe, il doit
autoriser `letsencrypt.org`.

---

## Sécurité

- Mots de passe hachés en argon2id (19 MiB, t=2, p=1), paramètres portés par la
  chaîne PHC — les relever plus tard garde les anciens hashs vérifiables.
- Clés privées chiffrées en AES-256-GCM (`MASTER_KEY`) avant insertion en base.
  Elles ne transitent en clair que sur `/bundle`, avec le scope `cert:export`,
  et chaque export est tracé dans le journal d'audit.
- Toutes les mutations passent par `audit_log` (acteur, action, cible, IP).
- Webhooks signés HMAC-SHA256 (`X-Signature: sha256=…`, clé `WEBHOOK_SECRET`).
- Cookie de session `httpOnly` + `SameSite=lax` : pas de CSRF sur les endpoints
  mutants, le cookie n'étant jamais joint à un POST cross-site.
- La clé d'API de votre propre compte ne peut pas être supprimée depuis la
  console (la révoquer est possible, c'est réversible). Rotation via
  `scripts/reset-admin.ts`.
- Aucun secret n'est écrit sur disque : ni token, ni mot de passe, ni fichier
  d'amorçage.

**En production** : mettez l'application derrière un reverse proxy TLS. Elle
détient les clés privées de tout votre parc.

---

## Worker

Le worker d'émission et le planificateur de renouvellement tournent
**in-process**, démarrés par `instrumentation.ts`. Les ordres sont pris par
`UPDATE` conditionnel sur `locked_at`, et un verrou expiré est récupéré au bout
de 30 min.

Faites tourner **une seule instance** : Route53 sérialise les changements par
zone, deux workers concurrents se prendraient des `PriorRequestNotComplete`.
Pour scaler, passez à Postgres, lancez les instances web avec
`DISABLE_WORKER=1` et gardez un unique processus worker.

---

## Limites connues

- Tous les SAN d'un même ordre doivent appartenir à une seule zone gérée.
- Pas de compteur de rate limit Let's Encrypt côté application : un parc
  important peut se faire refuser par la CA. À ajouter si vous dépassez ~40
  certificats par semaine et par domaine enregistré.
- Le format d'export PKCS#12 n'est pas implémenté (JSON et PEM seulement).
- Les marqueurs de provenance doublent le nombre d'enregistrements créés dans la
  zone (un TXT par nom). C'est le prix de la propriété interrogeable, faute de
  tags sur les record sets ; `TAG_RECORDS=0` si vous préférez une zone épurée.
- Pas de rotation de `MASTER_KEY` : la changer rend illisibles les clés privées
  déjà stockées. Un renouvellement les régénère.
- Un seul compte administrateur, créé au setup. Pas de gestion multi-utilisateurs
  ni de changement de mot de passe depuis la console — la rotation passe par
  `scripts/reset-admin.ts`.
