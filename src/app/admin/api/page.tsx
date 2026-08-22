import { generateOpenApiDocument } from '@/lib/openapi';
import { ApiExplorer } from './api-explorer';

export const dynamic = 'force-dynamic';

export default function ApiPage() {
  // Generated server-side and embedded at render time, so the page works even
  // for a session that could not call /api/openapi.json.
  return <ApiExplorer spec={generateOpenApiDocument()} />;
}
