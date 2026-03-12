# Copilot Code Review Rules

During pull request reviews, check for:

## Type Safety

* No usage of `any`
* Proper TypeScript typing
* Avoid unsafe casting

## Architecture

* Controllers must not contain business logic
* Services must handle database logic
* Routes must only register endpoints

## Security

* No hardcoded secrets
* Input validation required
* Authentication middleware required for protected routes

## Database

* Prisma queries must include tenantId
* Avoid unnecessary queries

## Code Quality

* No functions longer than 100 lines
* Avoid nested callbacks
* Use async/await properly

If violations are detected, comment on the pull request with suggested fixes.
