# Project Brief

## Project Name
Working title: **Stockly**

## Goal
Build a modern, lean, responsive inventory management web application for internal company use in the local network.

The system must support two main usage modes:
1. **Admin/Desktop mode** for management and administration
2. **Kiosk/Warehouse mode** for fast barcode-based stock movements using the onboard camera

This should start as an MVP, but the architecture must be prepared for later expansion to multiple independent locations/warehouses.

---

## Business Context
The application is intended for internal warehouse and stock handling.

Current state:
- only **one warehouse / one location** is used initially
- but the system must later support **multiple independent locations**
- each location must behave independently regarding:
  - articles
  - stock
  - low stock rules
  - aging rules
  - kiosk bindings

The application runs:
- only inside the **local company network**
- not public internet-facing

Deployment target:
- later deployed as a **stack via GitHub + Portainer + Podman**
- currently developed in **Portainer with Docker-based environments**
- architecture must therefore be container-friendly from day one

Database:
- use **PostgreSQL**
- do not use SQLite for the main implementation

---

## Main User Types

### Master Admin
Can do everything.
Responsibilities:
- manage all locations
- manage admins
- see all data
- configure global settings

### Admin
Can manage one or more assigned locations.
Responsibilities:
- manage articles
- manage stock
- book goods receipts
- perform corrections
- see warnings
- use reports for assigned locations

### Kiosk
No personal user login required for warehouse bookings.
The kiosk is device-bound to one location and can:
- scan barcode
- withdraw stock
- return stock
- book against the assigned location only

---

## Kiosk Requirements
The kiosk mode is extremely important.

### Kiosk pairing
When a kiosk is started the first time or reset:
- user selects a location
- enters the matching PIN
- kiosk is bound to that location
- binding should persist as long as possible, ideally permanently, until manually reset
- this must prevent a kiosk from location A from posting transactions into location B

### Kiosk usage
Warehouse users must be able to:
- scan barcode using onboard camera
- fallback to manual barcode entry
- see the matched article
- choose quantity
- choose action:
  - withdraw
  - return / rebook
- confirm booking quickly

### Withdrawal reason selection
For withdrawals, users must assign a usage reason.
Initial reason set:
- crossconnect
- smarthand
- custom order
- project

These reasons should be sorted dynamically by most frequently used first.

### UX expectations for kiosk
- very few clicks
- large touch-friendly buttons
- high contrast
- clear success and error feedback
- fast workflow for warehouse usage

---

## Article Requirements
Articles must be simple and fast to manage.

Required fields:
- short readable name
- barcode
- description
- manufacturer number
- supplier number / supplier designation
- category

Not needed:
- no variants
- no size/color/execution logic
- no rental/loan flow

Counting logic:
- quantities are always tracked **per article unit as defined internally**
- even if a package physically contains multiple pieces, it may still count as 1 if that is the business definition

Other article rules:
- barcode should be unique within a location
- article archive preferred over hard delete
- fast search and filtering
- clean form validation

---

## Stock Movement Requirements
Supported stock movement types in MVP:
- withdrawal via kiosk
- return / rebooking via kiosk
- goods receipt via admin UI
- manual correction via admin UI

Each movement must log:
- location
- article
- movement type
- quantity
- timestamp
- source (kiosk or admin)
- optional note
- for kiosk withdrawals: usage reason

Stock must update correctly after every movement.

---

## Warnings

### Low stock warning
Trigger when stock is less than or equal to configured minimum stock.

### Aging warning
Trigger when an article has not been withdrawn for a configurable number of days.

Rules must be manageable per location.

Warnings must appear:
- on dashboard
- in a dedicated warnings view

Architecture should allow future notification extensions like mail alerts.

---

## Reports / Analytics
The system must provide useful operational reporting.

Minimum reporting scope:
- current stock overview
- low stock warnings
- aging warnings
- consumption by period
- most withdrawn articles
- recently moved articles
- articles without movement
- usage reason analysis
- filters by date range, location, category

Use readable charts and tables.
Avoid overengineering into a full BI platform.

---

## UI / Design
The application should feel modern and professional.

Requirements:
- modern business-style UI
- clean typography
- responsive layout
- pleasant admin experience on desktop
- clearly separated kiosk mode
- German language UI
- not overloaded
- focus on usability and speed

---

## Technical Direction
Preferred implementation direction:
- **TypeScript** across the stack
- **Next.js** or React-based frontend
- **Node.js** backend
- **PostgreSQL** database
- **Prisma** ORM preferred
- browser-based barcode scanning library
- containerized services
- environment-variable driven configuration
- health checks
- stack/deployment friendly structure

---

## Non-Goals for MVP
Do not build a full ERP.
Do not add unnecessary complexity.
Do not implement procurement or supplier ordering workflows yet.
Do not implement public internet exposure.
Do not build advanced multi-tenant SaaS billing/account concepts.

---

## Priority Order
1. Lean and modern application
2. Strong responsive admin UI
3. Fast and robust kiosk workflow
4. Correct stock movement model
5. Location-aware architecture
6. PostgreSQL + container readiness
7. Good maintainability and extensibility
