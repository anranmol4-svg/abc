# Database Schema

## Entities

- **User**: Represents writers and editors. Has `email`, `password`, `role`.
- **Section**: A section of the newsroom. Can have an `owner` (editor) and multiple writers via `SectionWriterAssignment`.
- **SectionWriterAssignment**: Many-to-many relationship between `Section` and `User` (writers).
- **Article**: Represents an article. Has `status` (DRAFT, IN_REVIEW, APPROVED, SCHEDULED, PUBLISHED), `title`, `body`.
- **ArticleRevision**: Used to store edits for published articles before they go through the review process.
- **ArticleStatusHistory**: Immutable history of status transitions.
- **ArticleComment**: Comments by editors and writers.
- **ArticleAlert**: Alerts for overdue scheduled articles.

## Relationships

- An Article belongs to one Section.
- An Article has one Author (User).
- A Section has one Owner (User).
- A Section can have multiple Writers.
