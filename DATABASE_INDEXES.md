# Database Index Analysis

## Current State
The schema has some indexes but is missing critical ones for common query patterns.

## Recommended Indexes to Add

### Chat Messages
- `status` - used in WHERE clauses for filtering
- `linkPending` - used in WHERE clauses
- `updatedAt` - used for finding recently modified messages
- Composite: `[createdAt, id]` - used in ORDER BY

### Course Requests
- `status` - used for filtering
- `category` - used for filtering
- `createdAt` - used for sorting
- `votes` - used for sorting by popularity

### Comments
- `courseId` - used for fetching comments by course
- `createdAt` - used for sorting
- `userId` - used for fetching user's comments

### Reviews
- `courseId` - used for fetching reviews by course
- `createdAt` - used for sorting
- `rating` - used for filtering

### Users
- `emailVerified` - used for filtering verified users
- `role` - used for admin queries
- `disabled` - used for filtering active users

## Implementation
Add these indexes to prisma/schema.prisma @@index directives.
