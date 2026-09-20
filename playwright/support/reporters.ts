import type { ReporterDescription } from '@playwright/test';

export function reporters(suite: 'local' | 'preview'): ReporterDescription[] {
  const result: ReporterDescription[] = [
    ['list'],
    ['html', { open: 'never' }],
  ];

  if (process.env.TESTDINO_TOKEN) {
    if (process.env.TESTDINO_CLI_CONFIG_PATH) {
      throw new Error('Use the project reporter configuration directly, without a CLI override.');
    }
    // The reporter reads its token from the environment, outside report options.
    result.push(['@testdino/playwright', {
      artifacts: false,
      debug: false,
      serverUrl: 'https://reporter.testdino.com',
      tags: ['velo', suite === 'local' ? 'local-mock' : 'preview'],
    }]);
  }

  return result;
}
