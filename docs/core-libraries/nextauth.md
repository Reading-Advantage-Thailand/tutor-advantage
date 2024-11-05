# NextAuth.js Documentation

## Overview

NextAuth.js is our authentication solution for the Tutor Advantage platform. This document outlines our implementation patterns, security practices, and user session management.

## Setup and Configuration

### 1. Basic Configuration

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/lib/auth-config';

const handler = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/login',
    signUp: '/auth/register',
    error: '/auth/error',
    verifyRequest: '/auth/verify',
  },
  providers: [
    // Credentials provider for email/password
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Implement user verification
        return user;
      },
    }),
    // OAuth providers
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
  },
});

export { handler as GET, handler as POST };
```

### 2. Environment Variables

```env
# .env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# OAuth providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Implementation Patterns

### 1. Protected Routes

```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized: ({ req, token }) => {
      // Protect routes based on path and user role
      const path = req.nextUrl.pathname;

      if (path.startsWith('/admin')) {
        return token?.role === 'ADMIN';
      }

      if (path.startsWith('/tutor')) {
        return token?.role === 'TUTOR';
      }

      return !!token;
    },
  },
});

export const config = {
  matcher: ['/admin/:path*', '/tutor/:path*', '/dashboard/:path*'],
};
```

### 2. Authentication Components

```typescript
// components/auth/LoginForm.tsx
"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      const result = await signIn("credentials", {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid credentials");
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      setError("An error occurred");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-500">{error}</div>}
      <div>
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          required
          className="w-full p-2 border rounded"
        />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input
          type="password"
          id="password"
          name="password"
          required
          className="w-full p-2 border rounded"
        />
      </div>
      <button
        type="submit"
        className="w-full bg-primary text-white p-2 rounded"
      >
        Log In
      </button>
    </form>
  );
}
```

### 3. Session Management

```typescript
// components/auth/SessionProvider.tsx
"use client";

import { SessionProvider } from "next-auth/react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

// hooks/useAuth.ts
import { useSession } from "next-auth/react";

export function useAuth() {
  const { data: session, status } = useSession();

  return {
    user: session?.user,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    role: session?.user?.role,
  };
}
```

## Security Practices

### 1. Password Handling

```typescript
// lib/auth/password.ts
import { hash, compare } from 'bcryptjs';

export const hashPassword = async (password: string): Promise<string> => {
  return hash(password, 12);
};

export const verifyPassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return compare(password, hashedPassword);
};

// Usage in auth handler
async authorize(credentials) {
  const user = await prisma.user.findUnique({
    where: { email: credentials.email }
  });

  if (!user) {
    throw new Error('User not found');
  }

  const isValid = await verifyPassword(
    credentials.password,
    user.passwordHash
  );

  if (!isValid) {
    throw new Error('Invalid password');
  }

  return user;
}
```

### 2. CSRF Protection

```typescript
// middleware.ts
import { csrf } from '@/lib/csrf';

export async function middleware(request: NextRequest) {
  // Verify CSRF token for mutation requests
  if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
    const token = request.headers.get('x-csrf-token');
    if (!token || !(await csrf.verify(token))) {
      return new Response('Invalid CSRF token', { status: 403 });
    }
  }
}
```

## Role-Based Access Control

### 1. Role Guards

```typescript
// lib/auth/guards.ts
import { getSession } from 'next-auth/react';

export const withRole = (role: string | string[]) => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getSession({ req });

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const roles = Array.isArray(role) ? role : [role];
    if (!roles.includes(session.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  };
};

// Usage in API route
export default withRole(['ADMIN', 'TUTOR'])(async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Protected route logic
});
```

### 2. Component-Level Protection

```typescript
// components/auth/RoleGuard.tsx
import { useAuth } from "@/hooks/useAuth";

interface RoleGuardProps {
  roles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({
  roles,
  children,
  fallback = null,
}: RoleGuardProps) {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!role || !roles.includes(role)) {
    return fallback;
  }

  return children;
}

// Usage
<RoleGuard roles={["ADMIN"]}>
  <AdminPanel />
</RoleGuard>;
```

## Testing

### 1. Authentication Testing

```typescript
// __tests__/auth.test.ts
import { render, screen, fireEvent } from "@testing-library/react";
import { signIn } from "next-auth/react";
import { LoginForm } from "@/components/auth/LoginForm";

jest.mock("next-auth/react");

describe("LoginForm", () => {
  it("handles successful login", async () => {
    (signIn as jest.Mock).mockResolvedValueOnce({
      error: null,
      ok: true,
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });

    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "test@example.com",
      password: "password123",
      redirect: false,
    });
  });
});
```

### 2. Protected Route Testing

```typescript
// __tests__/middleware.test.ts
import { createMocks } from 'node-mocks-http';
import middleware from '@/middleware';

describe('Auth Middleware', () => {
  it('protects admin routes', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/admin/dashboard',
    });

    await middleware(req, res);

    expect(res._getStatusCode()).toBe(401);
  });
});
```

## Error Handling

### 1. Authentication Errors

```typescript
// lib/auth/errors.ts
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export const authErrors = {
  invalidCredentials: new AuthError('Invalid email or password', 'INVALID_CREDENTIALS'),
  accountLocked: new AuthError('Account is locked', 'ACCOUNT_LOCKED', 403),
  sessionExpired: new AuthError('Session has expired', 'SESSION_EXPIRED'),
};
```

### 2. Error Pages

```typescript
// app/auth/error/page.tsx
"use client";

import { useSearchParams } from "next/navigation";

export default function AuthError() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The verification link has expired or has already been used.",
    Default: "An error occurred during authentication.",
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-red-500">Authentication Error</h1>
      <p className="mt-2">
        {errorMessages[error as string] || errorMessages.Default}
      </p>
    </div>
  );
}
```

## Monitoring and Logging

### 1. Auth Events

```typescript
// lib/auth/monitoring.ts
export const authEvents = {
  async logLogin(userId: string, success: boolean, metadata?: any) {
    await prisma.authEvent.create({
      data: {
        userId,
        type: 'LOGIN',
        success,
        metadata,
        timestamp: new Date(),
      },
    });
  },

  async logPasswordReset(userId: string, success: boolean) {
    await prisma.authEvent.create({
      data: {
        userId,
        type: 'PASSWORD_RESET',
        success,
        timestamp: new Date(),
      },
    });
  },
};
```

### 2. Session Monitoring

```typescript
// lib/auth/session-monitor.ts
export const sessionMonitor = {
  async trackSession(sessionId: string, userId: string) {
    await prisma.activeSession.create({
      data: {
        sessionId,
        userId,
        lastActivity: new Date(),
      },
    });
  },

  async updateActivity(sessionId: string) {
    await prisma.activeSession.update({
      where: { sessionId },
      data: { lastActivity: new Date() },
    });
  },
};
```
