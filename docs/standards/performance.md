# Performance Standards

## Overview

This document outlines the performance standards and requirements for the Tutor Advantage platform. Our goal is to provide a fast, responsive experience across all devices and network conditions.

## Core Metrics

### Web Vitals Targets

- **Largest Contentful Paint (LCP)**: < 2.5s
- **First Input Delay (FID)**: < 100ms
- **Cumulative Layout Shift (CLS)**: < 0.1
- **First Contentful Paint (FCP)**: < 1.8s
- **Time to Interactive (TTI)**: < 3.8s

### Page Load Targets

- Initial page load: < 2s
- Subsequent page loads: < 1s
- API response time: < 200ms
- Time to first byte (TTFB): < 200ms

## Implementation Guidelines

### 1. Image Optimization

```typescript
// Next.js Image component usage
import Image from "next/image";

const OptimizedImage: React.FC<ImageProps> = ({ src, alt, width, height }) => {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      placeholder="blur"
      blurDataURL={`data:image/svg+xml;base64,...`}
    />
  );
};
```

### 2. Code Splitting

```typescript
// Dynamic imports for route-based code splitting
import dynamic from "next/dynamic";

const DynamicComponent = dynamic(() => import("../components/HeavyComponent"), {
  loading: () => <LoadingSpinner />,
  ssr: false,
});
```

### 3. Caching Strategy

```typescript
// API route with caching
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate");

  const data = await fetchData();
  res.json(data);
}
```

### 4. State Management Optimization

```typescript
// Optimized React Query usage
import { useQuery, useQueryClient } from "react-query";

const useTutorData = (tutorId: string) => {
  return useQuery(["tutor", tutorId], () => fetchTutorData(tutorId), {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });
};
```

## Performance Monitoring

### 1. Real User Monitoring (RUM)

```typescript
// Performance monitoring setup
const reportWebVitals = ({ id, name, value }: Metric) => {
  // Send to analytics
  analytics.track("Web Vitals", {
    metric: name,
    value: Math.round(name === "CLS" ? value * 1000 : value),
    id,
  });
};

export default reportWebVitals;
```

### 2. Synthetic Monitoring

```yaml
# lighthouse-ci.config.js
module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      startServerCommand: 'npm run start',
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/dashboard',
        'http://localhost:3000/lessons'
      ]
    },
    assert: {
      assertions: {
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }]
      }
    }
  }
};
```

## Optimization Strategies

### 1. Bundle Optimization

```javascript
// next.config.js
module.exports = {
  webpack: (config, { dev, isServer }) => {
    // Enable tree shaking
    config.optimization.usedExports = true;

    // Enable compression
    if (!dev && !isServer) {
      config.optimization.minimize = true;
    }

    return config;
  },
};
```

### 2. Resource Prioritization

```html
<!-- Resource hints -->
<link rel="preconnect" href="https://api.tutoradvatage.com" />
<link
  rel="preload"
  href="/fonts/inter.woff2"
  as="font"
  type="font/woff2"
  crossorigin
/>
<link rel="prefetch" href="/dashboard" />
```

### 3. Database Query Optimization

```typescript
// Optimized Prisma query
const getStudentData = async (studentId: string) => {
  return prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      lessons: {
        select: {
          id: true,
          title: true,
        },
        take: 5,
        orderBy: {
          date: "desc",
        },
      },
    },
  });
};
```

## Testing Requirements

### 1. Performance Testing

```typescript
// Performance test example using Jest
describe("Performance", () => {
  it("renders list within performance budget", async () => {
    const startTime = performance.now();

    render(<LongList items={1000} />);

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    expect(renderTime).toBeLessThan(100);
  });
});
```

### 2. Load Testing

```typescript
// k6 load test script
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 50 },
    { duration: "3m", target: 50 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  const res = http.get("https://api.tutoradvantage.com/lessons");

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

## Best Practices

### 1. React Performance Optimization

```typescript
// Memoization example
const MemoizedComponent = React.memo(
  ({ data }) => {
    return (
      <div>
        {data.map((item) => (
          <ListItem key={item.id} {...item} />
        ))}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.data.length === nextProps.data.length;
  }
);

// Use callback for event handlers
const EventHandler = () => {
  const handleClick = useCallback(() => {
    // Handle click
  }, []);

  return <button onClick={handleClick}>Click me</button>;
};
```

### 2. API Optimization

```typescript
// API route with rate limiting
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return limiter(req, res, async () => {
    // API logic here
  });
}
```

## Continuous Monitoring

### 1. Performance Monitoring Setup

```typescript
// Monitor setup
const monitorPerformance = () => {
  // Monitor LCP
  new PerformanceObserver((entryList) => {
    for (const entry of entryList.getEntries()) {
      const metric = {
        name: "LCP",
        value: entry.startTime,
        rating: entry.startTime < 2500 ? "good" : "poor",
      };
      reportMetric(metric);
    }
  }).observe({ entryTypes: ["largest-contentful-paint"] });

  // Monitor FID
  new PerformanceObserver((entryList) => {
    for (const entry of entryList.getEntries()) {
      const metric = {
        name: "FID",
        value: entry.processingStart - entry.startTime,
        rating: entry.duration < 100 ? "good" : "poor",
      };
      reportMetric(metric);
    }
  }).observe({ entryTypes: ["first-input"] });
};
```

### 2. Error Tracking

```typescript
// Error boundary with performance tracking
class PerformanceErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportError({
      error,
      errorInfo,
      performance: {
        navigationTiming: performance.getEntriesByType("navigation")[0],
        memory: (performance as any).memory,
      },
    });
  }

  render() {
    return this.props.children;
  }
}
```

## Documentation Requirements

1. **Performance Budgets**

   - Document size limits for assets
   - Specify timing thresholds
   - Define metrics targets

2. **Optimization Guidelines**

   - Image optimization procedures
   - Code splitting strategies
   - Caching policies

3. **Monitoring Procedures**
   - Alert thresholds
   - Response procedures
   - Reporting requirements

## Compliance Monitoring

1. **Regular Audits**

   - Weekly performance scans
   - Monthly detailed analysis
   - Quarterly trend review

2. **Issue Resolution**

   - Performance regression tracking
   - Optimization implementation
   - Impact verification

3. **Reporting**
   - Weekly performance metrics
   - Monthly trend analysis
   - Quarterly review reports
