-- Multi-team / multi-book support.
--
-- Every Investor, GoldTransaction and Expense now belongs to a Team. This
-- migration is additive and backfills all existing rows into one default team
-- ("AU Investors – Team 1"), so the currently-deployed code keeps working until
-- the team-aware code ships. The teamId columns are left nullable on purpose —
-- a later migration can tighten them to NOT NULL once every write path sets one.

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyCutPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- AlterTable
ALTER TABLE "Investor" ADD COLUMN     "companyCutPct" DOUBLE PRECISION,
ADD COLUMN     "teamId" TEXT;

-- AlterTable
ALTER TABLE "GoldTransaction" ADD COLUMN     "teamId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "teamId" TEXT;

-- Seed the default team and move every existing row into it.
INSERT INTO "Team" ("id", "name", "companyCutPct", "createdAt")
VALUES ('team_seed_1', 'AU Investors – Team 1', 0, CURRENT_TIMESTAMP);

UPDATE "Investor"        SET "teamId" = 'team_seed_1' WHERE "teamId" IS NULL;
UPDATE "GoldTransaction" SET "teamId" = 'team_seed_1' WHERE "teamId" IS NULL;
UPDATE "Expense"         SET "teamId" = 'team_seed_1' WHERE "teamId" IS NULL;

-- CreateIndex
CREATE INDEX "Investor_teamId_idx" ON "Investor"("teamId");

-- CreateIndex
CREATE INDEX "GoldTransaction_teamId_idx" ON "GoldTransaction"("teamId");

-- CreateIndex
CREATE INDEX "Expense_teamId_idx" ON "Expense"("teamId");

-- AddForeignKey
ALTER TABLE "Investor" ADD CONSTRAINT "Investor_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoldTransaction" ADD CONSTRAINT "GoldTransaction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
