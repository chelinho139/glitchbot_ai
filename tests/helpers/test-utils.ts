/**
 * Test Utilities for GlitchBot Testing Framework
 */

export class TestSuite {
  private testName: string;
  private tests: Array<{ name: string; fn: () => Promise<void> | void }> = [];
  private setup?: () => Promise<void> | void;
  private teardown?: () => Promise<void> | void;

  constructor(name: string) {
    this.testName = name;
  }

  /**
   * Add a test case
   */
  test(name: string, fn: () => Promise<void> | void): void {
    this.tests.push({ name, fn });
  }

  /**
   * Setup function to run before all tests
   */
  beforeAll(fn: () => Promise<void> | void): void {
    this.setup = fn;
  }

  /**
   * Teardown function to run after all tests
   */
  afterAll(fn: () => Promise<void> | void): void {
    this.teardown = fn;
  }

  /**
   * Run all tests in this suite
   */
  async run(): Promise<void> {
    console.log(`\n🧪 ${this.testName}`);
    console.log("=".repeat(60));

    try {
      // Run setup
      if (this.setup) {
        await this.setup();
      }

      let passed = 0;
      let failed = 0;

      // Run tests
      for (const test of this.tests) {
        try {
          console.log(`\n📋 ${test.name}`);
          console.log("-".repeat(40));

          await test.fn();

          console.log("✅ PASS");
          passed++;
        } catch (error) {
          console.log("❌ FAIL");
          if (error instanceof Error) {
            console.log(`   Error: ${error.message}`);
          } else {
            console.log(`   Error: ${String(error)}`);
          }
          failed++;
        }
      }

      // Run teardown
      if (this.teardown) {
        await this.teardown();
      }

      // Summary
      console.log(`\n🎯 ${this.testName} Results:`);
      console.log(`   ✅ Passed: ${passed}`);
      console.log(`   ❌ Failed: ${failed}`);

      if (failed > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error("💥 Test suite setup/teardown failed:", error);
      process.exit(1);
    }
  }
}

/**
 * Assertion helpers
 */
export const assert = {
  equals: (actual: any, expected: any, message?: string) => {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  },

  notEquals: (actual: any, expected: any, message?: string) => {
    if (actual === expected) {
      throw new Error(message || `Expected not ${expected}, but got ${actual}`);
    }
  },

  truthy: (value: any, message?: string) => {
    if (!value) {
      throw new Error(message || `Expected truthy value, got ${value}`);
    }
  },

  falsy: (value: any, message?: string) => {
    if (value) {
      throw new Error(message || `Expected falsy value, got ${value}`);
    }
  },

  throws: async (fn: () => Promise<any> | any, message?: string) => {
    try {
      await fn();
      throw new Error(message || "Expected function to throw, but it did not");
    } catch (error) {
      // Expected
    }
  },

  contains: (array: any[], item: any, message?: string) => {
    if (!array.includes(item)) {
      throw new Error(message || `Expected array to contain ${item}`);
    }
  },

  hasProperty: (obj: any, property: string, message?: string) => {
    if (!(property in obj)) {
      throw new Error(
        message || `Expected object to have property ${property}`
      );
    }
  },

  isType: (value: any, type: string, message?: string) => {
    if (typeof value !== type) {
      throw new Error(message || `Expected type ${type}, got ${typeof value}`);
    }
  },

  greaterThan: (actual: number, expected: number, message?: string) => {
    if (actual <= expected) {
      throw new Error(
        message || `Expected ${actual} to be greater than ${expected}`
      );
    }
  },

  lessThan: (actual: number, expected: number, message?: string) => {
    if (actual >= expected) {
      throw new Error(
        message || `Expected ${actual} to be less than ${expected}`
      );
    }
  },
};

/**
 * Test environment helpers
 */
export const testHelpers = {
  /**
   * Check if we're in test environment
   */
  isTestEnv: (): boolean => {
    return process.env.NODE_ENV === "test";
  },

  /**
   * Wait for a specified time
   */
  wait: (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * Create a mock logger
   */
  createMockLogger: () => {
    const logs: string[] = [];
    return {
      log: (msg: string) => logs.push(msg),
      getLogs: () => [...logs],
      clear: () => logs.splice(0, logs.length),
    };
  },

  /**
   * Load environment variables for testing
   */
  loadTestEnv: () => {
    require("dotenv").config();

    // Verify critical env vars
    const required = ["GAME_TWITTER_TOKEN"];
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}`
      );
    }
  },
};

/**
 * Create a test suite (convenience function)
 */
export function createTestSuite(name: string): TestSuite {
  return new TestSuite(name);
}
