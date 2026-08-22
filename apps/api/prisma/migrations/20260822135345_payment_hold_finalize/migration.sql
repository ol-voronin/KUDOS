-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('DEBIT', 'HOLD');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "holdExpiresAt" TIMESTAMP(3),
ADD COLUMN     "paymentType" "PaymentType" NOT NULL DEFAULT 'DEBIT';
