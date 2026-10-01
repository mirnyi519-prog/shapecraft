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
import {
  ensureCardVariant,
  shrinkAnimatedGif,
  stillWebpPoster,
} from "../src/lib/image-variants";
import { optimizeImageBuffer } from "../src/lib/optimize-image";
import { getUploadsDir } from "../src/lib/upload";

const SKIP_EXT = new Set([".svg", ".mp4", ".webm", ".mov"]);
const IMAGE_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
]);

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
    if (name.endsWith(".card.webp") || SKIP_EXT.has(ext) || !IMAGE_EXT.has(ext)) {
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
    const isWorldGif = ext === ".gif" && name.startsWith("world-");
    const isProductGif = ext === ".gif" && !isWorldGif;

    let nextBuffer: Buffer = input;
    let newName = name;
    let changed = false;

    if (isWorldGif) {
      nextBuffer = Buffer.from(await stillWebpPoster(input));
      newName = `${path.basename(name, ext)}.webp`;
      changed = true;
    } else if (isProductGif) {
      nextBuffer = Buffer.from(await shrinkAnimatedGif(input));
      changed = nextBuffer.length < before;
    } else {
      const optimized = await optimizeImageBuffer(input);
      if (!optimized.skipped) {
        nextBuffer = Buffer.from(optimized.buffer);
        newName =
          ext === ".webp"
            ? name
            : `${path.basename(name, ext)}${optimized.extension}`;
        changed = true;
      }
    }

    const after = nextBuffer.length;
    const newPath = path.join(uploadDir, newName);

    if (!changed) {
      console.log(`skip  ${name} (${before} B)`);
      skipped += 1;
      if (!dryRun) {
        try {
          await ensureCardVariant(filePath);
        } catch (error) {
          console.error("card", name, error);
        }
      }
      continue;
    }

    console.log(
      `${dryRun ? "would " : ""}${isWorldGif ? "poster" : "opt   "} ${name} → ${newName}  ${before} → ${after} B (−${Math.round((1 - after / before) * 100)}%)`,
    );

    if (!dryRun) {
      await writeFile(newPath, nextBuffer);
      try {
        await unlink(`${filePath}.card.webp`);
      } catch {
        // кэша карточки ещё нет
      }
      if (newName !== name) {
        try {
          await unlink(filePath);
        } catch {
          // ignore
        }
      }
      const fromUrl = mediaUrl(name);
      const toUrl = mediaUrl(newName);
      dbHits += await replaceUrlEverywhere(fromUrl, toUrl);
      dbHits += await replaceUrlEverywhere(`/uploads/${name}`, toUrl);
      try {
        await ensureCardVariant(newPath);
      } catch (error) {
        console.error("card", newName, error);
      }
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
