import { prisma } from "@tutor-advantage/database";

async function testConnection() {
  try {
    const userCount = await prisma.user.count();
    console.log(
      `Connection successful. Current User Count (Identity Schema): ${userCount}`,
    );

    const classCount = await prisma.class.count();
    console.log(
      `Connection successful. Current Class Count (Learning Schema): ${classCount}`,
    );
  } catch (err) {
    console.error("Failed to connect or query database:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
