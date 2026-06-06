import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { errorResult, textResult } from "../util.js";

export function registerServiceTools(server: McpServer, client: TrafftClient): void {
  server.tool(
    "list_services",
    "List all bookable services with their ids, durations, and prices.",
    {},
    async () => {
      try {
        return textResult(await client.get(`/services`));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.tool(
    "get_service",
    "Get full details of a service by id, including assigned employees.",
    { id: z.number().int().positive().describe("Service id") },
    async ({ id }) => {
      try {
        return textResult(await client.get(`/services/${id}`));
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
