# Trafft Webhooks

Trafft webhooks are outbound. Trafft sends a POST to a URL you control when something happens. They are not inbound, so you cannot trigger Trafft actions by calling a webhook. The webhook feature must be enabled in Features and Integrations.

This MCP server does not receive webhooks itself. The tools poll the API on demand. This document is here so you know the option exists and how to wire it up alongside the server.

## Available events

| Event | Fires when |
|---|---|
| appointment.booked | A new appointment is created |
| appointment.canceled | An appointment is canceled |
| appointment.rescheduled | An appointment moves to a new time |
| appointment.statusChanged | An appointment status changes |
| customer.created | A new customer record is created |

## Payload fields

Each webhook POST includes fields such as these.

- appointmentStatus, appointmentStartDateTime, appointmentEndDateTime, appointmentPrice
- customerFullName, customerFirstName, customerLastName, customerEmail, customerPhone
- employeeFullName, employeeEmail, employeePhone
- serviceCategory, serviceName, serviceDuration, servicePrice, extras
- locationName, locationAddress, locationPhone
- customFields

## Security

Each webhook request carries a verification token in the Authorization header. Get yours from Features and Integrations, then Webhooks, then the Verification Token button. Validate incoming requests against that token so a stranger cannot spoof events.

## Limits

- One webhook per event type. One booking webhook, one cancellation webhook, and so on.
- Outbound only. There is no inbound webhook to drive Trafft from outside.

## A useful pattern

If you want real-time reactions, point the single webhook for an event at an automation tool (for example an n8n or Make webhook node), then fan out to as many downstream systems as you like from there. That sidesteps the one-webhook-per-event limit cleanly.

## Source

- Trafft webhooks documentation, https://trafft.com/docs/custom-features/configure-webhooks/
