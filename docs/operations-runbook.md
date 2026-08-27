# Operations Runbook

## Service Startup

Run `npm ci`, `npm run check`, `npm test`, and `npm audit --omit=dev --audit-level=high` before startup. Use `PORT=65074 npm start` for the standard listener. The server only accepts integer ports from 1024 through 65535 and binds to `0.0.0.0` for approved LAN access.

```bash
curl http://127.0.0.1:65074/health
```

The active state file is `data/replenishment-requests.json`. It is created after the first accepted operation. Use a controlled shutdown or a consistent filesystem snapshot before copying that file for backup.

## Replenishment Operations

| Operation | Actor role | Expected state |
| --- | --- | --- |
| Create request | `inventory_planner` | `draft` |
| Calculate plan | `inventory_planner` | `planned` or `exception_required` |
| Review plan | `inventory_replenishment_reviewer` | `reviewed` |
| Revise request | `inventory_planner` | `draft` |
| Approve plan | `inventory_replenishment_authority` | `approved` |
| Release order | `inventory_order_registrar` | `released` |
| Approve exception | `inventory_expiry_authority` | `exception_approved` |

Every mutation requires `x-actor-id`, `x-actor-role`, and a unique `x-request-id`. Lifecycle actions require a nonempty `note`. A request revision must contain a complete replacement payload.

## Error Response Handling

| HTTP status | Error code | Operator response |
| --- | --- | --- |
| 403 | `forbidden` | Confirm the actor role required for the current stage. |
| 404 | `not_found` | Confirm the replenishment identifier and action spelling. |
| 409 | `invalid_state` | Retrieve the record, use a fresh request identifier, and follow the permitted action. |
| 422 | `invalid_input` | Correct batch, supplier, demand, lead-time, or shelf-life data. |

When a calculation returns `exception_required`, inspect `expiryRiskUnits`, `unfilledOrderUnits`, and `exceptionReasons`. Either obtain an expiry authority decision or revise the request with safer on-hand inventory or eligible supplier capacity.

## Verification and Shutdown

Retrieve the final request via `GET /replenishment-requests/:id`. A normal route must reach `released`, while an exception route reaches `exception_approved`. A new request identifier against either terminal action must return HTTP 409 with `invalid_state`.

Send `SIGTERM` or `SIGINT` to close the listener before process exit.
