# Trafft API Reference

This is the endpoint reference that `trafft-mcp` is built on. The Trafft API is in beta, so always confirm against your own instance with `npm run audit`.

## Base URL

All calls go to your instance base URL plus the version path.

```
{TRAFFT_API_URL}{TRAFFT_API_PATH}
```

`TRAFFT_API_URL` is the full base URL of your Trafft (no trailing slash). `TRAFFT_API_PATH` defaults to `/api/v1`. So a cloud account resolves to `https://yoursubdomain.trafft.com/api/v1`.

## Authentication

Trafft uses a Bearer token. The server exchanges your client credentials for a token, then sends that token on every request.

```
POST {base}/auth/token
Content-Type application/json

{ "clientId": "...", "clientSecret": "..." }
```

A success response carries a token.

```
{ "token": "..." }
```

Every other request then carries the token.

```
Authorization Bearer {token}
```

The server refreshes the token automatically when a request returns 401.

> A note on field names. The credentials in the Trafft API card are a Client ID and a Client Secret. The token request body uses `clientId` and `clientSecret`. White-label and self-hosted instances can differ. If your instance documents a different token body or path, adjust `authenticate` in `src/client.ts` and set `TRAFFT_API_PATH` as needed. Run `npm run audit` to confirm the handshake works before relying on it.

## Endpoints

### Customers

| Method | Path | Purpose |
|---|---|---|
| GET | /customers | List customers (search, page, limit) |
| GET | /customers/{id} | Get one customer |
| POST | /customers | Create a customer |
| PUT | /customers/{id} | Update a customer |
| DELETE | /customers/{id} | Delete a customer |

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
| GET | /available-times | Open slots for a serviceId on a date (optional employeeId, locationId) |

### Appointments

| Method | Path | Purpose |
|---|---|---|
| GET | /appointments | List appointments (date range, employeeId, serviceId, customerId, status, page, limit) |
| GET | /appointments/{id} | Get one appointment |
| DELETE | /appointments/{id} | Cancel an appointment |

### Bookings

| Method | Path | Purpose |
|---|---|---|
| POST | /bookings | Create an appointment for a new or existing customer |

The booking body takes `serviceId`, `employeeId`, and `bookingStart` in `YYYY-MM-DD HH:mm:ss` form. Pass `customerId` for an existing customer, or a `customer` object to create one. Optional fields are `locationId`, `couponCode`, and `notifyParticipants`.

### Coupons

| Method | Path | Purpose |
|---|---|---|
| GET | /coupons | List coupons (needs Coupons feature) |
| POST | /coupons | Create a coupon |
| DELETE | /coupons/{id} | Delete a coupon |

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
