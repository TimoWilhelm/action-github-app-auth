import { defineConfig } from 'tsup';

export default defineConfig({
  splitting: false,
  platform: 'node',
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: 'cjs',
  tsconfig: 'tsconfig.json',
  minify: true,
  sourcemap: true,
  noExternal: [/.*/], // Bundle all dependencies
});
