# Trafft API Reference

This is the endpoint reference that `trafft-mcp` is built on. The contract below was verified live against a Trafft v2 instance (`flows.admin.next8n.com`) on 2026-10-09. Always confirm against your own instance with `npm run audit`.

## Base URL

All calls go to your instance base URL plus the version path.

```
{TRAFFT_API_URL}{TRAFFT_API_PATH}
```

`TRAFFT_API_URL` is the full base URL of your Trafft (no trailing slash). `TRAFFT_API_PATH` defaults to `/api/v2`. So a cloud account resolves to `https://yoursubdomain.trafft.com/api/v2`.

## Authentication

Trafft uses the OAuth2 client-credentials grant. The server exchanges your client credentials for a Bearer token, then sends that token on every request. The token body is form-encoded, not JSON.

```
POST {base}/token
Content-Type application/x-www-form-urlencoded

grant_type=client_credentials&client_id=...&client_secret=...
```

A success response carries the token under `access_token`.

```
{ "token_type": "Bearer", "expires_in": 3600, "access_token": "..." }
```

Every other request then carries the token.

```
Authorization Bearer {access_token}
```

The server refreshes the token automatically when a request returns 401 (tokens expire after 3600 seconds).

> A note on field names. The credentials in the Trafft API card are a Client ID and a Client Secret. The token body uses the OAuth2 names `client_id` and `client_secret`. If your instance uses a different version path, set `TRAFFT_API_PATH`. Run `npm run audit` to confirm the handshake works before relying on it.

## Response shape

List endpoints return `{ "data": [ ... ], "pagination": { "total", "page", "limit", "pages" } }`. Single-record GETs return the object directly. Fields are snake_case (for example `first_name`, `phone_number`, `start_date_time`).

## Endpoints

### Customers

| Method | Path | Purpose |
|---|---|---|
| GET | /customers | List customers (page, limit. no search) |
| GET | /customers/{id} | Get one customer |
| POST | /customers | Create a customer (`first_name`, `last_name`, `email`, `phone`, `description`) |
| PATCH | /customers/{id} | Update a customer (same snake_case fields) |
| DELETE | /customers/{id} | Delete a customer |

Customer list has no server-side search. page through with `page` and `limit`.

### Employees

| Method | Path | Purpose |
|---|---|---|
| GET | /employees | List employees |
| GET | /employees/{id} | Get one employee |

### Locations

| Method | Path | Purpose |
|---|---|---|
| GET | /locations | List locations (needs Multiple Locations) |
| GET | /locations/{id} | Get one location |

### Services

| Method | Path | Purpose |
|---|---|---|
| GET | /services | List services |
| GET | /services/{id} | Get one service |

### Availability

| Method | Path | Purpose |
|---|---|---|
| GET | /available-times | Upcoming open slots for a `service` (optional `employee`, `location`). Returns a rolling window of upcoming dates; it does not accept a date filter. |

### Appointments

| Method | Path | Purpose |
|---|---|---|
| GET | /appointments | List appointments (`status`, `page`, `limit` only. no date/employee/service/customer filters) |
| DELETE | /appointments/{id} | Cancel an appointment |

There is no single-appointment GET (`GET /appointments/{id}` returns 405). Read one from the list.

### Bookings

| Method | Path | Purpose |
|---|---|---|
| POST | /bookings | Create an appointment for an existing customer |

The booking body takes `service` (id), `employee` (id), `customer` (existing customer id), `date` (`YYYY-MM-DD`), and `time` (`HH:mm`). Optional fields are `location` (id) and `status` (int). The customer must already exist. there is no inline-customer create on this endpoint, so call `POST /customers` first.

### Coupons

| Method | Path | Purpose |
|---|---|---|
| POST | /coupons | Create a coupon (`code`, `discount_value`, `expiration_date`, `usage_limit`, `limit_per_user`, `booking_limit_amount`) |
| DELETE | /coupons/{id} | Delete a coupon |

There is no coupon list endpoint (`GET /coupons` returns 405).

## Status values

Appointment status is one of `approved`, `pending`, `canceled`, `rejected`, or `no-show`. The default for new bookings is set in Trafft General Settings.

## What the API does not cover

The following portal features have no public API as of this writing.

- Employee working hours and schedules
- Payments, refunds, and invoices
- Service extras (add-ons)

The availability endpoint still honors schedule rules, because Trafft computes free slots on its side. The auditor probes for extra endpoints on your instance so you can see the true surface.

## Sources

- Trafft API overview, https://trafft.com/docs/custom-features/api/
- Trafft API Postman workspace, https://documenter.getpostman.com/view/1487056/2sAY4x9MRe
