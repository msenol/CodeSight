/**
 * Utility functions for sample test project
 * Used to validate MCP indexing and search functionality
 */

// Basic utility functions
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function calculateTax(amount: number, rate: number): number {
  return amount * (rate / 100);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Class definitions
export class User {
  constructor(
    public id: string,
    public name: string,
    public email: string
  ) {}

  getDisplayName(): string {
    return `${this.name} <${this.email}>`;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email
    };
  }
}

export class UserManager {
  private users: User[] = [];

  addUser(user: User): void {
    this.users.push(user);
  }

  findUserById(id: string): User | undefined {
    return this.users.find(user => user.id === id);
  }

  getAllUsers(): User[] {
    return [...this.users];
  }

  removeUser(id: string): boolean {
    const index = this.users.findIndex(user => user.id === id);
    if (index !== -1) {
      this.users.splice(index, 1);
      return true;
    }
    return false;
  }
}

// Async functions
export async function fetchUserData(userId: string): Promise<User | null> {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 100));

  if (userId === 'test-user') {
    return new User(userId, 'Test User', 'test@example.com');
  }

  return null;
}

export async function validateUser(userData: {
  name: string;
  email: string;
}): Promise<boolean> {
  // Simulate validation
  await new Promise(resolve => setTimeout(resolve, 50));

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return userData.name.length > 0 && emailRegex.test(userData.email);
}

// Complex function with multiple patterns
export function processArray<T>(
  items: T[],
  options: {
    filter?: (item: T) => boolean;
    map?: (item: T) => any;
    sort?: (a: T, b: T) => number;
  } = {}
): any[] {
  let result = [...items];

  // Apply filter
  if (options.filter) {
    result = result.filter(options.filter);
  }

  // Apply map
  if (options.map) {
    result = result.map(options.map);
  }

  // Apply sort
  if (options.sort) {
    result.sort(options.sort);
  }

  return result;
}

// Error handling patterns
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateInput(input: any, rules: Record<string, any>): boolean {
  try {
    for (const [field, rule] of Object.entries(rules)) {
      if (rule.required && !input[field]) {
        throw new ValidationError(`Field ${field} is required`, field, input[field]);
      }

      if (rule.type && typeof input[field] !== rule.type) {
        throw new ValidationError(
          `Field ${field} must be of type ${rule.type}`,
          field,
          input[field]
        );
      }
    }
    return true;
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error(`Validation error: ${error.message}`);
      return false;
    }
    throw error;
  }
}

// Export types for type checking
export type ProcessedData<T> = {
  original: T;
  processed: any;
  timestamp: Date;
};

export interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Default export
export default {
  formatDate,
  calculateTax,
  debounce,
  User,
  UserManager,
  fetchUserData,
  validateUser,
  processArray,
  ValidationError,
  validateInput
};