import { mdsvex } from 'mdsvex';
import preprocess from 'svelte-preprocess';
import netlify from '@sveltejs/adapter-netlify';
import mdsvexConfig from './mdsvex.config.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', ...mdsvexConfig.extensions],
  preprocess: [
    preprocess({
      scss: {
        prependData: '@use "src/variables.scss";',
      },
    }),
    mdsvex(mdsvexConfig),
  ],
  kit: {
    adapter: netlify(),
    // hydrate the <div id="svelte"> element in src/app.html
    target: '#svelte',
    vite: {
      css: {
        preprocessorOptions: {
          scss: {
            additionalData: '@use "src/variables.scss";',
          },
        },
      },
    },
  },
};

export default config;
