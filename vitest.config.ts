import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Node-style unit tests by default (parsing, merge, file I/O). Component
    // tests opt into jsdom with a `@vitest-environment jsdom` docblock at the
    // top of the file.
    //
    // This used to use `environmentMatchGlobs: [['src/renderer/**','jsdom']]`,
    // which silently never matched on Windows: vitest resolves the pattern with
    // `path.resolve`, producing backslashes that micromatch reads as escape
    // characters. Every component test then ran in `node` and failed on
    // `document is not defined`. The docblock is checked before the globs and
    // is platform-independent.
    environment: 'node',
    setupFiles: ['src/test-setup.ts'],
  },
})
