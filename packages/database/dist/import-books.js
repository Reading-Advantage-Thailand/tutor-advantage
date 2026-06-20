"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("🚀 Starting book import...");
    const bookJsonPath = path.resolve(__dirname, "../book.json");
    if (!fs.existsSync(bookJsonPath)) {
        console.error(`❌ Error: book.json not found at ${bookJsonPath}`);
        return;
    }
    const data = JSON.parse(fs.readFileSync(bookJsonPath, "utf-8"));
    // Safety guard: this script only builds an EMPTY catalog. It must never
    // wipe live data — abort if any series/books already exist.
    const existingSeries = await prisma.series.count();
    const existingBooks = await prisma.book.count();
    if (existingSeries > 0 || existingBooks > 0) {
        console.error(`❌ Catalog is not empty (series=${existingSeries}, books=${existingBooks}). ` +
            "Aborting to avoid duplicating or clobbering data.");
        process.exit(1);
    }
    for (const [seriesName, meta] of Object.entries(data.series)) {
        console.log(`📦 Creating series: ${seriesName}`);
        const series = await prisma.series.create({
            data: {
                code: seriesName,
                name: seriesName,
                cefrLevel: meta.cefrLevel,
                raLevelStart: meta.raLevelStart,
                raLevelEnd: meta.raLevelEnd,
                tagline: meta.tagline,
            },
        });
        // Per-book hours come from the series totals spread over the planned book count
        const classHours = Math.round(meta.classHoursTotal / meta.plannedBooks);
        const independentHours = Math.round(meta.independentHoursTotal / meta.plannedBooks);
        for (const [bookKey, jsonArticles] of Object.entries(data.books)) {
            if (!bookKey.startsWith(seriesName))
                continue;
            // De-duplicate within the same book
            const seenIds = new Set();
            const uniqueArticles = jsonArticles.filter((a) => {
                if (!a.id || seenIds.has(a.id))
                    return false;
                seenIds.add(a.id);
                return true;
            });
            // Level number = first number in the book key ("Origins 3.1" -> 3)
            const match = bookKey.match(/([0-9]+)/);
            const levelNumber = match ? parseInt(match[1]) : 1;
            console.log(`📖 Adding book: ${bookKey} (Articles: ${uniqueArticles.length})`);
            const book = await prisma.book.create({
                data: {
                    seriesId: series.seriesId,
                    bookCode: bookKey,
                    title: bookKey,
                    levelNumber,
                    articleCount: uniqueArticles.length,
                    classHours,
                    independentHours,
                },
            });
            if (uniqueArticles.length > 0) {
                await prisma.article.createMany({
                    data: uniqueArticles.map((a) => ({
                        articleId: a.id,
                        bookId: book.bookId,
                        title: a.title,
                        type: a.type,
                        genre: a.genre,
                    })),
                });
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
