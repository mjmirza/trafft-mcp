import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { errorResult, textResult } from "../util.js";

export function registerLocationTools(server: McpServer, client: TrafftClient): void {
  server.tool(
    "list_locations",
    "List all locations in the Trafft account. Requires the Multiple Locations feature.",
    {},
    async () => {
      try {
        return textResult(await client.get(`/locations`));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.tool(
    "get_location",
    "Get a single location by id.",
    { id: z.number().int().positive().describe("Location id") },
    async ({ id }) => {
      try {
        return textResult(await client.get(`/locations/${id}`));
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
