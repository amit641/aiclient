import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'aiclientjs',
  tagline: 'The lightweight, universal AI client for JavaScript & TypeScript.',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://amit641.github.io',
  baseUrl: '/aiclientjs/',

  organizationName: 'amit641',
  projectName: 'aiclientjs',

  onBrokenLinks: 'throw',

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
