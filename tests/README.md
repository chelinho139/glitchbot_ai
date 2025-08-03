# 🧪 GlitchBot Test Framework

A simple, lightweight testing framework for GlitchBot's GameFunctions and Workers.

## 📁 Structure

```
tests/
├── test-runner.ts           # Main test runner
├── helpers/
│   └── test-utils.ts        # Test utilities and assertions
├── functions/               # Function tests
│   ├── atomic/
│   │   ├── social/         # Social functions (fetch-mentions, etc.)
│   │   ├── analytics/      # Analytics functions
│   │   └── utilities/      # Utility functions
│   └── workflows/          # Workflow tests
├── workers/                # Worker tests
│   ├── twitter/           # Twitter workers
│   └── system/            # System workers
└── integration/           # End-to-end integration tests
```

## 🚀 Quick Start

### Run All Tests

```bash
npm test
```

### Run Specific Categories

```bash
npm run test:functions      # All function tests
npm run test:workers        # All worker tests
npm run test:integration    # All integration tests
```

### Run Individual Tests

```bash
npm run test:fetch-mentions  # Just fetch-mentions test
```

### Run with Pattern Matching

```bash
npm run test:pattern social  # All tests matching "social"
npm run test:pattern fetch   # All tests matching "fetch"
```

### Verbose Output

```bash
npm run test:verbose         # Detailed output for debugging
```

## ✍️ Writing Tests

### Basic Test Structure

```typescript
#!/usr/bin/env ts-node

import { createTestSuite, assert, testHelpers } from "../../helpers/test-utils";

const suite = createTestSuite("My Function Tests");

suite.beforeAll(() => {
  // Setup code - runs once before all tests
  testHelpers.loadTestEnv();
});

suite.test("should do something", async () => {
  // Your test code here
  assert.equals(actual, expected, "Optional error message");
});

suite.test("should handle errors", async () => {
  await assert.throws(() => {
    throw new Error("Expected error");
  });
});

// Run the suite
suite.run();
```

### Available Assertions

```typescript
assert.equals(actual, expected, message?)
assert.notEquals(actual, expected, message?)
assert.truthy(value, message?)
assert.falsy(value, message?)
assert.throws(fn, message?)
assert.contains(array, item, message?)
assert.hasProperty(obj, property, message?)
assert.isType(value, type, message?)
assert.greaterThan(actual, expected, message?)
assert.lessThan(actual, expected, message?)
```

### Test Helpers

```typescript
testHelpers.isTestEnv(); // Check if in test environment
testHelpers.wait(ms); // Wait for specified milliseconds
testHelpers.createMockLogger(); // Create a mock logger
testHelpers.loadTestEnv(); // Load and validate environment variables
```

## 📝 Test File Naming

- Function tests: `{function-name}.test.ts`
- Worker tests: `{worker-name}.test.ts`
- Integration tests: `{feature}.integration.test.ts`

## 🎯 Example: Testing a GameFunction

```typescript
#!/usr/bin/env ts-node

import {
  createTestSuite,
  assert,
  testHelpers,
} from "../../../helpers/test-utils";

// Import your function
const {
  default: myFunction,
} = require("../../../../src/functions/my-function");

const suite = createTestSuite("My GameFunction");

suite.beforeAll(() => {
  testHelpers.loadTestEnv();
});

suite.test("should return correct data structure", async () => {
  const result = await myFunction.executable(
    { param1: "value1" },
    (msg: string) => console.log(`[Log]: ${msg}`)
  );

  assert.equals(result.status, "done");
  assert.truthy(result.feedback);

  const data = JSON.parse(result.feedback);
  assert.hasProperty(data, "expectedProperty");
});

suite.test("should handle invalid input", async () => {
  const result = await myFunction.executable(
    { param1: "invalid" },
    (msg: string) => console.log(`[Log]: ${msg}`)
  );

  assert.equals(result.status, "failed");
});

suite.run();
```

## 🔧 Environment Setup

Tests automatically load environment variables from `.env`. Required variables:

- `GAME_TWITTER_TOKEN` - For Twitter API tests

## 🚀 Continuous Integration

Exit codes:

- `0` - All tests passed
- `1` - One or more tests failed

This makes it easy to integrate with CI/CD pipelines.

## 📊 Test Output

```bash
🚀 GlitchBot Test Runner
==================================================

📋 Found 1 test:
   tests/functions/atomic/social/fetch-mentions.test.ts

🏃 Running tests...

✅ tests/functions/atomic/social/fetch-mentions.test.ts (2341ms)

==================================================
📊 Test Summary:
   Total: 1
   ✅ Passed: 1
   ❌ Failed: 0
   ⏱️  Duration: 2341ms

🎉 All tests passed!
```

## 🔄 Adding New Tests

1. Create test file in appropriate directory
2. Use `.test.ts` suffix
3. Import test utilities
4. Write your tests using the framework
5. Run `npm test` to verify

The test runner will automatically discover and run your new tests!
