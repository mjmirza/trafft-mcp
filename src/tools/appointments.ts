import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { buildQuery, errorResult, textResult } from "../util.js";

export function registerAppointmentTools(server: McpServer, client: TrafftClient): void {
  server.tool(
    "list_appointments",
    "List appointments with optional filters by date range, employee, service, customer, and status.",
    {
      startDate: z.string().optional().describe("Filter from date, YYYY-MM-DD"),
      endDate: z.string().optional().describe("Filter to date, YYYY-MM-DD"),
      employeeId: z.number().int().positive().optional(),
      serviceId: z.number().int().positive().optional(),
      customerId: z.number().int().positive().optional(),
      status: z
        .enum(["approved", "pending", "canceled", "rejected", "no-show"])
        .optional()
        .describe("Appointment status filter"),
      page: z.number().int().positive().optional(),
      limit: z.number().int().positive().optional(),
    },
    async (args) => {
      try {
        // Default to a small page to keep results token-lean.
        const q = buildQuery({ ...args, limit: args.limit ?? 20 });
        return textResult(await client.get(`/appointments${q}`));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.tool(
    "get_appointment",
    "Get a single appointment by id.",
    { id: z.number().int().positive().describe("Appointment id") },
    async ({ id }) => {
      try {
        return textResult(await client.get(`/appointments/${id}`));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.tool(
    "cancel_appointment",
    "Cancel an appointment by id. Sets its status to canceled. Confirm with the user first.",
    { id: z.number().int().positive().describe("Appointment id") },
    async ({ id }) => {
      try {
        await client.delete(`/appointments/${id}`);
        return textResult(`Appointment ${id} canceled.`);
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
