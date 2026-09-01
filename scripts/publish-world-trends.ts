import { loadProjectEnv } from "./load-env";
import { triggerRemoteWorldSync } from "../src/lib/world-trends-bot";

loadProjectEnv();

async function main() {
  const force = process.argv.includes("--force");
  const result = await triggerRemoteWorldSync({ force });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
