import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { errorResult, textResult } from "../util.js";

export function registerBookingTools(server: McpServer, client: TrafftClient): void {
  server.tool(
    "create_booking",
    "Create a new booking (appointment). Provide either an existing customerId or the customer fields to create one. Call get_available_times first to confirm the slot is open.",
    {
      serviceId: z.number().int().positive().describe("Service id"),
      employeeId: z.number().int().positive().describe("Employee id"),
      bookingStart: z
        .string()
        .describe("Start datetime in YYYY-MM-DD HH:mm:ss format (space separated)"),
      locationId: z.number().int().positive().optional().describe("Optional location id"),
      customerId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Existing customer id. Omit to create a new customer from the fields below."),
      customerFirstName: z.string().optional().describe("Required when customerId is omitted"),
      customerLastName: z.string().optional().describe("Required when customerId is omitted"),
      customerEmail: z.string().email().optional(),
      customerPhone: z.string().optional(),
      couponCode: z.string().optional().describe("Optional discount coupon code"),
      notifyParticipants: z
        .boolean()
        .optional()
        .describe("Send email and SMS notifications. Defaults to true on the Trafft side."),
    },
    async (args) => {
      try {
        const payload: Record<string, unknown> = {
          serviceId: args.serviceId,
          employeeId: args.employeeId,
          bookingStart: args.bookingStart,
        };
        if (args.locationId !== undefined) payload.locationId = args.locationId;
        if (args.couponCode !== undefined) payload.couponCode = args.couponCode;
        if (args.notifyParticipants !== undefined) {
          payload.notifyParticipants = args.notifyParticipants;
        }
        if (args.customerId !== undefined) {
          payload.customerId = args.customerId;
        } else {
          if (!args.customerFirstName || !args.customerLastName) {
            throw new Error(
              "Provide either customerId, or customerFirstName and customerLastName for a new customer.",
            );
          }
          payload.customer = {
            firstName: args.customerFirstName,
            lastName: args.customerLastName,
            email: args.customerEmail,
            phone: args.customerPhone,
          };
        }
        return textResult(await client.post(`/bookings`, payload));
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
