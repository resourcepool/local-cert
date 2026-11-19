/**
 * The docs table of contents. One entry per page; the slug is the path under
 * /admin/docs and the key of each language's content registry
 * (_content/<locale>/index.ts). Titles and summaries are translated: they live
 * in the `docsNav` messages, keyed by section id and slug.
 */

export const SECTIONS = [
  { id: 'start', slugs: ['', 'domains'] },
  { id: 'providers', slugs: ['providers', 'providers/aws', 'providers/ovh', 'providers/gandi', 'providers/godaddy', 'providers/gcp'] },
  { id: 'acme', slugs: ['acme', 'acme/clients'] },
  { id: 'proxies', slugs: ['acme/traefik', 'acme/caddy', 'acme/nginx', 'acme/apache', 'acme/haproxy', 'acme/nginx-proxy-manager'] },
  { id: 'platforms', slugs: ['acme/kubernetes', 'acme/dokploy', 'acme/coolify', 'acme/synology', 'acme/proxmox', 'acme/others'] },
] as const;

export type DocSectionId = (typeof SECTIONS)[number]['id'];
/** '' is the docs home */
export type DocSlug = (typeof SECTIONS)[number]['slugs'][number];

export const SLUGS: DocSlug[] = SECTIONS.flatMap((s) => [...s.slugs]);

export const hrefOf = (slug: string) => (slug ? `/admin/docs/${slug}` : '/admin/docs');
