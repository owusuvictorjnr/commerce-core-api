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
