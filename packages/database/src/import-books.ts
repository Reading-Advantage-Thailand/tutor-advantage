import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const seriesMetadata: Record<string, { cefrLevel: string; raLevelStart: number; raLevelEnd: number; tagline: string }> = {
  "Origins": { cefrLevel: "A1", raLevelStart: 1, raLevelEnd: 3, tagline: "Your journey starts here" },
  "Quest": { cefrLevel: "A2", raLevelStart: 4, raLevelEnd: 6, tagline: "Your quest awaits" },
  "Adventure": { cefrLevel: "B1", raLevelStart: 7, raLevelEnd: 9, tagline: "Your adventure's in sight" },
  "Hero": { cefrLevel: "B2", raLevelStart: 10, raLevelEnd: 12, tagline: "You're the hero in the story" },
  "Legend": { cefrLevel: "C1", raLevelStart: 13, raLevelEnd: 15, tagline: "Legendary stories" }
};

async function main() {
  console.log("🚀 Starting book import...");

  // 1. Read book.json
  const bookJsonPath = path.resolve(__dirname, "../book.json");
  if (!fs.existsSync(bookJsonPath)) {
    console.error(`❌ Error: book.json not found at ${bookJsonPath}`);
    return;
  }
  const data = JSON.parse(fs.readFileSync(bookJsonPath, "utf-8"));

  // 2. Clean up old data (Learning Domain)
  console.log("🧹 Cleaning up old books and classes...");
  // Order matters due to foreign key constraints
  await prisma.enrollment.deleteMany({});
  await prisma.referral.deleteMany({});
  await prisma.conversationParticipant.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.classTransferRequest.deleteMany({});
  await prisma.article.deleteMany({});
  await prisma.class.deleteMany({});
  await prisma.book.deleteMany({});
  await prisma.series.deleteMany({});

  console.log("✨ Data cleaned.");

  // 3. Create Series and Books
  for (const [seriesName, meta] of Object.entries(seriesMetadata)) {
    console.log(`📦 Creating series: ${seriesName}`);
    const series = await prisma.series.create({
      data: {
        code: seriesName,
        name: seriesName,
        cefrLevel: meta.cefrLevel,
        raLevelStart: meta.raLevelStart,
        raLevelEnd: meta.raLevelEnd,
        tagline: meta.tagline
      }
    });

    // 4. Find books in the JSON that match this series
    for (const bookKey of Object.keys(data)) {
      if (bookKey.startsWith(seriesName)) {
        const jsonArticles = data[bookKey];
        
        // Extract level number from bookKey
        const match = bookKey.match(/([0-9]+)/);
        const levelNumber = match ? parseInt(match[1]) : 1;

        console.log(`📖 Adding book: ${bookKey} (Articles: ${jsonArticles.length})`);
        
        const book = await prisma.book.create({
          data: {
            seriesId: series.seriesId,
            bookCode: bookKey,
            title: bookKey,
            levelNumber: levelNumber,
            articleCount: jsonArticles.length,
            classHours: 25
          }
        });

        // 5. Create Articles
        if (jsonArticles && jsonArticles.length > 0) {
          // De-duplicate within the same book
          const seenIds = new Set();
          const uniqueArticles = [];
          for (const a of jsonArticles) {
            const articleId = a.id || `missing-${Math.random()}`;
            if (!seenIds.has(articleId)) {
              seenIds.add(articleId);
              uniqueArticles.push({
                articleId: articleId,
                bookId: book.bookId,
                title: a.title,
                type: a.type,
                genre: a.genre
              });
            }
          }

          await prisma.article.createMany({
            data: uniqueArticles
          });
        }
      }
    }
  }

  console.log("✅ Import complete!");
}

main()
  .catch((e) => {
    console.error("❌ Import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
