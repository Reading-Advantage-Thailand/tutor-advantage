# Improved Detailed Data Model and Revenue Calculations for Tutor Advantage

This document provides an enhanced technical specification for the Tutor Advantage platform, focusing on the data model and revenue calculations. It includes detailed TypeScript interfaces, function definitions, optimization strategies, and considerations for building a robust and scalable system.

---

## 1. Data Model

### 1.1 User Entity

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "tutor" | "admin";
  joinDate: Date;
  // Additional common fields as needed
}
```

### 1.2 Tutor Entity

```typescript
interface Tutor extends User {
  parentTutorId?: string; // For network relationships
  directRevenue: number; // Revenue from direct teaching
  cachedTotalRevenue: number; // Total revenue including downline
  cachedCommission: number; // Total commission earned
  cachedNetCommission: number; // Net commission after paying downline
  lastCalculationDate: Date;
}
```

### 1.3 Student Entity

```typescript
interface Student extends User {
  cefrLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  assignedTutorId: string;
  progress: StudentProgress[];
}
```

### 1.4 Lesson Entity

```typescript
interface Lesson {
  id: string;
  lessonPlanId: string;
  tutorId: string;
  studentId: string;
  scheduledDate: Date;
  startTime: Date;
  endTime: Date;
  status: "scheduled" | "in_progress" | "completed" | "canceled";
  currentStage?: LessonStage["name"];
}
```

### 1.5 Content Entities

#### 1.5.1 Article Entity

```typescript
interface Article {
  id: string;
  title: string;
  passage: string;
  cefrLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  wordCount: number;
  targetVocabulary: string[];
  sentences: Sentence[];
}
```

#### 1.5.2 Sentence Entity

```typescript
interface Sentence {
  index: number;
  text: string;
  startTime?: number; // For synchronized audio
  endTime?: number;
  audioUrl?: string;
}
```

### 1.6 Revenue Transaction Entity

```typescript
interface RevenueTransaction {
  id: string;
  tutorId: string;
  amount: number;
  date: Date;
  type: "DIRECT_SALE" | "NETWORK_COMMISSION";
  relatedTutorId?: string; // For network commissions
}
```

### 1.7 Network Relationship Entity

```typescript
interface NetworkRelationship {
  parentTutorId: string;
  childTutorId: string;
  startDate: Date;
  endDate?: Date;
}
```

### 1.8 Database Indexes

- **Tutor Table**:

  - Index on `parentTutorId` for efficient network traversal.
  - Index on `lastCalculationDate` for caching purposes.

- **RevenueTransaction Table**:

  - Index on `tutorId` and `date` for efficient transaction retrieval.
  - Index on `type` for filtering transaction types.

- **NetworkRelationship Table**:
  - Compound index on `(parentTutorId, childTutorId)`.

---

## 2. Revenue and Commission Calculations

### 2.1 Commission Calculation Function

The commission is calculated based on total revenue, with a progressive rate that incentivizes higher performance while maintaining fairness.

```typescript
function calculateCommission(totalRevenue: number): number {
  let commissionRate: number;

  if (totalRevenue >= 15000) {
    commissionRate =
      (0.5 *
        (1 - Math.pow(0.3, 1 + Math.log(totalRevenue / 15000) / Math.log(5)))) /
      0.7;
  } else {
    commissionRate = 0.4 + totalRevenue / 150000;
  }

  return totalRevenue * commissionRate;
}
```

### 2.2 Tutor Revenue Calculation

```typescript
async function calculateTutorRevenue(
  tutorId: string,
  endDate: Date
): Promise<{
  totalRevenue: number;
  commission: number;
  netCommission: number;
}> {
  const tutor = await getTutor(tutorId);

  if (tutor.lastCalculationDate && tutor.lastCalculationDate >= endDate) {
    // Return cached values
    return {
      totalRevenue: tutor.cachedTotalRevenue,
      commission: tutor.cachedCommission,
      netCommission: tutor.cachedNetCommission,
    };
  }

  // Calculate direct revenue
  const directRevenue = await calculateDirectRevenue(tutorId, endDate);

  // Calculate network (downline) revenue
  const { networkRevenue, networkCommission } = await calculateNetworkRevenue(
    tutorId,
    endDate
  );

  const totalRevenue = directRevenue + networkRevenue;
  const commission = calculateCommission(totalRevenue);
  const netCommission = commission - networkCommission;

  // Update cached values
  await updateTutorCache(tutorId, {
    cachedTotalRevenue: totalRevenue,
    cachedCommission: commission,
    cachedNetCommission: netCommission,
    lastCalculationDate: endDate,
  });

  return { totalRevenue, commission, netCommission };
}
```

### 2.3 Direct Revenue Calculation

```typescript
async function calculateDirectRevenue(
  tutorId: string,
  endDate: Date
): Promise<number> {
  const transactions = await getRevenueTransactions({
    tutorId,
    endDate,
    type: "DIRECT_SALE",
  });

  return transactions.reduce((sum, txn) => sum + txn.amount, 0);
}
```

### 2.4 Network Revenue Calculation

```typescript
async function calculateNetworkRevenue(
  tutorId: string,
  endDate: Date
): Promise<{
  networkRevenue: number;
  networkCommission: number;
}> {
  const downlineTutors = await getDownlineTutors(tutorId);

  let networkRevenue = 0;
  let networkCommission = 0;

  for (const downlineTutor of downlineTutors) {
    const { totalRevenue, commission, netCommission } =
      await calculateTutorRevenue(downlineTutor.id, endDate);
    networkRevenue += totalRevenue;
    networkCommission += netCommission; // The net commission of the downline tutor is the amount paid out to them
  }

  return { networkRevenue, networkCommission };
}
```

---

## 3. Optimization Strategies

### 3.1 Caching

- **Tutor-Level Caching**: Store calculated revenues and commissions in the tutor's record.
- **Cache Invalidation**:
  - When new transactions occur.
  - When the network structure changes (e.g., a tutor joins or leaves).

### 3.2 Batch Processing

- **Nightly Jobs**: Recalculate all tutors' revenues and commissions during off-peak hours.
- **Incremental Updates**: Apply real-time updates for recent transactions affecting high-activity tutors.

### 3.3 Parallel Processing

- Use multi-threading or distributed task queues to process calculations concurrently, especially for large networks.

### 3.4 Database Optimization

- **Indexes**: Ensure critical queries are supported by appropriate indexes.
- **Partitioning**: Split large tables (e.g., `RevenueTransaction`) into partitions based on date ranges to improve performance.
- **Materialized Views**: Precompute and store results of complex queries that are frequently accessed.

---

## 4. API Endpoints

### 4.1 Get Tutor Dashboard Data

```http
GET /api/tutors/{tutorId}/dashboard
```

**Response:**

```json
{
  "directRevenue": number,
  "networkRevenue": number,
  "totalRevenue": number,
  "commission": number,
  "netCommission": number,
  "downlineCount": number,
  "revenueHistory": [
    {
      "date": "YYYY-MM-DD",
      "directRevenue": number,
      "networkRevenue": number,
      "totalRevenue": number,
      "commission": number,
      "netCommission": number
    },
    // ...
  ]
}
```

### 4.2 Get Downline Performance

```http
GET /api/tutors/{tutorId}/downline
```

**Response:**

```json
{
  "downline": [
    {
      "id": "string",
      "name": "string",
      "directRevenue": number,
      "totalRevenue": number,
      "commission": number,
      "netCommission": number,
      "level": number, // Network depth level
      "children": [ /* Recursive structure */ ]
    },
    // ...
  ]
}
```

### 4.3 Record Revenue Transaction

```http
POST /api/revenue-transactions
```

**Request Body:**

```json
{
  "tutorId": "string",
  "amount": number,
  "date": "YYYY-MM-DD",
  "type": "DIRECT_SALE" | "NETWORK_COMMISSION",
  "relatedTutorId": "string" // Optional for NETWORK_COMMISSION
}
```

**Response:**

```json
{
  "transactionId": "string",
  "status": "success",
  "message": "Transaction recorded successfully."
}
```

---

## 5. Error Handling and Edge Cases

- **Network Cycles Prevention**: Validate relationships to prevent cyclic dependencies in the network.
- **Tutor Departures**:
  - Reassign downline tutors as per business rules.
  - Update network relationships and recalculate affected revenues.
- **Data Corrections**:
  - Implement mechanisms for retroactive adjustments.
  - Maintain audit logs for transparency.

---

## 6. Monitoring and Logging

- **Detailed Logging**: Record significant events, calculations, and transactions.
- **Performance Monitoring**:
  - Use tools like New Relic or Datadog to monitor system health.
  - Set up alerts for anomalies or performance issues.
- **Analytics Dashboard**: Provide administrators with insights into system performance and usage patterns.

---

## 7. Security Considerations

- **Authentication & Authorization**:
  - Implement secure authentication protocols.
  - Use role-based access control (RBAC) to limit permissions.
- **Data Encryption**:
  - Encrypt sensitive data at rest and in transit.
- **Input Validation**:
  - Sanitize all user inputs to prevent injection attacks.
- **Compliance**:
  - Adhere to data protection laws like GDPR or local regulations.

---

## 8. Additional Interfaces and Types

### 8.1 StudentProgress Entity

```typescript
interface StudentProgress {
  studentId: string;
  lessonId: string;
  completionStatus: "not_started" | "in_progress" | "completed";
  scores?: {
    [activityId: string]: number;
  };
  feedback?: string;
  lastUpdated: Date;
}
```

### 8.2 LessonPlan Entity

```typescript
interface LessonPlan {
  id: string;
  title: string;
  cefrLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  stages: LessonStage[];
}
```

### 8.3 LessonStage Entity

```typescript
interface LessonStage {
  name: string;
  duration: number; // In minutes
  contentId: string;
  activityType:
    | "warmUp"
    | "reading"
    | "vocabulary"
    | "writing"
    | "speaking"
    | "wrapUp";
}
```

---

## 9. Component Interfaces

### 9.1 InteractiveArticleReaderProps

```typescript
interface InteractiveArticleReaderProps {
  article: Article;
  mode: "read" | "listen";
  onComplete: () => void;
  userId: string;
  duration: number;
}
```

### 9.2 VocabularyWorkshopProps

```typescript
interface VocabularyWorkshopProps {
  words: VocabularyItem[];
  exercises: VocabularyExercise[];
  onComplete: () => void;
  duration: number;
}
```

### 9.3 LessonComponentProps

```typescript
interface LessonComponentProps {
  lessonPlan: LessonPlan;
  tutorId: string;
  studentId: string;
  onLessonComplete: (summary: LessonSummary) => void;
}
```

---

## 10. Internationalization (i18n)

- **Language Support**:

  - Store UI strings in language-specific JSON files.
  - Use libraries like `react-intl` for localization.

- **Dynamic Content Translation**:
  - Provide translations for articles and exercises where applicable.
  - Allow users to select preferred languages for content and interface.

---

## 11. Accessibility Considerations

- **Keyboard Navigation**: Ensure all functionalities are accessible via keyboard.
- **Screen Reader Compatibility**: Use ARIA attributes and proper semantic HTML.
- **Contrast and Font Sizes**: Provide options for high contrast modes and adjustable font sizes.

---

## 12. Performance Optimization

- **Code Splitting**: Implement dynamic imports to reduce initial load times.
- **Caching**: Use HTTP caching headers and service workers for static assets.
- **Lazy Loading**: Load components and data as needed.

---

## 13. Testing Strategy

- **Unit Tests**: Use Jest for testing individual components and functions.
- **Integration Tests**: Test the interaction between different modules.
- **End-to-End Tests**: Use Cypress for simulating user workflows.
- **Performance Tests**: Conduct load testing using tools like Apache JMeter.

---

## 14. Deployment and CI/CD Pipeline

- **Continuous Integration**:
  - Use GitHub Actions or Jenkins for automated testing and building.
- **Continuous Deployment**:
  - Deploy to staging and production environments using Docker and Kubernetes.
- **Monitoring Deployments**:
  - Implement health checks and rollback mechanisms.

---

## 15. Documentation

- **API Documentation**: Use Swagger/OpenAPI for API endpoints.
- **Developer Guides**: Provide setup instructions and codebase overviews.
- **User Manuals**: Create guides for students, tutors, and administrators.

---

## 16. Error Handling

- **Global Error Handler**: Implement a centralized error handling mechanism.
- **User-Friendly Messages**: Display clear and helpful error messages to users.
- **Logging**: Log errors with sufficient context for debugging.

---

## 17. Security Measures

- **Input Validation**: Validate and sanitize all inputs.
- **Session Management**: Use secure cookies and manage session timeouts.
- **Third-Party Dependencies**: Regularly update and audit for vulnerabilities.

---

## 18. Data Persistence and Backup

- **Regular Backups**: Schedule automated backups of the database.
- **Disaster Recovery Plan**: Establish procedures for data recovery.

---

## 19. Analytics and Feedback

- **User Analytics**:

  - Track user engagement metrics.
  - Use tools like Google Analytics with privacy considerations.

- **Feedback Mechanisms**:
  - Implement surveys and feedback forms.
  - Analyze feedback for continuous improvement.

---

## 20. Gamification and Engagement

- **Points and Badges**:
  - Reward students for completing lessons and achieving milestones.
- **Leaderboards**:
  - Encourage friendly competition among peers.
- **Progress Tracking**:
  - Visualize progress with progress bars and achievement indicators.

---

## Conclusion

This comprehensive technical specification aims to guide the development of the Tutor Advantage platform, ensuring it is robust, scalable, and aligned with the project's ethical framework. By focusing on detailed data models, efficient revenue calculations, optimization strategies, and additional considerations like accessibility and security, the platform is poised to deliver a high-quality educational experience.

Please feel free to reach out if you need further clarification or additional details on any section.
