#!/usr/bin/env ts-node

/**
 * Simple Test Runner for GlitchBot Functions
 * Discovers and runs all .test.ts files in the tests directory
 */

import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";

interface TestResult {
  file: string;
  passed: boolean;
  duration: number;
  error: string | undefined;
}

class TestRunner {
  private results: TestResult[] = [];
  private verbose: boolean = false;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
  }

  /**
   * Discover all test files recursively
   */
  private discoverTests(dir: string): string[] {
    const tests: string[] = [];

    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          tests.push(...this.discoverTests(fullPath));
        } else if (item.endsWith(".test.ts") || item.endsWith(".test.js")) {
          tests.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't read
    }

    return tests;
  }

  /**
   * Run a single test file
   */
  private async runTest(testFile: string): Promise<TestResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      if (this.verbose) {
        console.log(`\n🧪 Running: ${testFile}`);
      }

      const child = spawn("npx", ["ts-node", testFile], {
        stdio: this.verbose ? "inherit" : "pipe",
        env: { ...process.env, NODE_ENV: "test" },
      });

      let stdout = "";
      let stderr = "";

      if (!this.verbose) {
        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });
      }

      child.on("close", (code) => {
        const duration = Date.now() - startTime;
        const passed = code === 0;

        resolve({
          file: testFile,
          passed,
          duration,
          error: passed ? undefined : stderr || stdout,
        });
      });
    });
  }

  /**
   * Run all discovered tests
   */
  async runAll(pattern?: string): Promise<void> {
    console.log("🚀 GlitchBot Test Runner");
    console.log("=".repeat(50));

    const allTests = this.discoverTests("./tests");
    const testsToRun = pattern
      ? allTests.filter((test) => test.includes(pattern))
      : allTests;

    if (testsToRun.length === 0) {
      console.log("📭 No tests found");
      if (pattern) {
        console.log(`   Pattern: ${pattern}`);
      }
      return;
    }

    console.log(
      `\n📋 Found ${testsToRun.length} test${
        testsToRun.length === 1 ? "" : "s"
      }:`
    );
    testsToRun.forEach((test) => {
      console.log(`   ${path.relative(".", test)}`);
    });

    console.log("\n🏃 Running tests...\n");

    // Run tests sequentially to avoid API rate limits
    for (const testFile of testsToRun) {
      const result = await this.runTest(testFile);
      this.results.push(result);

      const status = result.passed ? "✅" : "❌";
      const duration = `${result.duration}ms`;
      const fileName = path.relative(".", result.file);

      console.log(`${status} ${fileName} (${duration})`);

      if (!result.passed && !this.verbose) {
        console.log(`   Error: ${result.error}`);
      }
    }

    this.printSummary();
  }

  /**
   * Print test summary
   */
  private printSummary(): void {
    const total = this.results.length;
    const passed = this.results.filter((r) => r.passed).length;
    const failed = total - passed;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log("\n" + "=".repeat(50));
    console.log("📊 Test Summary:");
    console.log(`   Total: ${total}`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⏱️  Duration: ${totalDuration}ms`);

    if (failed > 0) {
      console.log("\n💥 Failed tests:");
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`   ❌ ${path.relative(".", r.file)}`);
        });
      process.exit(1);
    } else {
      console.log("\n🎉 All tests passed!");
    }
  }
}

// CLI interface
const args = process.argv.slice(2);
const pattern = args.find((arg) => !arg.startsWith("--"));
const verbose = args.includes("--verbose") || args.includes("-v");

const runner = new TestRunner(verbose);
runner.runAll(pattern).catch(console.error);
