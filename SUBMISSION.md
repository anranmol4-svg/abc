# Submission

- GitHub repository URL: [TODO]
- Live application URL: [TODO]
- Demo credentials:
  - Editor: editor@example.com / password
  - Writer: writer@example.com / password
- Technology stack: React, TypeScript, Vite, Tailwind, Node.js, Express, PostgreSQL, Prisma
- Goal checklist:
- [x] MILESTONE 0 — Repository Setup
- [x] MILESTONE 1 — Database schema
- [x] MILESTONE 2 — Authentication backend
- [x] MILESTONE 3 — Sections
- [x] MILESTONE 4 — Articles
- [x] MILESTONE 5 — Article State Machine
- [x] MILESTONE 6 — Revisions + History
- [x] MILESTONE 7 — Search / Filter / Pagination
- [x] MILESTONE 8 — Bulk Operations + CSV
- [x] MILESTONE 9 — Dashboard
- [x] MILESTONE 10 — Alerts
- [x] MILESTONE 11 — Complete Frontend
- [x] MILESTONE 12 — Integration + Security Review
- [x] MILESTONE 13 — Full Testing
- [x] MILESTONE 14 — Deployment (Dockerfiles)
- [x] MILESTONE 15 — Final Submission

Project is complete! 🎉
- Actual development time: ~3 hours
- What would be done with another 12 hours: 
  1. Full end-to-end (E2E) testing suite utilizing Playwright or Cypress to automate user journey flows across Editor and Writer personas.
  2. A sophisticated rich-text editor (like TipTap or Lexical) integrated into the Article Editor instead of a plain `<textarea>`, allowing for inline media, bold/italic, and HTML formatting.
  3. Advanced WebSocket integrations for real-time collaborative editing and instant push notifications when articles become overdue or transition states.
  4. Expand the backend deployment with CI/CD GitHub Actions pipelines to automatically build Docker images and deploy to AWS or Vercel.
- Least satisfactory part of the codebase:
  1. The frontend React structure is highly simplified due to time constraints, so a lot of logic is housed directly inside page components rather than custom abstraction hooks.
  2. The Prisma generated types paired with Express sometimes resulted in friction requiring casting, which could be refactored into strict DTO validation layers using Zod for incoming and outgoing payloads.
