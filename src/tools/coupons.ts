import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { errorResult, textResult } from "../util.js";

export function registerCouponTools(server: McpServer, client: TrafftClient): void {
  server.tool(
    "list_coupons",
    "List all coupon codes with their discount and usage stats. Requires the Coupons feature.",
    {},
    async () => {
      try {
        return textResult(await client.get(`/coupons`));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.tool(
    "create_coupon",
    "Create a discount coupon.",
    {
      code: z.string().describe("Coupon code, case insensitive"),
      discount: z.number().positive().describe("Discount amount or percentage value"),
      discountType: z
        .enum(["percent", "fixed"])
        .describe("percent for a percentage, fixed for a flat amount"),
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Max number of uses. Omit for unlimited."),
      expirationDate: z.string().optional().describe("Expiry date, YYYY-MM-DD"),
    },
    async (args) => {
      try {
        return textResult(await client.post(`/coupons`, args));
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
