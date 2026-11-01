/**
 * Imported by the pages that use the workspace (studio, dashboard, privacy). Loads the saved graph
 * and settings once, before those pages render, and saves later changes. Kept out of main.tsx so the
 * landing page bundle does not include the stores.
 */
import { workspacePersistence } from './persistence'

// ES modules are evaluated once, so this runs once however many pages import it.
if (typeof window !== 'undefined') workspacePersistence.start()
