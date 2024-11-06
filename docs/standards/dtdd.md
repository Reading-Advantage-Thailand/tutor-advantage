# Design Test Driven Development (DTDD) Standards

## Overview

Design Test Driven Development (DTDD) extends traditional TDD by incorporating design considerations into the test-first approach. This document outlines DTDD best practices specifically for Next.js applications.

## Core DTDD Principles

1. **Design First, Test Second, Code Third**

   - Start with a clear component/feature design
   - Write tests that validate both design and functionality
   - Implement code that satisfies tests and design requirements

2. **Component-Centric Testing**

   ```typescript
   // Example: Button component DTDD process
   describe('Button Component Design', () => {
     it('matches design system specifications', () => {
       const { container } = render(<Button variant="primary" />);
       expect(container.firstChild).toHaveClass('bg-primary');
       expect(container.firstChild).toHaveClass('rounded-md');
       expect(container.firstChild).toHaveClass('px-4 py-2');
     });

     it('maintains accessibility standards', () => {
       render(<Button aria-label="Submit" />);
       expect(screen.getByRole('button')).toHaveAttribute('aria-label');
     });
   });
   ```

## DTDD Workflow for Next.js

### 1. Design Phase

```typescript
// 1. Define component interface
interface CardProps {
  title: string;
  description: string;
  imageUrl?: string;
  className?: string;
}

// 2. Write design test
describe('Card Component Design', () => {
  it('renders with design system tokens', () => {
    render(
      <Card
        title="Test Title"
        description="Test Description"
      />
    );

    const card = screen.getByTestId('card');
    expect(card).toHaveClass('rounded-lg shadow-md');
    expect(card).toHaveClass('bg-background');
  });
});
```

### 2. Behavioral Testing

```typescript
describe('Card Component Behavior', () => {
  it('handles image loading states correctly', () => {
    render(
      <Card
        title="Test"
        description="Test"
        imageUrl="/test.jpg"
      />
    );

    const image = screen.getByRole('img');
    expect(image).toHaveClass('opacity-0');
    fireEvent.load(image);
    expect(image).toHaveClass('opacity-100');
  });
});
```

### 3. Server Component Testing

```typescript
import { headers } from 'next/headers';

describe('ServerComponent', () => {
  it('handles server-side rendering correctly', async () => {
    const component = await ServerComponent();
    const html = renderToString(component);

    expect(html).toContain('data-ssr="true"');
    expect(html).toMatchSnapshot();
  });
});
```

## DTDD for Next.js Features

### 1. Route Handlers

```typescript
// app/api/users/route.ts
describe('Users API Design', () => {
  it('follows REST principles', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    await GET(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getHeaders()).toHaveProperty('content-type', 'application/json');
  });
});
```

### 2. Middleware

```typescript
describe('Authentication Middleware Design', () => {
  it('implements proper security headers', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/protected',
    });

    await middleware(req, res);
    expect(res._getHeaders()).toHaveProperty('x-frame-options', 'DENY');
    expect(res._getHeaders()).toHaveProperty('strict-transport-security');
  });
});
```

### 3. Layout Components

```typescript
describe('Layout Component Design', () => {
  it('maintains responsive design requirements', () => {
    const { container } = render(
      <RootLayout>
        <div>Content</div>
      </RootLayout>
    );

    expect(container.firstChild).toHaveClass('max-w-7xl mx-auto');
    expect(container.firstChild).toHaveClass('px-4 sm:px-6 lg:px-8');
  });
});
```

## Integration with Design Systems

### 1. Theme Testing

```typescript
describe('Theme Integration', () => {
  it('applies theme tokens correctly', () => {
    render(
      <ThemeProvider>
        <Component />
      </ThemeProvider>
    );

    const element = screen.getByTestId('themed-element');
    expect(element).toHaveStyle({
      backgroundColor: 'var(--background)',
      color: 'var(--foreground)',
    });
  });
});
```

### 2. Component Variants

```typescript
describe('Button Variants', () => {
  it.each([
    ['primary', 'bg-primary text-white'],
    ['secondary', 'bg-secondary text-gray-900'],
    ['ghost', 'bg-transparent hover:bg-gray-100'],
  ])('renders %s variant with correct styles', (variant, expectedClasses) => {
    render(<Button variant={variant}>Click me</Button>);
    expect(screen.getByRole('button')).toHaveClass(expectedClasses);
  });
});
```

## DTDD Best Practices

1. **Design System Integration**

   - Test component adherence to design tokens
   - Validate responsive behavior
   - Ensure accessibility compliance

2. **State Management**

   ```typescript
   describe('Component State Design', () => {
     it('handles loading states correctly', () => {
       const { rerender } = render(<Component loading={true} />);
       expect(screen.getByTestId('loader')).toBeVisible();

       rerender(<Component loading={false} />);
       expect(screen.queryByTestId('loader')).toBeNull();
     });
   });
   ```

3. **Error Boundaries**
   ```typescript
   describe('Error Boundary Design', () => {
     it('renders fallback UI according to design system', () => {
       const ThrowError = () => { throw new Error('Test'); };
       render(
         <ErrorBoundary>
           <ThrowError />
         </ErrorBoundary>
       );

       expect(screen.getByTestId('error-ui')).toHaveClass('bg-error-light');
       expect(screen.getByText('Something went wrong')).toBeVisible();
     });
   });
   ```

## Continuous Integration

1. **Design Token Validation**

   ```yaml
   # .github/workflows/design-validation.yml
   name: Design Validation
   on: [push, pull_request]

   jobs:
     validate:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v2
         - name: Install dependencies
           run: npm ci
         - name: Run design tests
           run: npm run test:design
   ```

2. **Visual Regression Testing**
   ```typescript
   describe('Visual Regression', () => {
     it('matches design snapshot', async () => {
       const { container } = render(<Component />);
       expect(await generateImage(container)).toMatchImageSnapshot();
     });
   });
   ```

## Documentation Requirements

1. **Design Decisions**

   - Document design system tokens used
   - Explain component variants
   - Detail responsive behavior

2. **Test Coverage**
   - Maintain 100% coverage for design-critical components
   - Document visual regression test cases
   - Track accessibility compliance

## Review Process

1. **Design Review**

   - Verify component matches design specifications
   - Validate accessibility requirements
   - Check responsive behavior

2. **Code Review**
   - Ensure test coverage meets DTDD standards
   - Verify design system integration
   - Validate error handling
