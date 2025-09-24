import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  // By default, Docusaurus generates a sidebar from the docs folder structure
  tutorialSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/introduction',
        'getting-started/installation',
        'getting-started/quick-start',
        'getting-started/configuration',
      ],
    },
    {
      type: 'category',
      label: 'Core Concepts',
      items: [
        'concepts/architecture',
        'concepts/indexing',
        'concepts/searching',
        'concepts/mcp-protocol',
        'concepts/embeddings',
      ],
    },
    {
      type: 'category',
      label: 'Integration Guides',
      items: [
        'integration/claude-desktop',
        'integration/vscode',
        'integration/ci-cd',
        'integration/local-llm',
        'integration/large-monorepo',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/rest-endpoints',
        'api/mcp-tools',
        'api/authentication',
        'api/rate-limiting',
        'api/error-handling',
      ],
    },
    {
      type: 'category',
      label: 'Examples',
      items: [
        'examples/basic-search',
        'examples/semantic-analysis',
        'examples/security-audit',
        'examples/code-refactoring',
        'examples/performance-optimization',
      ],
    },
    {
      type: 'category',
      label: 'Advanced Topics',
      items: [
        'advanced/custom-parsers',
        'advanced/embedding-models',
        'advanced/performance-tuning',
        'advanced/plugin-development',
        'advanced/monitoring',
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: [
        'deployment/docker',
        'deployment/kubernetes',
        'deployment/cloud-platforms',
        'deployment/scaling',
        'deployment/security',
      ],
    },
    {
      type: 'category',
      label: 'Troubleshooting',
      items: [
        'troubleshooting/common-issues',
        'troubleshooting/performance',
        'troubleshooting/debugging',
        'troubleshooting/logs',
      ],
    },
    {
      type: 'category',
      label: 'Contributing',
      items: [
        'contributing/development-setup',
        'contributing/code-style',
        'contributing/testing',
        'contributing/documentation',
      ],
    },
  ],
};

export default sidebars;