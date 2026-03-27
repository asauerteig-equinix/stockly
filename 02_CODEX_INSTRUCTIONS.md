# Codex Instructions

You are working on an internal inventory management MVP called **Stockly**.

Your task is to design and implement the project in a way that is:
- modern
- lean
- maintainable
- production-oriented
- easy to run in containerized environments

Follow the instructions below strictly.

---

## 1. General Development Rules
- Use **TypeScript**.
- Prefer clear, maintainable code over clever code.
- Keep the MVP focused.
- Do not overengineer.
- Design for later multi-location support from the beginning.
- All user-facing UI text should be in **German**.
- Keep naming in code, APIs, database, and docs in **English**.

---

## 2. Architecture Expectations
Choose a pragmatic modern stack and explain the choice.
Preferred default stack:
- Frontend: **Next.js** with TypeScript
- Styling: **Tailwind CSS**
- UI components: **shadcn/ui** or equivalent clean component approach
- Backend/API: Next.js route handlers or a clean Node.js TypeScript backend
- ORM: **Prisma**
- Database: **PostgreSQL**
- Validation: **Zod**
- Auth for admins: secure session or JWT-based approach suitable for internal apps
- Barcode scanning: established browser barcode scanner library

You may adapt details if there is a strong reason, but stay close to this stack unless there is a clear implementation advantage.

---

## 3. Core Functional Scope
Implement the MVP with these features:

### Admin area
- login
- dashboard
- article list
- create article
- edit article
- stock overview
- goods receipt booking
- manual correction booking
- movement history
- warnings overview
- location management
- admin management for master admin

### Kiosk area
- kiosk pairing to a location by PIN
- persistent kiosk binding
- barcode scanning via camera
- manual barcode entry fallback
- article display after scan
- quantity selection
- withdraw booking
- return booking
- usage reason selection for withdrawals

---

## 4. Mandatory Business Rules
- One article belongs to one location.
- Barcode uniqueness must be enforced within a location.
- Each location has independent stock and warning settings.
- Kiosk transactions must only affect the kiosk-bound location.
- Withdrawals and returns must create stock movement records.
- Goods receipts and corrections must be possible only through the admin UI.
- Hard delete should be avoided where archiving is safer.
- Stock consistency is critical.

---

## 5. Roles and Permissions
Implement at least:

### Master Admin
- full access to all locations
- can manage admins
- can manage all settings

### Admin
- can only manage assigned locations
- can manage articles, stock, bookings, warnings, and reports in those locations

### Kiosk
- no personal user login required
- kiosk acts through persistent device/location binding

Enforce authorization both in UI and API.

---

## 6. Kiosk Binding Rules
Implement a robust pairing flow:
- select location
- enter PIN
- validate PIN
- create persistent kiosk binding token/session
- store kiosk binding so it survives restarts as long as possible
- allow reset only via protected flow

Important:
A kiosk at location A must never accidentally post for location B.

---

## 7. Article Model
Required fields:
- name
- barcode
- description
- manufacturerNumber
- supplierNumber
- category
- minimumStock
- active/archive status
- locationId

Use sensible timestamps and audit-friendly fields.

---

## 8. Stock Movement Model
Support movement types:
- WITHDRAWAL
- RETURN
- GOODS_RECEIPT
- CORRECTION

Each movement record should include at least:
- id
- locationId
- articleId
- type
- quantity
- sourceType (KIOSK / ADMIN)
- usageReason (nullable)
- note (nullable)
- createdAt
- createdByUserId (nullable for kiosk)

Apply stock changes safely and atomically.

---

## 9. Usage Reasons
Initial withdrawal usage reasons:
- crossconnect
- smarthand
- custom order
- project

Requirements:
- manageable enough in code structure for later expansion
- for kiosk display sort the options by most frequently used first

---

## 10. Warnings
Implement at least:

### Low stock
- when stock <= minimumStock

### Aging
- when last withdrawal date is older than configured threshold

Prefer calculating warnings from current data unless there is a strong reason to persist them.

---

## 11. Reporting
Build a useful MVP dashboard and reporting views showing:
- current stock
- low stock list
- aging list
- consumption over time
- top withdrawn articles
- last movements
- articles without movement
- usage reason distribution

Use readable charts and tables.
Do not overcomplicate visualizations.

---

## 12. UX Guidelines
### Admin UI
- efficient
- clean
- modern
- table and form oriented
- desktop-first but responsive

### Kiosk UI
- large buttons
- touch friendly
- minimal flow
- clear feedback states
- optimized for repeated warehouse operations

---

## 13. Database and Migrations
Use Prisma schema and migrations.
Provide:
- initial schema
- seed data
- development-friendly setup
- constraints and indexes where appropriate

Important schema considerations:
- future-ready for multiple locations
- independent settings per location
- proper relational integrity

---

## 14. API Design Expectations
Provide clean API endpoints for:
- auth
- locations
- admins/users
- articles
- stock movements
- dashboard/reporting
- kiosk pairing
- kiosk bookings
- warnings

Use validation for every mutating endpoint.
Return clear error messages.

---

## 15. Containerization and Deployment
Project must be easy to run in Docker during development and easy to adapt to Podman/Portainer later.

Provide:
- Dockerfiles or Containerfiles
- docker-compose setup for local development
- environment examples
- health checks if practical
- clear startup instructions

Assume later deployment as a Portainer stack.

---

## 16. Documentation Deliverables
Create documentation for:
- architecture overview
- setup instructions
- environment variables
- migration flow
- seeding
- how kiosk pairing works
- how roles and permissions work
- future extension ideas

---

## 17. Implementation Style
When implementing:
- start with architecture and schema
- then project structure
- then auth and permissions
- then article management
- then stock movement logic
- then kiosk flow
- then warnings/reporting
- then polish UI and docs

When making assumptions:
- choose pragmatic defaults
- document them clearly
- avoid blocking the implementation with unnecessary questions

---

## 18. What Not To Do
- do not build a full ERP
- do not add unused abstractions
- do not implement advanced supplier workflows yet
- do not introduce needless microservices
- do not mix German and English inconsistently in code structure
- do not sacrifice correctness for visual polish

---

## 19. Expected Output Quality
The result should feel like a real internal business application MVP that could be continued by another developer without confusion.

Favor:
- clarity
- correctness
- maintainability
- operational usefulness
over:
- novelty
- flashy but fragile patterns
