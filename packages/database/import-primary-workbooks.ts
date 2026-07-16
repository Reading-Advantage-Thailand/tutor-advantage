import { PrismaClient } from "@prisma/client";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { Pool } from "pg";

const prisma = new PrismaClient();

type PrimaryProject = {
  seriesName: string;
  levelNumber: string;
  cefrLevel: string;
  type: "primary";
};

type PrimaryWorkbook = {
  lesson_title: string;
};

type CatalogueProject = Omit<PrimaryProject, "type">;

const workbookRoot = path.resolve(
  process.env.PRIMARY_WORKBOOKS_DIR || "C:/Repository/advantage-workbooks/primary",
);

function catalogueLevel(value: string): number {
  const level = Number.parseFloat(value);
  if (!Number.isFinite(level)) throw new Error(`Invalid Primary level: ${value}`);
  // Book.levelNumber is an integer. Keep a decimal level's display value in
  // bookCode/title and multiply here solely for stable catalogue ordering.
  return Math.round(level * 10);
}

const normalizeTitle = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

async function primaryConnectionString() {
  if (process.env.DATABASE_URL_PRIMARY_ADVANTAGE) return process.env.DATABASE_URL_PRIMARY_ADVANTAGE;
  const primaryEnvPath = process.env.PRIMARY_ADVANTAGE_ENV_FILE || "C:/Repository/primary-advantage/.env";
  const envFile = await readFile(primaryEnvPath, "utf8");
  const line = envFile.split(/\r?\n/).find((value) => value.startsWith("DATABASE_URL="));
  if (!line) throw new Error(`DATABASE_URL is missing from ${primaryEnvPath}`);
  return line.slice("DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g, "");
}

function projectFromDirectory(directory: string, fallback: PrimaryProject): CatalogueProject {
  const match = directory.match(/^(.+)-(\d+(?:\.\d+)?)-(a\d+)$/i);
  if (!match) return fallback;
  return {
    seriesName: match[1].replace(/(^|-)\w/g, (part) => part.replace("-", "").toUpperCase()),
    levelNumber: match[2],
    cefrLevel: match[3].toUpperCase(),
  };
}

async function main() {
  const primaryPool = new Pool({ connectionString: await primaryConnectionString() });
  const primaryArticles = await primaryPool.query<{ id: string; title: string }>(
    "SELECT id, title FROM article WHERE is_published = true",
  );
  const articleIdByTitle = new Map(
    primaryArticles.rows.map((article) => [normalizeTitle(article.title), article.id]),
  );
  const directories = (await readdir(workbookRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  let bookCount = 0;
  let articleCount = 0;

  for (const directory of directories) {
    const directoryPath = path.join(workbookRoot, directory);
    const manifest = JSON.parse(
      await readFile(path.join(directoryPath, "project.json"), "utf8"),
    ) as PrimaryProject;
    if (manifest.type !== "primary") continue;
    // Directory names are the catalogue identifiers. This also prevents a
    // stale project.json from merging a distinct course into the wrong book.
    const project = projectFromDirectory(directory, manifest);

    const seriesCode = `PRIMARY-${project.seriesName.toUpperCase().replace(/\s+/g, "-")}`;
    const series = await prisma.series.upsert({
      where: { code: seriesCode },
      update: {
        name: `Primary Advantage ${project.seriesName}`,
        cefrLevel: project.cefrLevel,
        raLevelStart: 0,
        raLevelEnd: 0,
        tagline: "English reading for primary learners",
      },
      create: {
        code: seriesCode,
        name: `Primary Advantage ${project.seriesName}`,
        cefrLevel: project.cefrLevel,
        raLevelStart: 0,
        raLevelEnd: 0,
        tagline: "English reading for primary learners",
      },
    });

    const workbookFiles = (await readdir(directoryPath))
      .filter((file) => file.endsWith("_workbook.json"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const workbooks = await Promise.all(workbookFiles.map(async (file) => ({
      file,
      data: JSON.parse(await readFile(path.join(directoryPath, file), "utf8")) as PrimaryWorkbook,
    })));
    const resolvedWorkbooks = workbooks.filter(({ data }) => articleIdByTitle.has(normalizeTitle(data.lesson_title)));
    const unresolved = workbooks.filter(({ data }) => !articleIdByTitle.has(normalizeTitle(data.lesson_title)));
    if (unresolved.length) {
      console.warn(
        `Skipped workbook titles missing from Primary database: ${unresolved.map(({ data }) => data.lesson_title).join(", ")}`,
      );
    }
    const bookCode = `Primary ${project.seriesName} ${project.levelNumber}`;
    const book = await prisma.book.upsert({
      where: { bookCode },
      update: {
        seriesId: series.seriesId,
        levelNumber: catalogueLevel(project.levelNumber),
        title: `${bookCode} (${project.cefrLevel})`,
        articleCount: resolvedWorkbooks.length,
      },
      create: {
        seriesId: series.seriesId,
        levelNumber: catalogueLevel(project.levelNumber),
        bookCode,
        title: `${bookCode} (${project.cefrLevel})`,
        articleCount: resolvedWorkbooks.length,
      },
    });
    bookCount++;

    const importedArticleIds = new Set<string>();
    for (const { data: workbook } of resolvedWorkbooks) {
      const articleId = articleIdByTitle.get(normalizeTitle(workbook.lesson_title))!;
      importedArticleIds.add(articleId);

      await prisma.article.upsert({
        where: { articleId_bookId: { articleId, bookId: book.bookId } },
        update: { title: workbook.lesson_title, type: null, genre: null },
        create: { articleId, bookId: book.bookId, title: workbook.lesson_title, type: null, genre: null },
      });
      articleCount++;
    }
    await prisma.article.deleteMany({
      where: { bookId: book.bookId, articleId: { notIn: [...importedArticleIds] } },
    });
  }

  console.log(`Imported ${bookCount} Primary books and ${articleCount} Primary articles.`);
  await primaryPool.end();
}

main()
  .catch((error) => {
    console.error("Primary workbook import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
