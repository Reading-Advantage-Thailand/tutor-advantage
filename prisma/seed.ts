import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Clean up existing data
  await prisma.revenueTransaction.deleteMany();
  await prisma.sentence.deleteMany();
  await prisma.article.deleteMany();
  await prisma.studentProgress.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.student.deleteMany();
  await prisma.tutor.deleteMany();
  await prisma.user.deleteMany();

  // Create admin user with password
  const hashedPassword = await hash('password123', 12);
  await prisma.user.create({
    data: {
      email: 'admin@tutoradv.com',
      name: 'System Admin',
      role: 'ADMIN',
      password: hashedPassword,
    },
  });

  // Create parent tutor
  const parentTutorUser = await prisma.user.create({
    data: {
      email: 'senior.tutor@tutoradv.com',
      name: 'Senior Tutor',
      role: 'TUTOR',
      tutor: {
        create: {
          directRevenue: 5000,
          cachedTotalRevenue: 8000,
          cachedCommission: 3200,
          cachedNetCommission: 2400,
        },
      },
    },
  });

  // Create child tutor
  const childTutorUser = await prisma.user.create({
    data: {
      email: 'junior.tutor@tutoradv.com',
      name: 'Junior Tutor',
      role: 'TUTOR',
      tutor: {
        create: {
          parentTutorId: parentTutorUser.id,
          directRevenue: 3000,
          cachedTotalRevenue: 3000,
          cachedCommission: 1200,
          cachedNetCommission: 1200,
        },
      },
    },
  });

  // Create students
  const student1User = await prisma.user.create({
    data: {
      email: 'student1@example.com',
      name: 'Student One',
      role: 'STUDENT',
      student: {
        create: {
          cefrLevel: 'B1',
          assignedTutorId: parentTutorUser.id,
        },
      },
    },
  });

  const student2User = await prisma.user.create({
    data: {
      email: 'student2@example.com',
      name: 'Student Two',
      role: 'STUDENT',
      student: {
        create: {
          cefrLevel: 'A2',
          assignedTutorId: childTutorUser.id,
        },
      },
    },
  });

  // Create an article
  await prisma.article.create({
    data: {
      title: 'Introduction to English Grammar',
      passage: 'English grammar is the way in which meanings are encoded into wordings in the English language...',
      cefrLevel: 'B1',
      wordCount: 150,
      targetVocabulary: JSON.stringify(['grammar', 'language', 'structure', 'sentence']),
      sentences: {
        create: [
          {
            index: 0,
            text: 'English grammar is the way in which meanings are encoded into wordings in the English language.',
            startTime: 0,
            endTime: 5,
          },
          {
            index: 1,
            text: 'Understanding grammar helps you become a better writer and speaker.',
            startTime: 5,
            endTime: 10,
          },
        ],
      },
    },
  });

  // Create lessons
  const lesson1 = await prisma.lesson.create({
    data: {
      lessonPlanId: 'plan1',
      tutorId: parentTutorUser.id,
      studentId: student1User.id,
      scheduledDate: new Date('2024-01-10T10:00:00Z'),
      status: 'COMPLETED',
    },
  });

  await prisma.lesson.create({
    data: {
      lessonPlanId: 'plan1',
      tutorId: childTutorUser.id,
      studentId: student2User.id,
      scheduledDate: new Date('2024-01-15T14:00:00Z'),
      status: 'SCHEDULED',
    },
  });

  // Create student progress
  await prisma.studentProgress.create({
    data: {
      studentId: student1User.id,
      lessonId: lesson1.id,
      completionStatus: 'completed',
      scores: JSON.stringify({ reading: 85, speaking: 90 }),
      feedback: 'Excellent progress in speaking exercises',
    },
  });

  // Create revenue transactions
  await prisma.revenueTransaction.create({
    data: {
      tutorId: parentTutorUser.id,
      amount: 5000,
      date: new Date('2024-01-01'),
      type: 'DIRECT_SALE',
    },
  });

  await prisma.revenueTransaction.create({
    data: {
      tutorId: childTutorUser.id,
      amount: 3000,
      date: new Date('2024-01-05'),
      type: 'DIRECT_SALE',
    },
  });

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
