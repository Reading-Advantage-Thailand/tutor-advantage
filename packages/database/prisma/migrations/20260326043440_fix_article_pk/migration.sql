/*
  Warnings:

  - The primary key for the `articles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[article_id,book_id]` on the table `articles` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "learning"."articles" DROP CONSTRAINT "articles_pkey",
ADD COLUMN     "article_id_uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD CONSTRAINT "articles_pkey" PRIMARY KEY ("article_id_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "articles_article_id_book_id_key" ON "learning"."articles"("article_id", "book_id");
