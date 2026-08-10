import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export async function connectMetrc(mockBaseUrl: string): Promise<Client> {
  const serverPath = process.env.METRC_MCP_PATH;
  if (!serverPath) throw new Error("Set METRC_MCP_PATH to metrc-mcp/dist/index.js");

  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath],
    env: {
      ...process.env as Record<string, string>,
      METRC_STATE: "ok",
      METRC_VENDOR_API_KEY: "vendor-key-123",
      METRC_USER_API_KEY: "user-key-456",
      METRC_LICENSE_NUMBER: "PROC-000-TEST",
      METRC_BASE_URL: mockBaseUrl,
    },
  });
  const client = new Client({ name: "compliance-agent", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

/** MCP tool results wrap JSON in a text block; unwrap and parse it. */
export function parseToolJson<T>(result: unknown): T {
  const content = (result as { content: Array<{ type: string; text: string }> }).content;
  const text = content.find((c) => c.type === "text")?.text ?? "";
  return JSON.parse(text) as T;
}

export async function connectRegulatory(): Promise<Client> {
  const serverPath = process.env.REGULATORY_MCP_PATH;
  if (!serverPath) {
    throw new Error("Set REGULATORY_MCP_PATH to mcp-regulatory-cannabis/build/index.js");
  }
  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath],
    env: { ...process.env as Record<string, string> },
  });
  const client = new Client({ name: "compliance-agent", version: "0.1.0" });
  await client.connect(transport);
  return client;
}