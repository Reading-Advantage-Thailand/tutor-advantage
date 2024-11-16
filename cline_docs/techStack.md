# Technology Stack

## Frontend Architecture

### Core Framework

- **Next.js 15**
  - App Router for server-side rendering and routing
  - React Server Components for optimal performance
  - TypeScript for type safety
  - Edge Runtime support for global performance

### UI/UX

- **Styling & Components**
  - Tailwind CSS for utility-first styling
  - shadcn/ui for core components
  - Framer Motion for animations
  - next-themes for dark/light mode support

### State Management

- **Client State**
  - React Context for auth and theme
  - Zustand for complex client-side state
  - React Hook Form + Zod for form validation

### Internationalization

- **next-intl**
  - Supports Thai and English
  - Server-side translations
  - Automatic locale detection

## Backend Architecture

### API Layer

- **Next.js API Routes**
  - API Route Handlers for server endpoints
  - Edge API Routes for global performance
  - Route protection with NextAuth.js middleware

### Database

- **Primary Database**
  - PostgreSQL on Google Cloud SQL
  - Prisma ORM for type-safe database access
  - Connection pooling for scalability
- **Caching**
  - Redis for session storage and caching
  - Edge caching with Vercel/GCP CDN

### Authentication & Authorization

- **NextAuth.js**
  - JWT-based authentication
  - OAuth providers support
  - Role-based access control (RBAC)
  - Session management

## AI Integration

### Content Generation

- **OpenAI GPT Models**
  - GPT-4o for content generation
  - Content filtering and safety measures
  - Prompt engineering for CEFR alignment

### Learning Analytics

- **Custom ML Pipeline**
  - Student progress prediction
  - Content difficulty assessment
  - Personalization algorithms

## Infrastructure

### Cloud Platform

- **Google Cloud Platform (GCP)**
  - Cloud Run for containerized services
  - Cloud SQL for PostgreSQL
  - Cloud Storage for media
  - Cloud CDN for global content delivery
  - Cloud Build for CI/CD

### Monitoring & Analytics

- **Observability**
  - Sentry for error tracking
  - Google Analytics 4
  - Custom learning analytics dashboard
  - Performance monitoring with Web Vitals

### DevOps

- **CI/CD**
  - GitHub Actions for automation
  - Docker for containerization
  - Automated testing and deployment
  - Branch protection and review policies

## Testing Framework

### Testing Tools

- **Unit Testing**
  - Jest for component and utility testing
  - React Testing Library for component testing
- **E2E Testing**
  - Playwright for end-to-end testing
  - Cypress for integration testing

### Quality Assurance

- **Code Quality**
  - ESLint for code linting
  - Prettier for code formatting
  - TypeScript strict mode
  - Husky for pre-commit hooks

## Security Measures

### Data Protection

- **Encryption**
  - Data encryption at rest
  - HTTPS-only communication
  - Secure cookie handling
- **Compliance**
  - GDPR compliance tools
  - PDPA (Thai) compliance measures
  - Data anonymization utilities

### Access Control

- **Security Features**
  - Rate limiting
  - CORS configuration
  - CSP headers
  - Input validation and sanitization

## Development Tools

### Editor Configuration

- VS Code with standardized extensions
- EditorConfig for consistency
- Prettier integration
- ESLint integration

### Version Control

- Git with conventional commits
- GitHub for repository hosting
- Protected main branch
- Pull request templates

## Performance Optimization

### Core Web Vitals

- Next.js Image optimization
- Dynamic imports
- Route prefetching
- Asset optimization

### Caching Strategy

- Static page caching
- API response caching
- Asset caching
- Stale-while-revalidate patterns

## Deployment Architecture

### Environment Strategy

- Development environment
- Staging environment
- Production environment
- Feature branch deployments

### Scaling

- Horizontal scaling capability
- Load balancing
- Auto-scaling policies
- Geographic distribution

## Updates and Decisions Log

Last Updated: November 16, 2024

- Initial technology stack defined
- Selected Next.js 15 for core framework
- Chose GCP as cloud platform
- Implemented shadcn/ui component system

## Future Considerations

- WebAssembly for performance-critical features
- GraphQL API evolution
- Native mobile app development
- Real-time collaboration features
- WebRTC integration for video lessons
- Blockchain for certificate verification
- Progressive Web App (PWA) features
