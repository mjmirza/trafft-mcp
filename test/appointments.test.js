// Offline tests for list_appointments. No network. The date range must be
// applied locally, because Trafft returns 422 when a date is sent as a query
// parameter.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registerAppointmentTools,
  appointmentStartDate,
  isCalendarDate,
} from "../build/tools/appointments.js";

function harness(responder) {
  const calls = [];
  const tools = {};
  const server = {
    tool(name, _description, _schema, handler) {
      tools[name] = handler;
    },
  };
  const client = {
    async get(path) {
      calls.push(path);
      const page = Number(new URL(`https://example.test${path}`).searchParams.get("page") ?? "1");
      return responder(page, path);
    },
    async delete() {
      return {};
    },
  };
  registerAppointmentTools(server, client);
  return { calls, list: tools.list_appointments };
}

function envelope(records, page, pages) {
  return { data: records, pagination: { total: records.length, page, limit: records.length, pages } };
}

function appt(id, day, time = "09:00:00") {
  const start = day.includes("T") ? day : `${day} ${time}`;
  return { id, start_date_time: start, status: "approved" };
}

function parsed(result) {
  assert.equal(result.isError, undefined);
  return JSON.parse(result.content[0].text);
}

test("without a date range, one page is requested and dates are not sent", async () => {
  const { calls, list } = harness((page) => envelope([appt(1, "2026-11-24")], page, 1));
  const body = parsed(await list({ status: "approved", page: 2, limit: 5 }));
  assert.deepEqual(body.data.map((row) => row.id), [1]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], "/appointments?status=approved&page=2&limit=5");
});

test("the default page size stays 20 when no limit is given", async () => {
  const { calls, list } = harness((page) => envelope([], page, 1));
  await list({});
  assert.equal(calls[0], "/appointments?limit=20");
});

test("a date range keeps matching rows across pages and never sends the dates", async () => {
  const { calls, list } = harness((page) => {
    const rows = {
      1: [appt(1, "2026-11-20"), appt(2, "2026-11-24", "14:00:00")],
      2: [appt(3, "2026-11-24T18:30:00+01:00"), { id: 4, status: "approved" }],
    };
    return envelope(rows[page] ?? [], page, 2);
  });
  const body = parsed(await list({
    status: "no-show",
    dateFrom: "2026-11-23",
    dateTo: "2026-11-30",
  }));
  assert.deepEqual(body.data.map((row) => row.id), [2, 3]);
  assert.equal(body.matched, 2);
  assert.equal(body.incomplete, false);
  assert.equal(body.resumePage, undefined);
  assert.equal(body.scannedPages, 2);
  assert.equal(calls.length, 2);
  for (const url of calls) {
    assert.equal(url.includes("dateFrom"), false);
    assert.equal(url.includes("dateTo"), false);
    assert.match(url, /status=no-show/);
  }
  assert.match(calls[0], /page=1/);
  assert.match(calls[1], /page=2/);
});

test("a full page of matches resumes at the next page without repeating rows", async () => {
  const pages = {
    1: [appt(1, "2026-12-01"), appt(2, "2026-12-02")],
    2: [appt(3, "2026-12-03")],
  };
  const { calls, list } = harness((page) => envelope(pages[page] ?? [], page, 2));
  const first = parsed(await list({ dateFrom: "2026-12-01", dateTo: "2026-12-31", limit: 2 }));
  assert.deepEqual(first.data.map((row) => row.id), [1, 2]);
  assert.equal(first.incomplete, true);
  assert.equal(first.resumePage, 2);
  assert.equal(calls.length, 1);

  const second = parsed(await list({
    dateFrom: "2026-12-01",
    dateTo: "2026-12-31",
    limit: 2,
    page: first.resumePage,
  }));
  assert.deepEqual(second.data.map((row) => row.id), [3]);
  assert.equal(second.incomplete, false);
});

test("a later page is left unread when adding it would pass the match cap", async () => {
  const { calls, list } = harness((page) => {
    const rows = {
      1: [appt(1, "2026-12-01"), appt(2, "2026-11-01")],
      2: [appt(3, "2026-12-02"), appt(4, "2026-12-03")],
    };
    return envelope(rows[page], page, 2);
  });
  const body = parsed(await list({ dateFrom: "2026-12-01", limit: 2 }));
  assert.deepEqual(body.data.map((row) => row.id), [1]);
  assert.equal(body.resumePage, 2);
  assert.equal(calls.length, 2);
});

test("the scan stops after 10 pages and tells the caller where to resume", async () => {
  const { calls, list } = harness((page) => envelope([appt(page, "2026-01-01")], page, 12));
  const body = parsed(await list({ dateFrom: "2026-06-01", dateTo: "2026-06-30" }));
  assert.deepEqual(body.data, []);
  assert.equal(body.matched, 0);
  assert.equal(body.scannedPages, 10);
  assert.equal(body.incomplete, true);
  assert.equal(body.resumePage, 11);
  assert.equal(calls.length, 10);
});

test("a date range caps the requested page size at 100", async () => {
  const { calls, list } = harness((page) => envelope([], page, 1));
  await list({ dateFrom: "2026-11-01", limit: 250 });
  assert.match(calls[0], /limit=100/);
});

test("an items envelope and a bare array are both read", async () => {
  const items = harness(() => ({ items: [appt(7, "2026-11-24")] }));
  const fromItems = parsed(await items.list({ dateFrom: "2026-11-24", dateTo: "2026-11-24" }));
  assert.deepEqual(fromItems.data.map((row) => row.id), [7]);

  const bare = harness(() => [appt(8, "2026-11-24")]);
  const fromBare = parsed(await bare.list({ dateFrom: "2026-11-24" }));
  assert.deepEqual(fromBare.data.map((row) => row.id), [8]);
});

test("an impossible day or a reversed range is rejected before any request", async () => {
  const { calls, list } = harness(() => envelope([], 1, 1));
  const impossible = await list({ dateFrom: "2026-02-31" });
  assert.equal(impossible.isError, true);
  assert.match(impossible.content[0].text, /dateFrom/);
  const reversed = await list({ dateFrom: "2026-12-02", dateTo: "2026-12-01" });
  assert.equal(reversed.isError, true);
  assert.match(reversed.content[0].text, /on or before/);
  assert.equal(calls.length, 0);
});

test("appointmentStartDate reads the calendar date Trafft returns", () => {
  assert.equal(appointmentStartDate(appt(1, "2026-11-24")), "2026-11-24");
  assert.equal(appointmentStartDate({ start_date_time: "2026-11-24T00:30:00Z" }), "2026-11-24");
  assert.equal(appointmentStartDate({ start_date_time: " 2026-11-23T23:30:00+01:00 " }), "2026-11-23");
  assert.equal(appointmentStartDate({ id: 1 }), undefined);
  assert.equal(appointmentStartDate(null), undefined);
});

test("isCalendarDate rejects impossible days and accepts a leap day", () => {
  assert.equal(isCalendarDate("2024-02-29"), true);
  assert.equal(isCalendarDate("2026-02-29"), false);
  assert.equal(isCalendarDate("2026-02-31"), false);
  assert.equal(isCalendarDate("2026-13-01"), false);
  assert.equal(isCalendarDate("2026-11-24"), true);
});
