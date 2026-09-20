import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** Берём первые секунды — иначе GIF будет огромным. */
export const VIDEO_TO_GIF_MAX_SECONDS = 8;
/** Ширина кадра GIF (высота пропорционально). */
export const VIDEO_TO_GIF_WIDTH = 480;
export const VIDEO_TO_GIF_FPS = 10;

const VIDEO_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

export function isVideoUpload(file: {
  type?: string;
  name?: string;
}): boolean {
  const type = (file.type || "").toLowerCase();
  if (VIDEO_MIME.has(type)) {
    return true;
  }
  return VIDEO_EXT.test(file.name || "");
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 8000) {
        stderr = stderr.slice(-4000);
      }
    });

    child.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(
          new Error(
            "На сервере нет ffmpeg — пересоберите контейнер с поддержкой конвертации",
          ),
        );
        return;
      }
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const hint = stderr.trim().split("\n").slice(-3).join(" ");
      reject(
        new Error(
          hint
            ? `Не удалось перекодировать видео в GIF: ${hint}`
            : "Не удалось перекодировать видео в GIF",
        ),
      );
    });
  });
}

/**
 * MP4/WebM/MOV → анимированный GIF (обрезка, уменьшение кадра).
 */
export async function convertVideoBufferToGif(
  buffer: Buffer,
  originalName: string,
): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "shapecraft-gif-"));
  const extMatch = originalName.match(VIDEO_EXT);
  const ext = extMatch ? extMatch[0].toLowerCase() : ".mp4";
  const inputPath = path.join(dir, `input${ext}`);
  const outputPath = path.join(dir, "output.gif");

  try {
    await writeFile(inputPath, buffer);

    const filterComplex = [
      `fps=${VIDEO_TO_GIF_FPS},scale=${VIDEO_TO_GIF_WIDTH}:-1:flags=lanczos,split[s0][s1]`,
      "[s0]palettegen=max_colors=192:stats_mode=diff[p]",
      "[s1][p]paletteuse=dither=bayer:bayer_scale=3",
    ].join(";");

    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-t",
      String(VIDEO_TO_GIF_MAX_SECONDS),
      "-an",
      "-filter_complex",
      filterComplex,
      "-loop",
      "0",
      outputPath,
    ]);

    const gif = await readFile(outputPath);
    if (!gif.length) {
      throw new Error("Конвертация вернула пустой GIF");
    }
    return gif;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
