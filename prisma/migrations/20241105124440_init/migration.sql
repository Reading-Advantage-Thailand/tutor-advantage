-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "joinDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Tutor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentTutorId" TEXT,
    "directRevenue" REAL NOT NULL DEFAULT 0,
    "cachedTotalRevenue" REAL NOT NULL DEFAULT 0,
    "cachedCommission" REAL NOT NULL DEFAULT 0,
    "cachedNetCommission" REAL NOT NULL DEFAULT 0,
    "lastCalculationDate" DATETIME,
    CONSTRAINT "Tutor_id_fkey" FOREIGN KEY ("id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Tutor_parentTutorId_fkey" FOREIGN KEY ("parentTutorId") REFERENCES "Tutor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cefrLevel" TEXT NOT NULL DEFAULT 'A1',
    "assignedTutorId" TEXT NOT NULL,
    CONSTRAINT "Student_id_fkey" FOREIGN KEY ("id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Student_assignedTutorId_fkey" FOREIGN KEY ("assignedTutorId") REFERENCES "Tutor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonPlanId" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "scheduledDate" DATETIME NOT NULL,
    "startTime" DATETIME,
    "endTime" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "currentStage" TEXT,
    CONSTRAINT "Lesson_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lesson_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "passage" TEXT NOT NULL,
    "cefrLevel" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "targetVocabulary" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Sentence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "startTime" REAL,
    "endTime" REAL,
    "audioUrl" TEXT,
    CONSTRAINT "Sentence_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completionStatus" TEXT NOT NULL,
    "scores" TEXT,
    "feedback" TEXT,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RevenueTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tutorId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "relatedTutorId" TEXT,
    CONSTRAINT "RevenueTransaction_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Tutor_parentTutorId_idx" ON "Tutor"("parentTutorId");

-- CreateIndex
CREATE INDEX "Tutor_lastCalculationDate_idx" ON "Tutor"("lastCalculationDate");

-- CreateIndex
CREATE INDEX "Student_assignedTutorId_idx" ON "Student"("assignedTutorId");

-- CreateIndex
CREATE INDEX "Lesson_tutorId_idx" ON "Lesson"("tutorId");

-- CreateIndex
CREATE INDEX "Lesson_studentId_idx" ON "Lesson"("studentId");

-- CreateIndex
CREATE INDEX "Lesson_scheduledDate_idx" ON "Lesson"("scheduledDate");

-- CreateIndex
CREATE INDEX "Sentence_articleId_idx" ON "Sentence"("articleId");

-- CreateIndex
CREATE INDEX "StudentProgress_studentId_idx" ON "StudentProgress"("studentId");

-- CreateIndex
CREATE INDEX "RevenueTransaction_tutorId_date_idx" ON "RevenueTransaction"("tutorId", "date");

-- CreateIndex
CREATE INDEX "RevenueTransaction_type_idx" ON "RevenueTransaction"("type");
