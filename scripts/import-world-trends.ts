import { readFile } from "fs/promises";
import path from "path";
import {
  importWorldTrends,
  parseImportArticles,
  publishWorldTrendsPayload,
} from "../src/lib/world-trends-bot";
import { prisma } from "../src/lib/db";

async function main() {
  const force = process.argv.includes("--force");
  const publish = process.argv.includes("--publish");
  const fileArg = process.argv
    .slice(2)
    .find((arg) => arg !== "--force" && arg !== "--publish");
  const filePath = fileArg
    ? path.resolve(fileArg)
    : path.join(process.cwd(), "data", "world-import.json");

  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const articles = parseImportArticles(parsed);

  const result = await importWorldTrends({
    articles,
    force,
    source: "cursor-agent-cli",
  });

  console.log(JSON.stringify({ local: result }, null, 2));

  if (publish) {
    const remote = await publishWorldTrendsPayload({
      payload: parsed,
      force,
    });
    console.log(JSON.stringify({ remote }, null, 2));
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
