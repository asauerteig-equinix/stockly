# Implementation Tasklist

Use this as the working checklist for the project.

## Phase 1 — Foundation
- [ ] Choose and document final stack
- [ ] Initialize project structure
- [ ] Set up TypeScript tooling
- [ ] Set up Tailwind and UI base
- [ ] Set up Prisma + PostgreSQL
- [ ] Create initial database schema
- [ ] Create migrations
- [ ] Add seed data
- [ ] Add env example files
- [ ] Add Docker setup

## Phase 2 — Auth and Roles
- [ ] Implement admin authentication
- [ ] Implement role model (MASTER_ADMIN / ADMIN)
- [ ] Implement assigned location access rules
- [ ] Protect admin routes and APIs

## Phase 3 — Location and Kiosk Binding
- [ ] Create location model
- [ ] Create location settings model
- [ ] Implement location management UI
- [ ] Implement kiosk PIN logic
- [ ] Implement kiosk pairing flow
- [ ] Implement persistent kiosk binding
- [ ] Implement kiosk reset flow

## Phase 4 — Article Management
- [ ] Article list view
- [ ] Article search and filtering
- [ ] Create article form
- [ ] Edit article form
- [ ] Archive article action
- [ ] Enforce barcode uniqueness per location

## Phase 5 — Stock Movements
- [ ] Implement stock ledger logic
- [ ] Implement goods receipt flow
- [ ] Implement correction flow
- [ ] Implement withdrawal flow
- [ ] Implement return flow
- [ ] Ensure atomic stock updates
- [ ] Create movement history view

## Phase 6 — Kiosk Workflow
- [ ] Create kiosk start screen
- [ ] Add barcode scanner integration
- [ ] Add manual barcode fallback
- [ ] Show article after scan
- [ ] Add quantity selector
- [ ] Add withdrawal / return actions
- [ ] Add usage reason selection
- [ ] Sort usage reasons by popularity
- [ ] Add success / error feedback

## Phase 7 — Warnings and Reporting
- [ ] Implement low stock calculation
- [ ] Implement aging calculation
- [ ] Create dashboard summary cards
- [ ] Create warnings view
- [ ] Create consumption charts
- [ ] Create top withdrawn articles view
- [ ] Create recent movement list
- [ ] Create articles without movement report
- [ ] Create usage reason analysis

## Phase 8 — Polish and Documentation
- [ ] Improve responsive admin layout
- [ ] Improve kiosk touch layout
- [ ] Add loading/error/empty states
- [ ] Write README
- [ ] Document env vars
- [ ] Document deployment notes for Portainer/Podman target
- [ ] Document architecture decisions
