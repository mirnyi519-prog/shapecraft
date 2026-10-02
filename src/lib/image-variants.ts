import { readFile, stat, writeFile } from "fs/promises";
import sharp from "sharp";

/** Длинная сторона копии для сетки каталога. */
export const CARD_MAX_EDGE = 640;
export const CARD_WEBP_QUALITY = 75;

/** Анимированный GIF товара: меньше кадр, анимация сохраняется. */
export const GIF_MAX_EDGE = 480;

/** Стоп-кадр для блока «В мире». */
export const POSTER_MAX_EDGE = 960;
export const POSTER_WEBP_QUALITY = 80;

export function cardCachePath(sourcePath: string): string {
  return `${sourcePath}.card.webp`;
}

function isGifBuffer(input: Buffer): boolean {
  return (
    input.length >= 6 &&
    input[0] === 0x47 &&
    input[1] === 0x49 &&
    input[2] === 0x46 &&
    input[3] === 0x38 &&
    (input[4] === 0x39 || input[4] === 0x37) &&
    input[5] === 0x61
  );
}

/** Первый кадр → компактный WebP для карточки. */
export async function renderCardWebp(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "none", animated: false, pages: 1 })
    .rotate()
    .resize({
      width: CARD_MAX_EDGE,
      height: CARD_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: CARD_WEBP_QUALITY, effort: 4 })
    .toBuffer();
}

/** Стоп-кадр GIF/видео-превью для «В мире». */
export async function stillWebpPoster(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "none", animated: false, pages: 1 })
    .rotate()
    .resize({
      width: POSTER_MAX_EDGE,
      height: POSTER_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: POSTER_WEBP_QUALITY, effort: 4 })
    .toBuffer();
}

async function gifFrameCount(input: Buffer): Promise<number> {
  try {
    const meta = await sharp(input, { animated: true }).metadata();
    return meta.pages ?? 1;
  } catch {
    return 1;
  }
}

/** Ужимает анимированный GIF. Если выигрыша нет — возвращает исходник. */
export async function shrinkAnimatedGif(input: Buffer): Promise<Buffer> {
  if (!isGifBuffer(input)) {
    return input;
  }

  const pages = await gifFrameCount(input);
  if (pages <= 1) {
    return input;
  }

  const attempts: { edge: number; colours: number }[] = [
    { edge: GIF_MAX_EDGE, colours: 128 },
    { edge: 360, colours: 64 },
  ];

  let best = input;
  for (const attempt of attempts) {
    if (best.length < 400_000 && best !== input) {
      break;
    }
    try {
      const out = await sharp(input, { animated: true, failOn: "none" })
        .resize({
          width: attempt.edge,
          height: attempt.edge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .gif({ effort: 7, colours: attempt.colours })
        .toBuffer();
      if (out.length > 0 && out.length < best.length) {
        best = out;
      }
    } catch {
      // оставляем лучший из предыдущих проходов
    }
  }

  return best;
}

/** Пишет кэш карточки рядом с файлом, если его ещё нет или исходник новее. */
export async function ensureCardVariant(sourcePath: string): Promise<string> {
  const cardPath = cardCachePath(sourcePath);
  const sourceStat = await stat(sourcePath);
  try {
    const cardStat = await stat(cardPath);
    if (cardStat.size > 0 && cardStat.mtimeMs >= sourceStat.mtimeMs) {
      return cardPath;
    }
  } catch {
    // файла ещё нет
  }

  const out = await renderCardWebp(await readFile(sourcePath));
  await writeFile(cardPath, out);
  return cardPath;
}
