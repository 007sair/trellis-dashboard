import { test as base, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createFixture } from '../fixtures.js';
import { findProject } from '../../src/server/project.js';
import { startServer } from '../../src/server/http.js';

export const test = base.extend<{ dashboard: { root: string; url: string } }>({
  dashboard: async ({}, use) => {
    const fixture = await createFixture();
    const server = await startServer({ project: await findProject(fixture.root), port: 0, clientDir: fileURLToPath(new URL('../../dist/client', import.meta.url)) });
    try { await use({ root: fixture.root, url: server.url }); }
    finally { await server.close(); await fixture.cleanup(); }
  },
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(page);
    expect(errors, 'No unhandled browser JavaScript errors').toEqual([]);
  },
});

export { expect };
