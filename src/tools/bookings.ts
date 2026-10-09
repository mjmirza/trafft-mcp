import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { errorResult, textResult } from "../util.js";

export function registerBookingTools(server: McpServer, client: TrafftClient): void {
  // CODE_DELETE_OK: rewrite booking payload to the verified Trafft v2 contract (service/employee/date/time/customer-id); old serviceId/bookingStart + inline-customer shape does not exist in v2.
  server.tool(
    "create_booking",
    "Book an appointment for an existing customer. The customer must already exist (use list_customers or create_customer first to get the id). Call get_available_times first to confirm the slot is open.",
    {
      service: z.number().int().positive().describe("Service id"),
      employee: z.number().int().positive().describe("Employee id"),
      customer: z.number().int().positive().describe("Existing customer id"),
      date: z.string().describe("Date in YYYY-MM-DD format"),
      time: z.string().describe("Start time in 24-hour HH:mm format, e.g. 14:30"),
      location: z.number().int().positive().optional().describe("Optional location id"),
      status: z
        .number()
        .int()
        .optional()
        .describe("Optional appointment status code. Omit to use the account default."),
    },
    async (args) => {
      try {
        const payload: Record<string, unknown> = {
          service: args.service,
          employee: args.employee,
          customer: args.customer,
          date: args.date,
          time: args.time,
        };
        if (args.location !== undefined) payload.location = args.location;
        if (args.status !== undefined) payload.status = args.status;
        return textResult(await client.post(`/bookings`, payload));
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
