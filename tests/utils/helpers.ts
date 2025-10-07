export async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxAttempts) {
        throw lastError;
      }
      await wait(delay * attempt); // Exponential backoff
    }
  }

  throw lastError!;
}

export function generateRequestId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function createMCPMessage(method: string, params?: any, id?: string): any {
  return {
    jsonrpc: '2.0',
    id: id || generateRequestId(),
    method,
    params,
  };
}

export function createMCPRequest(request: any): string {
  return JSON.stringify(request) + '\n';
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 5000,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

export function sanitizeLogData(data: any): any {
  if (typeof data === 'string') {
    return data.replace(/password/i, '*****').replace(/token/i, '*****');
  }
  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data };
    if (sanitized.password) {sanitized.password = '*****';}
    if (sanitized.token) {sanitized.token = '*****';}
    if (sanitized.apiKey) {sanitized.apiKey = '*****';}
    return sanitized;
  }
  return data;
}

export function createTestWorkspace(name: string, files: Record<string, string>): string {
  const path = require('path');
  const fs = require('fs');

  const workspaceDir = path.join(process.cwd(), 'tests', 'workspaces', name);

  // Create directory if it doesn't exist
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }

  // Create files
  Object.entries(files).forEach(([filePath, content]) => {
    const fullPath = path.join(workspaceDir, filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content);
  });

  return workspaceDir;
}

export function cleanupTestWorkspace(name: string): void {
  const path = require('path');
  const fs = require('fs');

  const workspaceDir = path.join(process.cwd(), 'tests', 'workspaces', name);

  if (fs.existsSync(workspaceDir)) {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
}

export interface TestResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: Error;
}

export function createTestResult(success: boolean, message?: string, data?: any, error?: Error): TestResult {
  return { success, message, data, error };
}

export function expectSuccess(result: TestResult): asserts result is TestResult & { success: true } {
  expect(result.success).toBe(true);
  if (!result.success) {
    throw new Error(result.message || 'Test failed');
  }
}

export function expectFailure(result: TestResult): asserts result is TestResult & { success: false } {
  expect(result.success).toBe(false);
}