#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const checks = [
  {
    path: 'README.md',
    requiredSnippets: [
      '## Stack seleccionado (Fase 1)',
      '## Estructura del monorepo',
      '## Estrategia de configuración y secretos',
      '## Gobernanza de datos (Fase 2)',
      '## Cimientos del repositorio y tooling (Fase 3)',
      '## Backend: foundation y módulos core (Fase 4)',
      '## Integraciones VTEX (Fase 5)'
    ]
  },
  {
    path: 'docs/plan_trabajo.md',
    requiredSnippets: ['## Fase 1 – Arquitectura técnica y diseño del repositorio']
  },
  {
    path: 'docs/arquitectura.md',
    requiredSnippets: ['## Componentes principales', '## Flujos clave']
  },
  {
    path: 'docs/modelo_datos.md',
    requiredSnippets: ['## Entidades principales', '### 12. **CommissionTransaction**']
  },
  {
    path: 'docs/politicas_legales.md',
    requiredSnippets: ['## Captura de consentimientos', '## Revocatoria y derechos ARCO']
  },
  {
    path: 'docs/operacion_conciliacion.md',
    requiredSnippets: ['## Flujo de conciliación diaria', '## Manejo de reversas']
  },
  {
    path: 'docs/seguridad_cumplimiento.md',
    requiredSnippets: ['## Gestión de identidades y accesos', '## Observabilidad y monitoreo']
  },
  {
    path: 'prisma/schema.prisma',
    requiredSnippets: ['datasource db', 'model Influencer', 'model CommissionTransaction']
  },
  {
    path: 'prisma/migrations/000_init/migration.sql',
    requiredSnippets: ['CREATE TABLE "Tenant"', 'CREATE TABLE "CommissionTransaction"']
  },
  {
    path: '.pnpm-workspace.yaml',
    requiredSnippets: ['packages:']
  },
  {
    path: 'tsconfig.json',
    requiredSnippets: ['"paths"']
  },
  {
    path: 'tsconfig.base.json',
    requiredSnippets: ['"compilerOptions"']
  },
  {
    path: '.eslintrc.cjs',
    requiredSnippets: ['parserOptions', 'plugins', 'extends']
  },
  {
    path: '.prettierrc',
    requiredSnippets: ['"singleQuote"']
  },
  {
    path: '.husky/pre-commit',
    requiredSnippets: ['pnpm lint-staged']
  },
  {
    path: '.github/workflows/ci.yml',
    requiredSnippets: ['pnpm lint', 'pnpm test']
  },
  {
    path: 'infrastructure/compose/docker-compose.yml',
    requiredSnippets: ['services:', 'postgres:', 'redis:']
  }
];

const requiredDirs = [
  'apps/api',
  'apps/web',
  'apps/worker',
  'packages/ui',
  'packages/vtex-client',
  'packages/domain',
  'infrastructure/docker',
  'infrastructure/compose',
  'prisma/migrations',
  '.github',
  '.husky'
];

const errors = [];

for (const check of checks) {
  const filePath = join(root, check.path);
  if (!existsSync(filePath)) {
    errors.push(`No se encontró el archivo requerido: ${check.path}`);
    continue;
  }
  const content = readFileSync(filePath, 'utf8');
  for (const snippet of check.requiredSnippets) {
    if (!content.includes(snippet)) {
      errors.push(`El archivo ${check.path} no contiene el texto esperado: "${snippet}"`);
    }
  }
}

for (const dir of requiredDirs) {
  const dirPath = join(root, dir);
  if (!existsSync(dirPath)) {
    errors.push(`No existe el directorio esperado: ${dir}`);
  }
}

if (errors.length > 0) {
  console.error('❌ Validaciones de documentación fallaron:');
  for (const err of errors) {
    console.error(` - ${err}`);
  }
  process.exit(1);
}

console.log('✅ Documentación y estructura verificada correctamente.');
