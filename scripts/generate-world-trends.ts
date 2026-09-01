import { generateWorldTrends } from "../src/lib/world-trends-bot";
import { prisma } from "../src/lib/db";

async function main() {
  const force = process.argv.includes("--force");
  const result = await generateWorldTrends({ force });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
