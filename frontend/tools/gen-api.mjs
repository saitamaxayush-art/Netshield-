// Generates src/types/api.generated.ts from the FastAPI OpenAPI schema.
//   node scripts/gen-api.mjs          write the file
//   node scripts/gen-api.mjs --check  exit 1 if the committed file is out of date
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import openapiTS, { astToString } from 'openapi-typescript'
import { ROOT, venvPython } from '../../scripts/python.mjs'

const OUT = path.join(ROOT, 'frontend', 'src', 'types', 'api.generated.ts')
const HEADER = '// GENERATED FILE. Do not edit. Source: FastAPI OpenAPI schema (backend/main.py).\n// Regenerate with `npm run gen:api` in frontend/.\n\n'

const schema = JSON.parse(execFileSync(venvPython(), ['-m', 'backend.export_openapi'], { cwd: ROOT, encoding: 'utf8' }))
// defaultNonNullable: false keeps request fields that have a server default optional (callers may omit
// them). Response fields stay required: response models set json_schema_serialization_defaults_required.
const ast = await openapiTS(schema, { exportType: true, defaultNonNullable: false })
const next = HEADER + astToString(ast)

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''
  if (current !== next) {
    console.error('src/types/api.generated.ts is out of date with the backend OpenAPI schema. Run `npm run gen:api` in frontend/.')
    process.exit(1)
  }
  console.log('API types are up to date with the backend OpenAPI schema.')
} else {
  fs.writeFileSync(OUT, next)
  console.log(`Wrote ${path.relative(ROOT, OUT)}`)
}
