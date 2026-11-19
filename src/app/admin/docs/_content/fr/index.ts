import type { ComponentType } from 'react';
import type { DocSlug } from '../../_lib/nav';
import type { DocCtx } from '../../_lib/prose';
import Quickstart from './quickstart';
import AwsProvider from './aws';
import Providers from './providers';
import Ovh from './ovh';
import Gandi from './gandi';
import GoDaddy from './godaddy';
import Gcp from './gcp';
import Domains from './domains';
import Acme from './acme';
import Clients from './clients';
import Traefik from './traefik';
import Caddy from './caddy';
import Nginx from './nginx';
import Apache from './apache';
import Haproxy from './haproxy';
import NginxProxyManager from './npm';
import Kubernetes from './kubernetes';
import Dokploy from './dokploy';
import Coolify from './coolify';
import Synology from './synology';
import Proxmox from './proxmox';
import Others from './others';


/** slug (as in _lib/nav.ts) -> page body */
export const PAGES: Record<DocSlug, ComponentType<{ ctx: DocCtx }>> = {
  '': Quickstart,
  providers: Providers,
  'providers/aws': AwsProvider,
  'providers/ovh': Ovh,
  'providers/gandi': Gandi,
  'providers/godaddy': GoDaddy,
  'providers/gcp': Gcp,
  domains: Domains,
  acme: Acme,
  'acme/clients': Clients,
  'acme/traefik': Traefik,
  'acme/caddy': Caddy,
  'acme/nginx': Nginx,
  'acme/apache': Apache,
  'acme/haproxy': Haproxy,
  'acme/nginx-proxy-manager': NginxProxyManager,
  'acme/kubernetes': Kubernetes,
  'acme/dokploy': Dokploy,
  'acme/coolify': Coolify,
  'acme/synology': Synology,
  'acme/proxmox': Proxmox,
  'acme/others': Others,
};
