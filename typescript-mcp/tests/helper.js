/**
 * Test Helper Functions
 *
 * Provides common test utilities for integration tests
 */

import { createFastifyServer } from '../src/server';

export function buildApp() {
  return createFastifyServer();
}