# Commerce Core API

These prompts are designed to help GitHub Copilot generate code that follows the architecture of the Commerce Core SaaS backend.

The backend uses:

* Node.js
* Express
* TypeScript
* Prisma
* PostgreSQL
* Event-driven architecture
* Hook system
* Multi-tenant design

Always ensure code follows the project conventions.

---

# 1️⃣ Generate a New Module

Prompt to use in a new file:

Create a complete backend module for [MODULE_NAME] following the Commerce Core architecture.

Requirements:

* Use TypeScript
* Use Express router
* Include controller, service, routes, and validation
* Ensure tenant isolation using tenantId
* Use Prisma for database operations
* Emit events for important actions
* Allow hooks to run before and after core operations

Module structure should include:

* module.routes.ts
* module.controller.ts
* module.service.ts
* module.validation.ts
* module.types.ts

---

# 2️⃣ Generate a Service Layer

Prompt:

Generate a service layer for managing [ENTITY_NAME].

Requirements:

* Use Prisma ORM
* Include CRUD operations
* Require tenantId for all queries
* Emit appropriate domain events
* Allow lifecycle hooks before and after mutations
* Use async/await
* Return clean objects

---

# 3️⃣ Generate a REST Controller

Prompt:

Generate an Express controller for the [ENTITY_NAME] module.

Requirements:

* Controllers must be thin
* Call the service layer for all logic
* Use async/await
* Return consistent JSON responses
* Handle validation errors properly

Response format:

{
success: true,
data: {},
message: ""
}

---

# 4️⃣ Generate Event Listeners

Prompt:

Create event listeners for the following events:

* user.created
* order.created
* payment.success
* inventory.updated

Listeners should:

* subscribe using the eventBus
* log actions
* trigger follow-up operations such as email or inventory updates

---

# 5️⃣ Generate Hook Handlers

Prompt:

Create lifecycle hooks for the [ENTITY_NAME] module.

Hooks should include:

beforeCreate
afterCreate
beforeUpdate
afterUpdate

Hooks should validate input and enforce business rules.

---

# 6️⃣ Generate Prisma Model

Prompt:

Generate a Prisma model for [ENTITY_NAME] for a multi-tenant SaaS platform.

Requirements:

* Include tenantId
* Include createdAt and updatedAt
* Define relations where needed
* Follow Prisma best practices

---

# 7️⃣ Generate API Routes

Prompt:

Generate REST API routes for the [ENTITY_NAME] module.

Routes should include:

GET /entities
GET /entities/:id
POST /entities
PATCH /entities/:id
DELETE /entities/:id

Ensure tenant isolation and proper validation.

---

# 8️⃣ Generate Integration Wrapper

Prompt:

Create an integration wrapper for [SERVICE_NAME].

Requirements:

* Encapsulate external API calls
* Use environment variables for secrets
* Handle API errors gracefully
* Export reusable functions

Examples:

* Paystack
* Cloudinary
* Email provider

---

# 9️⃣ Generate Middleware

Prompt:

Create Express middleware for [FUNCTION].

Examples:

authentication
tenant resolution
rate limiting
request logging

Middleware should attach relevant data to the request object.

---

# 🔟 Generate Unit Tests

Prompt:

Generate Jest unit tests for the [MODULE_NAME] service layer.

Requirements:

* Mock Prisma
* Test core business logic
* Test error cases
* Ensure tenant isolation

---

# Development Rule Reminder

All generated code must follow these rules:

* Controllers must remain thin
* Services contain business logic
* Prisma handles database queries
* Events trigger side effects
* Hooks enforce lifecycle rules
* Tenant isolation must always be respected

Never place business logic inside controllers.



---

# 1️⃣1️⃣ Database Architecture Enforcement (CRITICAL)

All generated database models and queries must follow strict SaaS architecture rules.

## Multi-Tenant Rules (MANDATORY)

* Every model MUST include `tenantId`
* All Prisma queries MUST filter by `tenantId`
* Never allow cross-tenant data access

Copilot must reject any code missing tenant isolation.

---

## Core System Entities

The system must be designed using the following normalized modules:

* Tenant
* User
* Product
* Inventory
* Order
* OrderItem
* Payment
* Preorder

Do NOT merge unrelated entities.

---

## Order & Payment Structure (STRICT)

Orders must support partial payments.

Orders MUST include:

* totalAmount
* paidAmount
* remainingAmount
* status (PENDING, PARTIAL_PAID, FULLY_PAID, CANCELLED)

Payments MUST be a separate table.

Each payment MUST include:

* orderId
* amount
* paymentType (DEPOSIT, BALANCE)
* transactionReference
* status

Copilot must reject:

* boolean payment fields (e.g. isPaid)
* embedding payments inside orders

---

## Inventory Rules

Inventory MUST be separate from products.

Inventory MUST include:

* productId
* quantity
* reservedQuantity

Copilot must reject:

* storing stock directly in product table
* updating stock without reservation tracking

---

## Preorder System Rules

Preorders must:

* reserve stock
* link to orders
* enforce pickup deadline (7 days after arrival)

Required fields:

* preorderStatus
* pickupDeadline

Copilot must flag missing preorder lifecycle logic.

---

## Relationships (STRICT)

* User belongs to Tenant
* Product belongs to Tenant
* Order belongs to User and Tenant
* OrderItem belongs to Order and Product
* Payment belongs to Order
* Inventory belongs to Product

Copilot must enforce relational integrity.

---

## Auditing Fields

All models MUST include:

* createdAt
* updatedAt

Optional:

* deletedAt (soft delete)

---

## Forbidden Patterns

Copilot must reject:

* use of `any`
* storing relational data as JSON blobs
* skipping Prisma relations
* business logic inside schema definitions
* direct DB access from controllers




---

# 1️⃣2️⃣ Prisma Schema Design Intelligence

Copilot must generate database schemas that follow production-grade SaaS architecture.

## Schema Design Rules

* Use Prisma ORM with PostgreSQL
* Use UUIDs for all primary keys
* Normalize all relationships (no duplication)
* Avoid nullable fields unless necessary
* Use enums for status fields
* Always define relations explicitly using `@relation`

---

## Multi-Tenant Enforcement

* Every core model MUST include `tenantId`
* Always add index on `tenantId`
* Queries must filter by `tenantId`

---

## Financial Accuracy Rules

Orders must NEVER use:

* `isPaid: boolean`

Instead use:

* totalAmount
* paidAmount
* remainingAmount

Payments must be separate from orders.

---

## Inventory Design

* Inventory must be a separate model
* Must include:

  * quantity
  * reservedQuantity
* Must be linked to Product via relation

---

## Relationship Rules

Copilot must enforce:

* One-to-many: Tenant → Users, Products, Orders
* One-to-many: Order → OrderItems, Payments
* One-to-one: Product → Inventory
* One-to-one: Order → Preorder (optional)

---

## Indexing Strategy

Always recommend indexes for:

* tenantId
* foreign keys (orderId, productId, userId)

---

## Data Integrity Rules

Copilot must:

* prevent orphan records
* enforce foreign key relationships
* avoid cascading issues unless explicitly defined

---

## Forbidden Patterns

Copilot must reject:

* storing arrays/objects in JSON instead of relations
* mixing inventory inside product
* embedding payments inside orders
* missing enums for status fields
* using `any` type in schema-related logic
