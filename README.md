# Tutor Advantage

An ethical, AI-enhanced English language tutoring platform for Thai students, combining technology-powered learning with personalized in-person instruction.

## Project Overview

Tutor Advantage provides comprehensive English language education aligned with CEFR levels and Thai Ministry of Education benchmarks:

- **Grade 6**: CEFR A1
- **Grade 9**: CEFR A2
- **Grade 12**: CEFR B1

## Curriculum Structure

Students progress through 45 courses across 5 CEFR levels. Each course comprises 20 lessons.

### Course Breakdown

| CEFR Level | Levels | Courses per Level | Total Courses |
|------------|--------|-------------------|---------------|
| Pre-A1     | 3      | 1                 | 3             |
| A1         | 3      | 2                 | 6             |
| A2         | 3      | 3                 | 9             |
| B1         | 3      | 4                 | 12            |
| B2         | 3      | 5                 | 15            |
| **Total**  | **15** | **15**            | **45**        |

## Core Features

### For Students
- Adaptive learning paths based on CEFR assessment
- AI-powered extensive reading system with auto-generated content
- Interactive lesson components (audio playback, vocabulary games, sentence translation)
- Progress tracking and achievement system
- Integrated workbooks for supplementary practice

### For Tutors
- Lesson planning and scheduling tools
- Student progress analytics
- Professional development resources
- Transparent compensation structure
- Mentorship and network building

### For Administrators
- Content management system
- Performance monitoring and reporting
- Quality assurance tools
- User and tutor management

## Technology Stack

- **Framework**: Next.js 16 with TypeScript
- **Database**: Google Cloud SQL (PostgreSQL)
- **ORM**: Prisma
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **Payments**: Stripe
- **Cloud Platform**: Google Cloud Platform
- **Internationalization**: next-intl (English, Thai)

## Educational Framework

### 55-Minute Lesson Structure

Each lesson follows a proven methodology:

1. Warm-up and Activate Prior Knowledge (3 min)
2. Listen to Others Read (5 min)
3. Read to Self (7 min)
4. Word Work (10 min)
5. Listen to Others Read (5 min)
6. Read to Others (8 min)
7. Work on Writing/Speaking (12 min)
8. Extensive Reading (4 min)
9. Wrap-up (1 min)

### Content Generation

AI-powered system generates content aligned with CEFR grammar structures and vocabulary requirements for each level, ensuring consistency and variety across the platform.

## Ethical MLM Framework

The platform uses a transparent, education-focused multi-level marketing structure:

- Tutors earn directly from teaching their own students
- Network commissions based on downline performance with diminishing returns
- Quality control through performance evaluations
- No recruitment quotas or pressure
- Focus on educational outcomes over network expansion

## Development

### Repository Structure
```
├── src/
│   ├── app/           # Next.js 16 app router
│   ├── components/    # React components (shadcn/ui based)
│   ├── lib/           # Utilities and helpers
│   ├── types/         # TypeScript type definitions
│   └── styles/        # Global styles and Tailwind config
├── prisma/            # Database schema and migrations
├── public/            # Static assets
└── docs/              # Project documentation
```

### Git Workflow

All development follows a feature branch workflow:

```bash
git checkout -b feature/your-feature-name
# Make changes and commit
git add .
git commit -m "Descriptive commit message"
git push -u origin feature/your-feature-name
# Create pull request for review
# After approval, merge to main
git checkout main
git pull
git merge feature/your-feature-name
git push
```

## Database

### Schema Overview

Key entities:
- **Users**: Students, tutors, and administrators
- **Courses**: 45 total courses organized by CEFR level
- **Lessons**: 20 lessons per course
- **Content**: Articles, exercises, assessments
- **Progress**: Student lesson completion and assessment results
- **Transactions**: Payment and commission tracking
- **Network**: MLM structure and tutor relationships

Managed with Prisma ORM and PostgreSQL on Google Cloud SQL.

## Internationalization

The platform supports:
- **English** (en)
- **Thai** (th)

Language switching and dynamic content translation via next-intl.

## Related Documentation

- [55-Minute EFL Lesson Plan](./docs/55-minute-efl-lesson-plan.md)
- [CEFR System Prompts](./docs/cefr-system-prompts.json)
- [Data Model Specifications](./docs/data-model-specifications.md)
- [Development Todo List](./docs/development-todo.md)
- [Git Workflow Instructions](./docs/git-workflow.md)

## License

Proprietary - Tutor Advantage

## Contact

For inquiries about the Tutor Advantage project, contact the development team.
