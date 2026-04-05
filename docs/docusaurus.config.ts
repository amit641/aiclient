import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'aiclientjs — Lightweight Universal AI Client for JavaScript',
  tagline: 'One function to call OpenAI, Anthropic, Google Gemini, and Ollama. Zero dependencies. Streaming, structured output, and tool calling built-in.',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://amit641.github.io',
  baseUrl: '/aiclientjs/',

  organizationName: 'amit641',
  projectName: 'aiclientjs',

  onBrokenLinks: 'throw',

  headTags: [
    {
      tagName: 'meta',
      attributes: {
        name: 'description',
        content: 'aiclientjs is a lightweight, zero-dependency AI client for JavaScript and TypeScript. Call OpenAI, Anthropic Claude, Google Gemini, and Ollama with one function. Supports streaming, structured output, tool calling, and runs on Node.js, Deno, Bun, and browsers.',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        name: 'keywords',
        content: 'aiclientjs, ai client javascript, openai sdk, anthropic sdk, llm client, ai api wrapper, javascript ai library, typescript ai, google gemini api, ollama javascript, streaming ai, structured output ai, tool calling llm, lightweight ai sdk, zero dependency ai',
      },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:title', content: 'aiclientjs — Lightweight Universal AI Client for JavaScript & TypeScript' },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:description', content: 'One function to call OpenAI, Anthropic, Google Gemini, and Ollama. Zero dependencies. Streaming, structured output, and tool calling.' },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:type', content: 'website' },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:url', content: 'https://amit641.github.io/aiclientjs/' },
    },
    {
      tagName: 'meta',
      attributes: { name: 'twitter:card', content: 'summary' },
    },
    {
      tagName: 'meta',
      attributes: { name: 'twitter:title', content: 'aiclientjs — Universal AI Client for JS/TS' },
    },
    {
      tagName: 'meta',
      attributes: { name: 'twitter:description', content: 'Call any LLM with one function. Zero dependencies. OpenAI, Anthropic, Google, Ollama.' },
    },
    {
      tagName: 'meta',
      attributes: { name: 'google-site-verification', content: 'pX4FkYybN5DcahiMv-TLXFKjgI277ld0HxGFbZAJR8Y' },
    },
  ],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl: 'https://github.com/amit641/aiclientjs/tree/main/docs/',
        },
        blog: false,
        sitemap: {
          lastmod: 'date',
          changefreq: 'weekly',
          priority: 0.5,
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'aiclientjs',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://www.npmjs.com/package/aiclientjs',
          label: 'npm',
          position: 'right',
        },
        {
          href: 'https://github.com/amit641/aiclientjs',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Getting Started', to: '/getting-started' },
            { label: 'Streaming', to: '/guides/streaming' },
            { label: 'Structured Output', to: '/guides/structured-output' },
            { label: 'Tool Calling', to: '/guides/tool-calling' },
          ],
        },
        {
          title: 'Links',
          items: [
            { label: 'GitHub', href: 'https://github.com/amit641/aiclientjs' },
            { label: 'npm', href: 'https://www.npmjs.com/package/aiclientjs' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} aiclientjs. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
