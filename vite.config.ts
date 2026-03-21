import { defineConfig } from 'vite';

export default defineConfig({
  base: '/z80/',
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 8080,
  },
});
