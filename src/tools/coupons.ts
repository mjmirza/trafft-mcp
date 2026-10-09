import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { errorResult, textResult } from "../util.js";

export function registerCouponTools(server: McpServer, client: TrafftClient): void {
  server.tool(
    "create_coupon",
    "Create a discount coupon. The discount value is interpreted per the account's coupon settings.",
    {
      code: z.string().describe("Coupon code, case insensitive"),
      discountValue: z.number().positive().describe("Discount value"),
      expirationDate: z.string().optional().describe("Expiry date, YYYY-MM-DD"),
      usageLimit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Max total uses. Omit for unlimited."),
      limitPerUser: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Max uses per customer. Omit for unlimited."),
      bookingLimitAmount: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Max bookings the coupon applies to in one checkout."),
    },
    async (args) => {
      try {
        // The numeric limit fields must be present. send explicit null when
        // unset, otherwise the API returns 422.
        const body = {
          code: args.code,
          discount_value: args.discountValue,
          expiration_date: args.expirationDate ?? null,
          usage_limit: args.usageLimit ?? null,
          limit_per_user: args.limitPerUser ?? null,
          booking_limit_amount: args.bookingLimitAmount ?? null,
        };
        return textResult(await client.post(`/coupons`, body));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.tool(
    "delete_coupon",
    "Delete a coupon by id. Confirm with the user first.",
    { id: z.number().int().positive().describe("Coupon id") },
    async ({ id }) => {
      try {
        await client.delete(`/coupons/${id}`);
        return textResult(`Coupon ${id} deleted.`);
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
