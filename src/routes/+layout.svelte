<script lang="ts">
  import '@fontsource/mansalva';
  import '@fontsource/dm-sans';
  import '@fontsource-variable/baloo-2';
  import '@fontsource/victor-mono';
  import 'normalize.css';
  import 'dracula-prism/dist/css/dracula-prism.min.css';

  import { page } from '$app/stores';
  import type { LayoutData } from './$types';
  import '../app.css';
  import TopBar from '$lib/components/TopBar.svelte';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import PageTransition from '$lib/components/PageTransition.svelte';
  import { browser, dev } from '$app/environment';
  import { onMount, type Snippet } from 'svelte';
  import { siteUrl } from '$lib/config';
  import { theme } from '$lib/stores/theme';

  interface Props {
    data: LayoutData;
    children: Snippet;
  }

  let { data, children }: Props = $props();

  // for page transitions
  let key = $derived(data.key);

  // goatcounter analytics
  $effect(() => {
    if (browser && window.goatcounter) {
      window.goatcounter.count({
        path: key,
        event: false,
      });
    }
  });

  const config = '{"allow_local": true, "no_onload": true}';

  onMount(() => {
    // add eventListener: listen for changes in the preferred theme from system
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        theme.set(e.matches ? 'dark' : 'light');
      });
  });

  const websiteSchema = {
    '@type': 'WebSite',
    url: siteUrl,
    name: $page.data.title,
    description: $page.data.description,
    publisher: `${siteUrl}/#/schema/person/Person`,
    inLanguage: 'es-ES',
  };
</script>

<svelte:head>
  <!-- gets `stuff (deprecated, now "page.data")` from page.
    title and description are either defined here (in the load fn) by default, or on the specific route -->
  <title>{$page.data.title}</title>
  <meta name="description" content={$page.data.description} />
  <link rel="canonical" href={$page.data.canonical} />
  <script
    data-goatcounter-settings={config}
    data-goatcounter="https://{dev ? 'rbn-dev' : 'rbn'}.goatcounter.com/count"
    async
    src="//gc.zgo.at/count.js"
  ></script>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html `<script type="application/ld+json">${JSON.stringify(websiteSchema)}${'<'}/script>`}
</svelte:head>

<!-- <SkipLink /> -->
<TopBar />

{#if $page.url.pathname !== '/'}
  <Header />
{/if}

<PageTransition refresh={key}>
  <main>
    {@render children()}
  </main>
</PageTransition>

<Footer />

<style>
  main {
    position: relative;
    display: grid;
    grid-template-columns:
      1fr min(var(--maxWidth), calc(100% - var(--gap50) * 2))
      1fr;
    grid-column-gap: var(--gap50);
    margin-top: var(--gap60);
    > :global(*) {
      grid-column: 2;
    }
  }
</style>
