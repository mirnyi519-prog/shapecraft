import { readFile } from "fs/promises";
import path from "path";
import { publishWorldTrendsPayload } from "../src/lib/world-trends-bot";

async function main() {
  const force = process.argv.includes("--force");
  const fileArg = process.argv
    .slice(2)
    .find((arg) => arg !== "--force");
  const filePath = fileArg
    ? path.resolve(fileArg)
    : path.join(process.cwd(), "data", "world-import.json");

  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  const result = await publishWorldTrendsPayload({
    payload: parsed,
    force,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
