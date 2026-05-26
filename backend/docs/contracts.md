# Backend Contracts - Normalized Schema

## Source Of Truth

The backend uses the normalized schema from `backend/sql/012_normalized_supabase_schema.sql`:

- Identity and profiles: `users`, `addresses`, `parents`, `teachers`, `children`
- Teacher metadata: `teacher_skills`, `teacher_academic_records`, `teacher_experiences`, `teacher_availability`
- Lessons: `bookings`, `booking_follow_ups`
- Payments: `payment_orders`, `payment_charges`, `payment_refunds`, `payment_webhook_events`
- Reviews: `booking_reviews`
- Chat: `chat_threads`, `chat_messages`
- Notifications: `notification_devices`, `notification_preferences`, `notifications`, `notification_deliveries`

Legacy columns and tables may still exist because earlier migrations created them, but backend reads and authorization use
normalized IDs and timestamps. Compatibility writes are limited to columns that are still required by old constraints.

## Public API Shape

- Use `user_id` for Supabase auth users.
- Use internal `parent_id`, `teacher_id`, and `child_id` for domain resources.
- Use `starts_at` as ISO 8601 datetime with timezone for bookings and slots.
- Use integer money fields in cents: `amount_cents`, `hourly_rate_cents`, `price_per_class_cents`.
- Payment state is exposed through `payment_orders` and `payment_charges`, not booking payment columns.

## Endpoints

Profiles:

- `GET /api/v1/profiles/me`
- `GET /api/v1/profiles/parent`
- `GET /api/v1/profiles/teacher`
- `PATCH /api/v1/profiles/parent`
- `PATCH /api/v1/profiles/teacher`
- `POST /api/v1/profiles/teacher/photo`

Marketplace:

- `GET /api/v1/marketplace/teachers`
- `GET /api/v1/marketplace/teachers/{teacher_id}`
- `GET /api/v1/marketplace/teachers/{teacher_id}/reviews`

Bookings:

- `POST /api/v1/bookings`
- `GET /api/v1/bookings/parent/agenda`
- `GET /api/v1/bookings/teacher/agenda`
- `GET /api/v1/bookings/{booking_id}`
- `PATCH /api/v1/bookings/{booking_id}/reschedule`
- `PATCH /api/v1/bookings/{booking_id}/teacher/decision`
- `PATCH /api/v1/bookings/{booking_id}/teacher/reschedule`
- `PATCH /api/v1/bookings/{booking_id}/cancel`
- `PATCH /api/v1/bookings/{booking_id}/complete`
- `GET /api/v1/teachers/{teacher_id}/availability/slots`

Reviews:

- `POST /api/v1/bookings/{booking_id}/review`
- `GET /api/v1/bookings/{booking_id}/review`
- `GET /api/v1/admin/reviews`
- `PATCH /api/v1/admin/reviews/{review_id}`

Chat and teacher control:

- `GET /api/v1/chat/threads`
- `POST /api/v1/chat/threads/from-booking/{booking_id}`
- `GET /api/v1/chat/threads/{thread_id}`
- `GET /api/v1/chat/threads/{thread_id}/messages`
- `POST /api/v1/chat/threads/{thread_id}/messages`
- `GET /api/v1/teacher/control-center/overview`
- `GET /api/v1/teacher/students/{child_id}/timeline`

Admin:

- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/access`
- `PATCH /api/v1/admin/teachers/{teacher_id}/activation`

## Review Rules

- A booking has zero or one review.
- Only the authenticated parent owner can create a review.
- A review can only be created when `bookings.status = 'concluida'`.
- Public marketplace review lists include only `is_public = true` and `status = 'published'`.
- Admin moderation can update `status` and `is_public`.

## Booking Rules

- Parent identity is derived from the authenticated user; clients do not submit `parent_id`.
- `child_id` must belong to the authenticated parent.
- `teacher_id` must exist and support the requested modality.
- New and rescheduled lessons must respect the minimum lead time.
- Scheduling conflicts are checked by `teacher_id + starts_at` for active bookings.
- Booking creation also creates/updates a `payment_order` and `payment_charge` with provider `legacy` until Pagar.me is integrated.
