# Prisma Documentation

## Overview

Prisma is our ORM (Object-Relational Mapping) solution for database interactions. This document outlines our implementation standards, schema design, and best practices for the Tutor Advantage platform.

## Schema Standards

### 1. Base Schema Structure

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Base model for tracking creation and updates
model BaseModel {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// User model with role-based access
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String
  role          UserRole  @default(STUDENT)
  passwordHash  String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  profile       Profile?
  enrollments   Enrollment[]
  tutorProfile  TutorProfile?
  earnings      Earning[]
  referrals     Referral[]

  @@index([email])
}

enum UserRole {
  ADMIN
  TUTOR
  STUDENT
}
```

### 2. Learning System Models

```prisma
model Course {
  id          String   @id @default(cuid())
  title       String
  description String
  level       Level
  price       Decimal  @db.Decimal(10, 2)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  lessons     Lesson[]
  enrollments Enrollment[]
  tutors      TutorCourse[]

  @@index([level])
}

model Lesson {
  id          String   @id @default(cuid())
  title       String
  content     String   @db.Text
  duration    Int      // in minutes
  courseId    String
  order       Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  course      Course     @relation(fields: [courseId], references: [id])
  progress    Progress[]

  @@unique([courseId, order])
  @@index([courseId])
}

enum Level {
  BEGINNER
  INTERMEDIATE
  ADVANCED
}
```

### 3. MLM System Models

```prisma
model TutorProfile {
  id            String   @id @default(cuid())
  userId        String   @unique
  bio           String   @db.Text
  specialties   String[]
  hourlyRate    Decimal  @db.Decimal(10, 2)
  referralCode  String   @unique
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  user          User          @relation(fields: [userId], references: [id])
  courses       TutorCourse[]
  referrals     Referral[]    @relation("Referrer")
  upline        Referral?     @relation("Upline")
  downline      Referral[]    @relation("Downline")
  earnings      Earning[]

  @@index([referralCode])
}

model Referral {
  id            String   @id @default(cuid())
  referrerId    String
  referredId    String
  status        ReferralStatus
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  referrer      TutorProfile @relation("Referrer", fields: [referrerId], references: [id])
  referred      User         @relation(fields: [referredId], references: [id])

  @@unique([referrerId, referredId])
  @@index([referrerId])
  @@index([referredId])
}

enum ReferralStatus {
  PENDING
  ACTIVE
  INACTIVE
}
```

## Implementation Patterns

### 1. Repository Pattern

```typescript
// lib/repositories/base.repository.ts
export class BaseRepository<T> {
  constructor(protected prisma: PrismaClient) {}

  async findById(id: string): Promise<T | null> {
    return this.prisma[this.model].findUnique({
      where: { id },
    });
  }

  async create(data: Prisma.ArgType<T, "create">): Promise<T> {
    return this.prisma[this.model].create({
      data,
    });
  }

  async update(id: string, data: Prisma.ArgType<T, "update">): Promise<T> {
    return this.prisma[this.model].update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<T> {
    return this.prisma[this.model].delete({
      where: { id },
    });
  }
}

// lib/repositories/user.repository.ts
export class UserRepository extends BaseRepository<User> {
  protected model = "user";

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async createWithProfile(
    data: Prisma.UserCreateInput & { profile: Prisma.ProfileCreateInput }
  ): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...data,
        profile: {
          create: data.profile,
        },
      },
      include: {
        profile: true,
      },
    });
  }
}
```

### 2. Service Layer Pattern

```typescript
// lib/services/enrollment.service.ts
export class EnrollmentService {
  constructor(
    private prisma: PrismaClient,
    private userRepo: UserRepository,
    private courseRepo: CourseRepository
  ) {}

  async enrollStudent(userId: string, courseId: string): Promise<Enrollment> {
    return this.prisma.$transaction(async (tx) => {
      // Check if user exists
      const user = await tx.user.findUnique({
        where: { id: userId },
      });
      if (!user) throw new Error("User not found");

      // Check if course exists and has available slots
      const course = await tx.course.findUnique({
        where: { id: courseId },
        include: { enrollments: true },
      });
      if (!course) throw new Error("Course not found");
      if (course.enrollments.length >= course.maxStudents) {
        throw new Error("Course is full");
      }

      // Create enrollment
      return tx.enrollment.create({
        data: {
          userId,
          courseId,
          status: "ACTIVE",
        },
        include: {
          user: true,
          course: true,
        },
      });
    });
  }
}
```

### 3. Query Optimization

```typescript
// lib/queries/course.queries.ts
export const getCourseWithDetails = async (
  courseId: string
): Promise<CourseDetails> => {
  return prisma.course.findUnique({
    where: { id: courseId },
    include: {
      lessons: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          duration: true,
          order: true,
        },
      },
      tutors: {
        include: {
          tutor: {
            select: {
              id: true,
              name: true,
              profile: {
                select: {
                  bio: true,
                  specialties: true,
                },
              },
            },
          },
        },
      },
      _count: {
        select: {
          enrollments: true,
        },
      },
    },
  });
};
```

## Best Practices

### 1. Error Handling

```typescript
// lib/errors/prisma-error-handler.ts
export class PrismaErrorHandler {
  static handle(error: Error): ApplicationError {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2002":
          return new UniqueConstraintError(error.meta?.target as string[]);
        case "P2025":
          return new RecordNotFoundError();
        case "P2003":
          return new ForeignKeyError();
        default:
          return new DatabaseError(error.message);
      }
    }
    return new UnknownError(error.message);
  }
}

// Usage
try {
  await prisma.user.create({ data });
} catch (error) {
  throw PrismaErrorHandler.handle(error);
}
```

### 2. Middleware

```typescript
// lib/prisma-middleware.ts
export const setupPrismaMiddleware = (prisma: PrismaClient) => {
  // Logging middleware
  prisma.$use(async (params, next) => {
    const before = Date.now();
    const result = await next(params);
    const after = Date.now();

    console.log(
      `Query ${params.model}.${params.action} took ${after - before}ms`
    );
    return result;
  });

  // Soft delete middleware
  prisma.$use(async (params, next) => {
    if (params.action === "delete") {
      params.action = "update";
      params.args.data = { deleted: true };
    }
    if (params.action === "deleteMany") {
      params.action = "updateMany";
      if (params.args.data !== undefined) {
        params.args.data.deleted = true;
      } else {
        params.args.data = { deleted: true };
      }
    }
    return next(params);
  });
};
```

### 3. Validation

```typescript
// lib/validators/schema.validator.ts
import { z } from "zod";

export const UserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(["ADMIN", "TUTOR", "STUDENT"]),
  password: z.string().min(8),
});

export const CourseSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  price: z.number().positive(),
});

// Usage
const validateUser = (data: unknown) => {
  return UserSchema.parse(data);
};
```

## Testing

### 1. Test Setup

```typescript
// tests/helpers/prisma-test-context.ts
import { PrismaClient } from "@prisma/client";
import { mockDeep, DeepMockProxy } from "jest-mock-extended";

export type Context = {
  prisma: PrismaClient;
};

export type MockContext = {
  prisma: DeepMockProxy<PrismaClient>;
};

export const createMockContext = (): MockContext => {
  return {
    prisma: mockDeep<PrismaClient>(),
  };
};

// Usage in tests
describe("UserService", () => {
  let mockContext: MockContext;
  let userService: UserService;

  beforeEach(() => {
    mockContext = createMockContext();
    userService = new UserService(mockContext.prisma);
  });

  it("creates a user", async () => {
    const user = {
      email: "test@example.com",
      name: "Test User",
    };

    mockContext.prisma.user.create.mockResolvedValue(user);

    await expect(userService.createUser(user)).resolves.toEqual(user);
  });
});
```

### 2. Integration Tests

```typescript
// tests/integration/user.test.ts
import { PrismaClient } from "@prisma/client";
import { UserService } from "@/services/user.service";

describe("UserService Integration", () => {
  let prisma: PrismaClient;
  let userService: UserService;

  beforeAll(async () => {
    prisma = new PrismaClient();
    userService = new UserService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  it("creates and retrieves a user", async () => {
    const userData = {
      email: "test@example.com",
      name: "Test User",
      role: "STUDENT",
    };

    const createdUser = await userService.createUser(userData);
    const retrievedUser = await userService.findById(createdUser.id);

    expect(retrievedUser).toMatchObject(userData);
  });
});
```

## Performance Optimization

### 1. Query Optimization

```typescript
// lib/optimizations/query-optimizer.ts
export class QueryOptimizer {
  static optimizeInclude(include: any): any {
    // Remove unnecessary includes
    const optimizedInclude = { ...include };

    // Only select needed fields
    if (optimizedInclude.profile) {
      optimizedInclude.profile = {
        select: {
          bio: true,
          avatar: true,
        },
      };
    }

    // Limit related records
    if (optimizedInclude.posts) {
      optimizedInclude.posts = {
        take: 5,
        orderBy: { createdAt: "desc" },
      };
    }

    return optimizedInclude;
  }
}
```

### 2. Batch Operations

```typescript
// lib/operations/batch-operations.ts
export class BatchOperations {
  static async batchCreate<T>(
    prisma: PrismaClient,
    model: string,
    data: any[],
    batchSize = 100
  ): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const created = await prisma[model].createMany({
        data: batch,
        skipDuplicates: true,
      });
      results.push(...created);
    }

    return results;
  }
}
```

## Migration Standards

### 1. Migration Naming

```typescript
// Migration naming convention: YYYYMMDDHHMMSS_descriptive_name.ts
// Example: 20240215143000_add_user_preferences.ts
```

### 2. Migration Structure

```typescript
import { Prisma } from "@prisma/client";

export const up = async (prisma: Prisma.TransactionClient) => {
  // Add new changes
  await prisma.$executeRaw`
    ALTER TABLE "User" 
    ADD COLUMN "preferences" JSONB DEFAULT '{}'::jsonb
  `;
};

export const down = async (prisma: Prisma.TransactionClient) => {
  // Revert changes
  await prisma.$executeRaw`
    ALTER TABLE "User" 
    DROP COLUMN "preferences"
  `;
};
```

## Monitoring and Logging

### 1. Query Logging

```typescript
// lib/monitoring/query-logger.ts
export class QueryLogger {
  static logQuery(params: any, duration: number) {
    console.log({
      timestamp: new Date(),
      model: params.model,
      action: params.action,
      duration,
      query: params.query,
    });
  }
}

// Usage in middleware
prisma.$use(async (params, next) => {
  const start = Date.now();
  const result = await next(params);
  const duration = Date.now() - start;

  QueryLogger.logQuery(params, duration);
  return result;
});
```

### 2. Performance Monitoring

```typescript
// lib/monitoring/performance-monitor.ts
export class PerformanceMonitor {
  private static slowQueryThreshold = 1000; // 1 second

  static monitorQuery(params: any, duration: number) {
    if (duration > this.slowQueryThreshold) {
      console.warn(`Slow query detected: ${params.model}.${params.action}`);
      // Send alert to monitoring system
    }
  }
}
```
