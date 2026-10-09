import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { buildQuery, errorResult, textResult } from "../util.js";

export function registerCustomerTools(server: McpServer, client: TrafftClient): void {
  server.tool(
    "list_customers",
    "List customers in the Trafft account, newest first, with pagination. The API has no server-side search, so page through and match client side.",
    {
      page: z.number().int().positive().optional().describe("Page number"),
      limit: z.number().int().positive().optional().describe("Results per page"),
    },
    async (args) => {
      try {
        // Default to a small page to keep results token-lean.
        const q = buildQuery({ ...args, limit: args.limit ?? 20 });
        return textResult(await client.get(`/customers${q}`));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.tool(
    "get_customer",
    "Get a single customer by id.",
    { id: z.number().int().positive().describe("Customer id") },
    async ({ id }) => {
      try {
        return textResult(await client.get(`/customers/${id}`));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.tool(
    "create_customer",
    "Create a new customer record.",
    {
      firstName: z.string().describe("First name"),
      lastName: z.string().describe("Last name"),
      email: z.string().email().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number in international format, e.g. +491701234567"),
      description: z.string().optional().describe("Internal note about the customer"),
    },
    async (args) => {
      try {
        const body = {
          first_name: args.firstName,
          last_name: args.lastName,
          email: args.email,
          phone: args.phone,
          description: args.description,
        };
        return textResult(await client.post(`/customers`, body));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.tool(
    "update_customer",
    "Update an existing customer. Provide the id and any fields to change.",
    {
      id: z.number().int().positive().describe("Customer id"),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional().describe("Phone number in international format"),
      description: z.string().optional().describe("Internal note about the customer"),
    },
    async ({ id, firstName, lastName, email, phone, description }) => {
      try {
        // PATCH 500s on a partial body. it requires first_name, last_name,
        // email, and phone, so read the record and merge the changes over it.
        const current = (await client.get(`/customers/${id}`)) as {
          first_name?: string;
          last_name?: string;
          email?: string;
          phone_number?: string;
        };
        const body: Record<string, unknown> = {
          first_name: firstName ?? current.first_name ?? "",
          last_name: lastName ?? current.last_name ?? "",
          email: email ?? current.email ?? "",
          phone: phone ?? current.phone_number ?? "",
        };
        // description is optional on PATCH and is not returned by GET, so only
        // send it when the caller is changing it, otherwise it stays as is.
        if (description !== undefined) body.description = description;
        return textResult(await client.patch(`/customers/${id}`, body));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.tool(
    "delete_customer",
    "Delete a customer by id. This is destructive. Confirm with the user before calling.",
    { id: z.number().int().positive().describe("Customer id") },
    async ({ id }) => {
      try {
        await client.delete(`/customers/${id}`);
        return textResult(`Customer ${id} deleted.`);
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
