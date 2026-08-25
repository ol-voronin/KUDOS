-- Медіатека: реєстр завантажених картинок.

CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- Унікальний шлях у сховищі: два рядки на один файл означали б, що видалення
-- одного лишає другий із мертвим посиланням.
CREATE UNIQUE INDEX "MediaAsset_pathname_key" ON "MediaAsset"("pathname");
CREATE INDEX "MediaAsset_createdAt_idx" ON "MediaAsset"("createdAt");

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
