-- AlterTable
ALTER TABLE "HuntingBotEvent" ADD COLUMN "bot" TEXT NOT NULL DEFAULT 'hunting';

-- CreateIndex
CREATE INDEX "HuntingBotEvent_bot_createdAt_idx" ON "HuntingBotEvent"("bot", "createdAt");
