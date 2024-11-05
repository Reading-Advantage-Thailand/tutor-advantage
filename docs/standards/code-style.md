# Code Style Guide

## General Principles

- Write clean, readable, and maintainable code
- Follow TypeScript best practices
- Maintain consistent formatting
- Write self-documenting code with clear naming

## TypeScript Guidelines

### Types and Interfaces

```typescript
// Use interfaces for object definitions
interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

// Use type for unions, intersections, and simple types
type UserRole = 'admin' | 'tutor' | 'student';
```

### Naming Conventions

- Use PascalCase for types, interfaces, and classes
- Use camelCase for variables, functions, and methods
- Use UPPER_CASE for constants
- Use descriptive names that explain purpose

### Functions

```typescript
// Use type annotations for parameters and return types
function calculateTutorCommission(sales: number, rate: number): number {
  return sales * rate;
}

// Use arrow functions for callbacks
const handleClick = (event: React.MouseEvent) => {
  event.preventDefault();
  // ...
};
```

## React Guidelines

### Component Structure

```typescript
// Use functional components with TypeScript
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  variant = "primary",
}) => {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick}>
      {label}
    </button>
  );
};
```

### Component Organization

- One component per file
- Group related components in directories
- Keep components focused and single-responsibility
- Extract reusable logic into custom hooks

### State Management

```typescript
// Use hooks for state management
const [isLoading, setIsLoading] = useState(false);

// Use reducers for complex state
const [state, dispatch] = useReducer(reducer, initialState);
```

## CSS/Tailwind Guidelines

### Class Organization

```tsx
// Group Tailwind classes by category
<div
  className={`
    // Layout
    flex flex-col
    // Spacing
    p-4 gap-2
    // Typography
    text-lg font-medium
    // Colors
    bg-white text-gray-900
    // Interactive
    hover:bg-gray-50
    // Responsive
    md:flex-row
  `}
>
```

### Custom Classes

- Use @layer for custom utilities
- Follow Tailwind's naming conventions
- Document complex utilities

## File Organization

### Directory Structure

```
src/
  components/
    common/      # Shared components
    features/    # Feature-specific components
    layouts/     # Layout components
  hooks/         # Custom hooks
  utils/         # Utility functions
  types/         # TypeScript types/interfaces
  styles/        # Global styles
  pages/         # Next.js pages
  api/           # API routes
```

### Import Order

1. External libraries
2. Internal modules
3. Components
4. Types
5. Styles

```typescript
// External imports
import React, { useState } from 'react';
import { motion } from 'framer-motion';

// Internal modules
import { api } from '@/lib/api';

// Components
import { Button } from '@/components/ui';

// Types
import type { User } from '@/types';

// Styles
import '@/styles/component.css';
```

## Testing Guidelines

### Test Structure

```typescript
describe('Component', () => {
  it('should render correctly', () => {
    // Arrange
    const props = {...};

    // Act
    render(<Component {...props} />);

    // Assert
    expect(screen.getByText('...')).toBeInTheDocument();
  });
});
```

### Testing Best Practices

- Write tests before implementation (TDD)
- Test behavior, not implementation
- Use meaningful test descriptions
- Keep tests focused and atomic
- Use appropriate matchers
- Mock external dependencies

## Git Commit Guidelines

### Commit Message Format

```
type(scope): subject

body

footer
```

### Types

- feat: New feature
- fix: Bug fix
- docs: Documentation changes
- style: Code style changes
- refactor: Code refactoring
- test: Adding tests
- chore: Build process or auxiliary tool changes

### Example

```
feat(auth): implement OAuth login

- Add Google OAuth provider
- Create auth callback handler
- Update user model with OAuth fields

Closes #123
```

## Code Review Guidelines

### Review Checklist

- Code follows style guide
- Tests are included and passing
- Documentation is updated
- No unnecessary complexity
- Error handling is appropriate
- Performance considerations
- Security best practices

### Review Comments

- Be constructive and specific
- Explain reasoning
- Suggest improvements
- Use inline code examples
- Reference documentation/resources
