import { startMockMetrc } from "./mock-metrc.js";
import { connectMetrc, connectRegulatory } from "./mcp.js";
import { buildGraph } from "./graph.js";

async function main() {
  const label = process.argv[2] ?? "1A4FF0100000022000000101";
  const mockUrl = await startMockMetrc();
  const metrc = await connectMetrc(mockUrl);
  const regulatory = await connectRegulatory();
  const graph = buildGraph(metrc, regulatory);

  const final = await graph.invoke({ packageLabel: label });
  console.log(JSON.stringify(final, null, 2));

  await metrc.close();
  await regulatory.close();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });