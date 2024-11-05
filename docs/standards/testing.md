# Testing Standards

## Overview

This document outlines the testing standards and requirements for the Tutor Advantage platform. Our testing strategy encompasses unit tests, integration tests, end-to-end tests, and performance testing.

## Testing Stack

- **Unit Testing**: Jest
- **Component Testing**: React Testing Library
- **E2E Testing**: Playwright
- **API Testing**: Supertest
- **Performance Testing**: Lighthouse

## Test Coverage Requirements

- Minimum 80% code coverage for all new code
- 100% coverage for critical paths:
  - Authentication flows
  - Payment processing
  - Data persistence operations
  - User privacy features

## Testing Principles

1. **Test Behavior, Not Implementation**

   - Focus on what the code does, not how it does it
   - Write tests that remain valid after refactoring
   - Test from the user's perspective

2. **Arrange-Act-Assert Pattern**

   ```typescript
   describe('TutorCommission', () => {
     it('calculates commission correctly', () => {
       // Arrange
       const sales = 1000;
       const rate = 0.1;

       // Act
       const commission = calculateTutorCommission(sales, rate);

       // Assert
       expect(commission).toBe(100);
     });
   });
   ```

3. **Test Isolation**
   - Each test should be independent
   - Clean up after each test
   - Use beforeEach/afterEach for setup/teardown

## Unit Testing Standards

### Component Testing

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders with correct label", () => {
    render(<Button label="Click me" onClick={() => {}} />);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const handleClick = jest.fn();
    render(<Button label="Click me" onClick={handleClick} />);

    fireEvent.click(screen.getByText("Click me"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Hook Testing

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import useCounter from './useCounter';

describe('useCounter', () => {
  it('increments counter', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });
});
```

## Integration Testing

### API Route Testing

```typescript
import { createMocks } from 'node-mocks-http';
import handler from './api/users';

describe('Users API', () => {
  it('creates a user successfully', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(201);
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: 'John Doe',
      })
    );
  });
});
```

## E2E Testing with Playwright

### Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('successful login flow', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[data-testid="email"]', 'user@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-name"]')).toContainText('John Doe');
  });
});
```

### Test Configuration

```typescript
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Chrome',
      use: { browserName: 'chromium' },
    },
    {
      name: 'Firefox',
      use: { browserName: 'firefox' },
    },
    {
      name: 'Safari',
      use: { browserName: 'webkit' },
    },
  ],
};

export default config;
```

## Performance Testing

### Lighthouse CI Configuration

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run start',
      url: ['http://localhost:3000'],
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

## Mocking Standards

### API Mocking

```typescript
// Mock API response
const mockApiResponse = {
  data: {
    id: '123',
    name: 'Test User',
  },
};

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve(mockApiResponse),
  })
);
```

### Component Mocking

```typescript
// Mock child component
jest.mock("./ChildComponent", () => {
  return {
    __esModule: true,
    default: () => <div data-testid="mocked-child">Mocked Child</div>,
  };
});
```

## Test Data Management

### Factories

```typescript
// User factory
import { Factory } from 'fishery';

const userFactory = Factory.define<User>(({ sequence }) => ({
  id: sequence.toString(),
  name: `User ${sequence}`,
  email: `user${sequence}@example.com`,
  role: 'student',
}));

// Usage
const user = userFactory.build();
const admin = userFactory.build({ role: 'admin' });
```

### Fixtures

```typescript
// fixtures/users.json
{
  "validUser": {
    "id": "123",
    "name": "Test User",
    "email": "test@example.com"
  }
}
```

## Continuous Integration

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
};
```

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

## Best Practices

1. **Naming Conventions**

   - Test files: `*.test.ts` or `*.spec.ts`
   - Test descriptions should be clear and descriptive
   - Use consistent naming patterns

2. **Test Organization**

   - Group related tests using describe blocks
   - Use beforeAll/beforeEach for setup
   - Use afterAll/afterEach for cleanup

3. **Assertions**

   - Use specific assertions
   - Avoid multiple assertions per test
   - Test edge cases and error conditions

4. **Code Quality**

   - Keep tests simple and readable
   - Don't test implementation details
   - Maintain DRY principle in test code

5. **Documentation**
   - Document test setup requirements
   - Include examples for complex test scenarios
   - Maintain testing documentation
