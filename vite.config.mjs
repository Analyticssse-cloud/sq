import { defineConfig } from 'vite';

// The ported component files use a global `React` / `ReactDOM` (provided by src/globals.js,
// which runs first). esbuild's classic JSX transform compiles <jsx> to React.createElement,
// which resolves to that global — so the original files run unchanged, no per-file imports.
export default defineConfig({
  esbuild: {
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
  },
  server: {
  port: 5173,
  watch: { ignored: ['**/.netlify/**'] },
},
  build: { outDir: 'dist' },
});
