import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { errorResult, textResult } from "../util.js";

export function registerEmployeeTools(server: McpServer, client: TrafftClient): void {
  server.tool(
    "list_employees",
    "List all employees (staff members) in the Trafft account.",
    {},
    async () => {
      try {
        return textResult(await client.get(`/employees`));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.tool(
    "get_employee",
    "Get a single employee by id, including assigned services.",
    { id: z.number().int().positive().describe("Employee id") },
    async ({ id }) => {
      try {
        return textResult(await client.get(`/employees/${id}`));
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
