/**
 * Пересжимает уже загруженные фото в uploads → WebP и обновляет URL в БД.
 *
 *   npx tsx scripts/optimize-uploads.ts
 *   npx tsx scripts/optimize-uploads.ts --dry-run
 *
 * В Docker на сервере:
 *   docker compose exec app npx tsx scripts/optimize-uploads.ts
 */
import { readdir, readFile, unlink, writeFile, stat } from "fs/promises";
import path from "path";
import { loadProjectEnv } from "./load-env";

loadProjectEnv();

import { prisma } from "../src/lib/db";
import { optimizeImageBuffer } from "../src/lib/optimize-image";
import { getUploadsDir } from "../src/lib/upload";

const SKIP_EXT = new Set([".gif", ".svg", ".mp4", ".webm", ".mov"]);
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"]);

function mediaUrl(filename: string): string {
  return `/api/media/${filename}`;
}

async function replaceUrlEverywhere(
  fromUrl: string,
  toUrl: string,
): Promise<number> {
  if (fromUrl === toUrl) {
    return 0;
  }

  let updated = 0;

  const products = await prisma.product.updateMany({
    where: { imageUrl: fromUrl },
    data: { imageUrl: toUrl },
  });
  updated += products.count;

  const images = await prisma.productImage.updateMany({
    where: { url: fromUrl },
    data: { url: toUrl },
  });
  updated += images.count;

  const banners = await prisma.storeBanner.updateMany({
    where: { imageUrl: fromUrl },
    data: { imageUrl: toUrl },
  });
  updated += banners.count;

  const articles = await prisma.worldTrendArticle.updateMany({
    where: { imageUrl: fromUrl },
    data: { imageUrl: toUrl },
  });
  updated += articles.count;

  return updated;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const uploadDir = getUploadsDir();
  console.log(`Uploads: ${uploadDir}`);
  console.log(dryRun ? "Mode: dry-run" : "Mode: write");

  let entries: string[];
  try {
    entries = await readdir(uploadDir);
  } catch (error) {
    console.error("Не удалось прочитать uploads:", error);
    process.exit(1);
  }

  let processed = 0;
  let skipped = 0;
  let savedBytes = 0;
  let dbHits = 0;

  for (const name of entries) {
    const ext = path.extname(name).toLowerCase();
    if (SKIP_EXT.has(ext) || !IMAGE_EXT.has(ext)) {
      skipped += 1;
      continue;
    }

    const filePath = path.join(uploadDir, name);
    let fileStat;
    try {
      fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        continue;
      }
    } catch {
      continue;
    }

    const input = await readFile(filePath);
    const before = input.length;
    const optimized = await optimizeImageBuffer(input);

    if (optimized.skipped) {
      console.log(`skip  ${name} (${optimized.reason}, ${before} B)`);
      skipped += 1;
      continue;
    }

    const after = optimized.buffer.length;
    const newName =
      ext === ".webp"
        ? name
        : `${path.basename(name, ext)}${optimized.extension}`;
    const newPath = path.join(uploadDir, newName);
    const fromUrl = mediaUrl(name);
    const toUrl = mediaUrl(newName);

    console.log(
      `${dryRun ? "would " : ""}opt   ${name} → ${newName}  ${before} → ${after} B (−${Math.round((1 - after / before) * 100)}%)`,
    );

    if (!dryRun) {
      await writeFile(newPath, optimized.buffer);
      if (newName !== name) {
        try {
          await unlink(filePath);
        } catch {
          // ignore
        }
      }
      dbHits += await replaceUrlEverywhere(fromUrl, toUrl);
      // legacy path without /api
      dbHits += await replaceUrlEverywhere(`/uploads/${name}`, toUrl);
    }

    savedBytes += before - after;
    processed += 1;
  }

  // Подчистим ссылки в БД, где файл уже webp, а URL ещё на старое имя
  // (на случай повторного запуска — уже обработано выше).

  console.log(
    JSON.stringify(
      {
        processed,
        skipped,
        savedKB: Math.round(savedBytes / 1024),
        dbRowsUpdated: dbHits,
        dryRun,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
