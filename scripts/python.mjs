// Resolves the project virtual environment's Python on macOS, Linux and Windows.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function venvPython() {
  const candidates = [path.join(ROOT, '.venv', 'bin', 'python'), path.join(ROOT, '.venv', 'Scripts', 'python.exe')]
  const found = candidates.find((p) => fs.existsSync(p))
  if (!found) {
    console.error('No virtual environment found at .venv. Create it first (see backend/README.md).')
    process.exit(1)
  }
  return found
}
