# Codebase Summary

## Project Structure Overview

```
src/
├── app/                    # Next.js 15 app directory
│   ├── [locale]/          # Internationalized routes
│   │   ├── about/         # About page
│   │   ├── login/         # Authentication pages
│   │   └── layout.tsx     # Root layout with providers
│   └── api/               # API routes
├── components/            # React components
│   ├── navigation/        # Navigation components
│   └── ui/               # shadcn/ui components
├── hooks/                # Custom React hooks
├── i18n/                 # Internationalization config
├── lib/                  # Utility functions
└── styles/              # Global styles
```

## Key Components and Their Interactions

### Core Application Structure

- **Root Layout** (`app/[locale]/layout.tsx`)
  - Handles internationalization setup
  - Configures font loading (Geist Sans/Mono)
  - Wraps application in necessary providers
  - Implements base layout structure

### Navigation System

- **Navbar** (`components/navigation/Navbar.tsx`)

  - Main navigation component
  - Integrates LocaleSwitcher
  - Handles responsive navigation
  - Uses internationalized links

- **LocaleSwitcher** (`components/navigation/LocaleSwitcher.tsx`)
  - Language selection interface
  - Supports EN, TH, ZH locales
  - Maintains language preferences

### Authentication Components

- **Login/Logout** (`components/Login.tsx`, `components/Logout.tsx`)
  - Handles authentication flow
  - Integrates with NextAuth.js
  - Manages user sessions

### UI Components

- **shadcn/ui Integration**
  - Comprehensive UI component library
  - Customized theme implementation
  - Accessible and responsive components

## Data Flow

### Authentication Flow

1. User authentication handled through NextAuth.js
2. GitHub provider currently implemented
3. Protected routes managed via middleware
4. Session management through NextAuth context

### Internationalization Flow

1. Locale detection in middleware
2. Route handling through next-intl
3. Translation loading based on locale
4. Client-side language switching

### Request Flow

1. Middleware intercepts requests
2. Checks authentication status
3. Handles locale routing
4. Forwards to appropriate handlers

## External Dependencies

### Core Dependencies

- Next.js 15 (App Router)
- next-intl for internationalization
- NextAuth.js for authentication
- shadcn/ui for components
- Tailwind CSS for styling

### Development Dependencies

- TypeScript for type safety
- ESLint & Prettier for code quality
- Custom hooks for shared logic

## Recent Significant Changes

### Authentication

- Implemented NextAuth.js with GitHub provider
- Added protected route middleware
- Created login/logout flow

### Internationalization

- Set up next-intl integration
- Added support for EN, TH, ZH locales
- Implemented locale switching
- Created translation structure

### UI/UX

- Integrated shadcn/ui components
- Implemented responsive navigation
- Added Geist font family
- Created base layout structure

## Current Development Status

### Completed Features

- Basic authentication flow
- Internationalization setup
- Core navigation structure
- UI component integration

### In Progress

- Enhanced session management
- Translation management workflow
- Additional authentication providers
- Route protection refinement

## Known Issues and Considerations

### Authentication

- Session management needs enhancement
- Additional providers pending
- Role-based access control needed

### Internationalization

- Translation workflow needs optimization
- Some untranslated strings remain
- Route mapping needs expansion

### Performance

- Font loading optimization needed
- Component lazy loading required
- Cache implementation pending

## Future Development Areas

### Short-term

- Complete authentication enhancements
- Finish translation coverage
- Implement remaining UI components

### Medium-term

- Add database integration
- Implement user profiles
- Enhance security measures

### Long-term

- Scale internationalization
- Add advanced features
- Optimize performance

## Updates and Revisions

Last Updated: November 16, 2024

- Initial codebase documentation
- Added authentication flow details
- Documented internationalization structure
- Listed known issues and considerations
