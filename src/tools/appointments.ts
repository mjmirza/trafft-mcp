import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { buildQuery, errorResult, textResult } from "../util.js";

// Trafft rejects date query params with 422. A date range is applied here.
const SCAN_PAGE_CAP = 10;
const PAGE_SIZE_CAP = 100;

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
  .refine((value) => isCalendarDate(value), "date must be a real calendar day");

export function registerAppointmentTools(server: McpServer, client: TrafftClient): void {
  server.tool(
    "list_appointments",
    "List appointments, newest first. Filter by status, and page through. dateFrom and dateTo (YYYY-MM-DD, inclusive) keep appointments whose start_date_time falls on those calendar dates. The date is the one Trafft put in start_date_time, with no timezone conversion. Those dates are not sent to the API, which rejects date filters. The tool reads up to 10 pages. When incomplete is true, call again with page set to resumePage and the same dates. Employee, service, and customer still have to be matched from the records.",
    {
      status: z
        .enum(["approved", "pending", "canceled", "rejected", "no-show"])
        .optional()
        .describe("Appointment status filter"),
      dateFrom: calendarDate
        .optional()
        .describe("Inclusive start date, YYYY-MM-DD. Applied locally, not sent to the API."),
      dateTo: calendarDate
        .optional()
        .describe("Inclusive end date, YYYY-MM-DD. Applied locally, not sent to the API."),
      page: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Page number. With a date range, the page to start or resume from."),
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Page size. With a date range, also the maximum matches returned (capped at 100)."),
    },
    async (args) => {
      try {
        const requested = args.limit ?? 20;
        if (args.dateFrom === undefined && args.dateTo === undefined) {
          // Default to a small page to keep results token-lean.
          const q = buildQuery({ status: args.status, page: args.page, limit: requested });
          return textResult(await client.get(`/appointments${q}`));
        }
        const rangeError = dateRangeError(args.dateFrom, args.dateTo);
        if (rangeError) return errorResult(new Error(rangeError));

        // Pages are requested at `limit` records. resumePage is the first
        // page whose matches were not returned, so a follow-up does not
        // skip or repeat a row.
        const limit = Math.min(requested, PAGE_SIZE_CAP);
        const startPage = args.page ?? 1;
        const matched: unknown[] = [];
        let scannedPages = 0;
        let resumePage: number | undefined;
        let page = startPage;

        while (scannedPages < SCAN_PAGE_CAP) {
          const q = buildQuery({ status: args.status, page, limit });
          const payload = await client.get(`/appointments${q}`);
          scannedPages += 1;
          const pageMatches = recordsOf(payload).filter((record) => {
            const day = appointmentStartDate(record);
            return day !== undefined && inRange(day, args.dateFrom, args.dateTo);
          });
          const more = hasMorePages(payload, page, limit);
          if (matched.length > 0 && matched.length + pageMatches.length > limit) {
            resumePage = page;
            break;
          }
          matched.push(...pageMatches);
          if (!more) break;
          if (matched.length >= limit || scannedPages === SCAN_PAGE_CAP) {
            resumePage = page + 1;
            break;
          }
          page += 1;
        }

        const note =
          resumePage === undefined
            ? "Date range was applied locally. The Trafft API does not filter appointments by date."
            : `Date range was applied locally. More appointments may match. Call again with page ${resumePage} and the same dates.`;
        return textResult({
          data: matched,
          matched: matched.length,
          fromPage: startPage,
          scannedPages,
          incomplete: resumePage !== undefined,
          resumePage,
          note,
        });
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

/** Calendar date of an appointment, taken from start_date_time as returned. */
export function appointmentStartDate(record: unknown): string | undefined {
  if (!record || typeof record !== "object") return undefined;
  const raw = (record as { start_date_time?: unknown }).start_date_time;
  if (typeof raw !== "string") return undefined;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  return match ? match[1] : undefined;
}

/** True for a real YYYY-MM-DD day, so 2026-02-31 is rejected. */
export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function dateRangeError(dateFrom: string | undefined, dateTo: string | undefined): string | undefined {
  if (dateFrom !== undefined && !isCalendarDate(dateFrom)) return "dateFrom must be a real date in YYYY-MM-DD.";
  if (dateTo !== undefined && !isCalendarDate(dateTo)) return "dateTo must be a real date in YYYY-MM-DD.";
  if (dateFrom !== undefined && dateTo !== undefined && dateFrom > dateTo) {
    return "dateFrom must be on or before dateTo.";
  }
  return undefined;
}

function inRange(day: string, dateFrom: string | undefined, dateTo: string | undefined): boolean {
  if (dateFrom !== undefined && day < dateFrom) return false;
  if (dateTo !== undefined && day > dateTo) return false;
  return true;
}

function recordsOf(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const body = payload as { data?: unknown; items?: unknown };
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body.items)) return body.items;
  return [];
}

function hasMorePages(payload: unknown, page: number, pageSize: number): boolean {
  // Trust pagination.pages when Trafft sends it. A short page is the end
  // only when that count is missing, so a smaller server page size still
  // gets walked.
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const pages = (payload as { pagination?: { pages?: unknown } }).pagination?.pages;
    if (typeof pages === "number" && Number.isFinite(pages)) return page < pages;
  }
  return recordsOf(payload).length >= pageSize;
}
