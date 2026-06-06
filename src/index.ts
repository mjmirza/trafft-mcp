#!/usr/bin/env node
/**
 * trafft-mcp
 * A Model Context Protocol server that exposes the Trafft booking API as tools.
 *
 * Transport. stdio (JSON-RPC over stdin/stdout). The server is spawned by the
 * MCP client (Claude Code, Claude Desktop, Cursor, and others) and kept alive
 * for the session.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import "dotenv/config";

import { TrafftClient } from "./client.js";
import { registerAppointmentTools } from "./tools/appointments.js";
import { registerBookingTools } from "./tools/bookings.js";
import { registerCustomerTools } from "./tools/customers.js";
import { registerEmployeeTools } from "./tools/employees.js";
import { registerLocationTools } from "./tools/locations.js";
import { registerServiceTools } from "./tools/services.js";
import { registerAvailabilityTools } from "./tools/availability.js";
import { registerCouponTools } from "./tools/coupons.js";

const apiUrl = process.env.TRAFFT_API_URL;
const clientId = process.env.TRAFFT_CLIENT_ID;
const clientSecret = process.env.TRAFFT_CLIENT_SECRET;
const apiPath = process.env.TRAFFT_API_PATH;

if (!apiUrl || !clientId || !clientSecret) {
  console.error(
    "Missing configuration. Set TRAFFT_API_URL, TRAFFT_CLIENT_ID and " +
      "TRAFFT_CLIENT_SECRET in the environment. See .env.example.",
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const client = new TrafftClient({
    apiUrl: apiUrl as string,
    clientId: clientId as string,
    clientSecret: clientSecret as string,
    apiPath,
  });

  // Fail fast with a clear message if credentials are wrong.
  await client.authenticate();

  const server = new McpServer({
    name: "trafft",
    version: "1.0.0",
  });

  registerAppointmentTools(server, client);
  registerAvailabilityTools(server, client);
  registerBookingTools(server, client);
  registerCustomerTools(server, client);
  registerEmployeeTools(server, client);
  registerLocationTools(server, client);
  registerServiceTools(server, client);
  registerCouponTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Stderr is safe. Stdout is reserved for the JSON-RPC protocol.
  console.error("trafft-mcp is running on stdio.");
}

main().catch((err) => {
  console.error("Fatal error starting trafft-mcp:", err instanceof Error ? err.message : err);
  process.exit(1);
});
