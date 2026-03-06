import fs from 'fs';
import path from 'path';
import swaggerSpecs from '../swagger';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface ProtectedRoute {
  method: HttpMethod;
  expressPath: string;
  openApiPath: string;
}

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

function toOpenApiPath(expressPath: string): string {
  return expressPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function getProtectedRoutesFromIndex(): ProtectedRoute[] {
  const indexPath = path.resolve(__dirname, '..', 'index.ts');
  const source = fs.readFileSync(indexPath, 'utf8');

  const regex = /app\.(get|post|put|patch|delete)\(\s*'([^']+)'\s*,\s*authMiddleware\b/g;
  const routes: ProtectedRoute[] = [];
  let match: RegExpExecArray | null = regex.exec(source);

  while (match !== null) {
    const method = match[1] as HttpMethod;
    const expressPath = match[2];

    if (!HTTP_METHODS.includes(method)) {
      match = regex.exec(source);
      continue;
    }

    routes.push({
      method,
      expressPath,
      openApiPath: toOpenApiPath(expressPath),
    });

    match = regex.exec(source);
  }

  return routes;
}

describe('OpenAPI auth coverage', () => {
  it('documents every protected route with bearerAuth security', () => {
    const protectedRoutes = getProtectedRoutesFromIndex();

    expect(protectedRoutes.length).toBeGreaterThan(0);

    const missing: string[] = [];
    const paths = (swaggerSpecs as any).paths ?? {};

    for (const route of protectedRoutes) {
      const operation = paths?.[route.openApiPath]?.[route.method];

      if (!operation) {
        missing.push(`${route.method.toUpperCase()} ${route.expressPath} -> missing path/method in OpenAPI`);
        continue;
      }

      const hasBearerAuth = Array.isArray(operation.security)
        && operation.security.some((scheme: Record<string, unknown>) => Object.prototype.hasOwnProperty.call(scheme, 'bearerAuth'));

      if (!hasBearerAuth) {
        missing.push(`${route.method.toUpperCase()} ${route.expressPath} -> missing security.bearerAuth`);
      }
    }

    expect(missing).toEqual([]);
  });
});
