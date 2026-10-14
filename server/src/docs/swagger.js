import { readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import swaggerUi from 'swagger-ui-express';

const specPath = path.join(import.meta.dirname, 'openapi.yaml');
export const openapiSpec = YAML.parse(readFileSync(specPath, 'utf8'));

export const swaggerServe = swaggerUi.serve;
export const swaggerSetup = swaggerUi.setup(openapiSpec, {
  customSiteTitle: 'E-Commerce API Docs',
  swaggerOptions: {
    persistAuthorization: true,
  },
});