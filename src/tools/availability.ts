import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { buildQuery, errorResult, textResult } from "../util.js";

export function registerAvailabilityTools(server: McpServer, client: TrafftClient): void {
  server.tool(
    "get_available_times",
    "Get open booking slots for a service on a date. Respects working hours, buffers, and existing appointments. Call this before create_booking to confirm a slot is free.",
    {
      serviceId: z.number().int().positive().describe("Service id"),
      date: z.string().describe("Date to check, YYYY-MM-DD"),
      employeeId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Optional. Limit to one employee. Omit to check all."),
      locationId: z.number().int().positive().optional().describe("Optional location id"),
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
