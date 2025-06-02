import { build } from 'bun';

await build({
  entrypoints: ['./src/main.ts'],
  outdir: './out',
});
