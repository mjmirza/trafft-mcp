import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { buildQuery, errorResult, textResult } from "../util.js";

export function registerAvailabilityTools(server: McpServer, client: TrafftClient): void {
  server.tool(
    "get_available_times",
    "Get upcoming open booking slots for a service, grouped by date. Respects working hours, buffers, and existing appointments. Returns a rolling window of upcoming days (the API does not take a date filter, so pick the date you need from the result). Call this before create_booking to confirm a slot is free.",
    {
      service: z.number().int().positive().describe("Service id"),
      employee: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Optional. Limit to one employee. Omit to check all."),
      location: z.number().int().positive().optional().describe("Optional location id"),
    },
    async (args) => {
      try {
        return textResult(await client.get(`/available-times${buildQuery(args)}`));
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
