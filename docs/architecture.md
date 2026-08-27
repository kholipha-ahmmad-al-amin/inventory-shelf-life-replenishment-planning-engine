# Architecture

## Scope

The Inventory Shelf-Life Replenishment Planning Engine produces a demand-covering order plan while protecting against batch expiry and inadequate delivered shelf life. It calculates the order position from current batches and demand assumptions, accepts only suppliers that meet the time and shelf-life horizon, and routes risky outcomes through a controlled exception path.

## Components

| Component | Responsibility |
| --- | --- |
| `src/app.mjs` | Routes, body limit, request identifiers, and structured error responses |
| `src/domain.mjs` | Lifecycle stages, role controls, revisions, idempotency, and audit events |
| `src/validation.mjs` | Batch, supplier, planning-input, numeric, and actor validation |
| `src/policy.mjs` | Batch classification, target stock, supplier qualification, sourcing, and exceptions |
| `src/store.mjs` | Missing-file recovery plus temporary-file write and atomic rename |
| `src/server.mjs` | Port validation, LAN listener, service construction, and controlled shutdown |

## Replenishment Policy

The policy first calculates `useBeforeDays` as planning lead days plus review period days. Batches with expiry after planning lead days are usable at arrival. A usable batch that expires at or before the use-before horizon remains usable but is reported as expiry risk. The target stock covers lead time, review period, and safety days.

| Plan output | Meaning |
| --- | --- |
| `usableUnits` | Units surviving through the planned arrival date |
| `expiryRiskUnits` | Usable units that expire inside the review horizon |
| `projectedUnitsAtArrival` | Usable units less demand expected during lead time |
| `recommendedOrderUnits` | Target stock less projected units, not below zero |
| `orderLines` | Selected suppliers, order units, and line costs |
| `unfilledOrderUnits` | Recommended volume not covered by qualified sources |
| `exceptionReasons` | Expiry exposure and or insufficient shelf-life-qualified supply |

Supplier options fail eligibility when their lead time exceeds the planning lead days or delivered shelf life is not beyond the use-before horizon. Eligible suppliers sort by unit cost, lead time, greater delivered shelf life, and supplier identifier.

## Lifecycle Policy

| Current state | Action | Required role | Next state |
| --- | --- | --- | --- |
| New request | `create` | `inventory_planner` | `draft` |
| `draft` | `calculatePlan` | `inventory_planner` | `planned` or `exception_required` |
| `planned` | `reviewPlan` | `inventory_replenishment_reviewer` | `reviewed` |
| `reviewed` or `exception_required` | `reviseRequest` | `inventory_planner` | `draft` |
| `reviewed` | `approvePlan` | `inventory_replenishment_authority` | `approved` |
| `approved` | `releaseOrder` | `inventory_order_registrar` | `released` |
| `exception_required` | `approveException` | `inventory_expiry_authority` | `exception_approved` |

`released` and `exception_approved` are terminal. A revision clears the prior plan before the next calculation.

## Persistence and Transport

The live state file is `data/replenishment-requests.json`. A missing file returns an empty collection. Each accepted mutation writes complete JSON to a temporary sibling file and atomically renames it into place. Request identifiers are checked across all events before an operation proceeds.

`POST /replenishment-requests` creates a draft, `GET /replenishment-requests/:id` retrieves it, and `POST /replenishment-requests/:id/:action` applies a role-allowed action. The service returns HTTP 422 `invalid_input`, HTTP 403 `forbidden`, HTTP 404 `not_found`, and HTTP 409 `invalid_state`.
