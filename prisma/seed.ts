import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Clean up existing data
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.session.deleteMany(),
    prisma.achievement.deleteMany(),
    prisma.commissionTransaction.deleteMany(),
    prisma.revenueTransaction.deleteMany(),
    prisma.progress.deleteMany(),
    prisma.enrollment.deleteMany(),
    prisma.lessonStage.deleteMany(),
    prisma.lesson.deleteMany(),
    prisma.article.deleteMany(),
    prisma.course.deleteMany(),
    prisma.tutorProfile.deleteMany(),
    prisma.studentProfile.deleteMany(),
    prisma.user.deleteMany(),
    prisma.translation.deleteMany(),
  ]);

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@tutoradv.com',
      name: 'System Admin',
      role: 'ADMIN',
      password: 'hashed_password_here', // TODO: Implement proper password hashing
      isActive: true,
    },
  });

  // Create sample tutor with profile
  const tutor1 = await prisma.user.create({
    data: {
      email: 'tutor1@tutoradv.com',
      name: 'John Smith',
      role: 'TUTOR',
      password: 'hashed_password_here',
      isActive: true,
      tutorProfile: {
        create: {
          specializations: 'Business English,IELTS,Conversation',
          availability: JSON.stringify({
            monday: ['09:00-12:00', '13:00-17:00'],
            tuesday: ['09:00-12:00', '13:00-17:00'],
            wednesday: ['09:00-12:00', '13:00-17:00'],
            thursday: ['09:00-12:00', '13:00-17:00'],
            friday: ['09:00-12:00', '13:00-17:00'],
          }),
          hourlyRate: 25.0,
          rating: 4.8,
          totalRatings: 24,
        },
      },
    },
    include: {
      tutorProfile: true,
    },
  });

  // Create sample student with profile
  const student1 = await prisma.user.create({
    data: {
      email: 'student1@example.com',
      name: 'Alice Johnson',
      role: 'STUDENT',
      password: 'hashed_password_here',
      isActive: true,
      studentProfile: {
        create: {
          cefrLevel: 'B1',
          xpPoints: 1200,
          streak: 5,
        },
      },
    },
    include: {
      studentProfile: true,
    },
  });

  // Create sample course
  const course = await prisma.course.create({
    data: {
      title: 'Business English Fundamentals',
      description: 'Master essential business English skills for professional success',
      cefrLevel: 'B1',
      duration: 1800, // 30 hours
      price: 299.99,
      isPublished: true,
    },
  });

  // Create sample article
  const article = await prisma.article.create({
    data: {
      courseId: course.id,
      title: 'Effective Business Communication',
      content: 'Professional communication is essential in today\'s business world...',
      cefrLevel: 'B1',
      wordCount: 500,
      targetVocabulary: 'negotiate,proposal,deadline,schedule,meeting',
      comprehensionQuestions: JSON.stringify([
        {
          question: 'What are the key elements of effective business communication?',
          options: [
            'Clear messaging and active listening',
            'Using complex vocabulary',
            'Speaking quickly',
            'Being indirect'
          ],
          correctAnswer: 0
        }
      ]),
    },
  });

  // Create sample lesson
  const lesson = await prisma.lesson.create({
    data: {
      courseId: course.id,
      tutorId: tutor1.tutorProfile?.id,
      title: 'Introduction to Business Meetings',
      description: 'Learn essential vocabulary and phrases for business meetings',
      duration: 60,
      order: 1,
      stages: {
        create: [
          {
            name: 'Warm-up Discussion',
            type: 'WARM_UP',
            duration: 10,
            content: JSON.stringify({
              questions: [
                'What types of meetings do you attend?',
                'What makes a meeting effective?'
              ]
            }),
            order: 1,
          },
          {
            name: 'Vocabulary Introduction',
            type: 'VOCABULARY',
            duration: 15,
            content: JSON.stringify({
              words: [
                { word: 'agenda', definition: 'A list of items to be discussed' },
                { word: 'minutes', definition: 'Written record of a meeting' }
              ]
            }),
            order: 2,
          }
        ]
      }
    },
  });

  // Create sample enrollment
  await prisma.enrollment.create({
    data: {
      studentId: student1.studentProfile?.id!,
      courseId: course.id,
      status: 'ACTIVE',
    },
  });

  // Create sample progress
  await prisma.progress.create({
    data: {
      studentId: student1.studentProfile?.id!,
      lessonId: lesson.id,
      status: 'IN_PROGRESS',
      timeSpent: 25,
      score: 85.5,
    },
  });

  // Create sample achievement
  await prisma.achievement.create({
    data: {
      studentId: student1.studentProfile?.id!,
      type: 'STREAK',
      title: '5-Day Streak',
      description: 'Completed lessons for 5 consecutive days',
      xpReward: 100,
    },
  });

  // Create sample translations
  const translations = [
    { key: 'common.welcome', locale: 'en', value: 'Welcome to Tutor Advantage' },
    { key: 'common.welcome', locale: 'th', value: 'ยินดีต้อนรับสู่ Tutor Advantage' },
    { key: 'common.welcome', locale: 'zh', value: '欢迎来到 Tutor Advantage' },
  ];

  for (const translation of translations) {
    await prisma.translation.create({ data: translation });
  }

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error('Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
