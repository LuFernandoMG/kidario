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
normalized IDs and timestamps. The v1 router is no longer mounted; `013_api_v2_cutover.sql` relaxes the remaining old
constraints needed to stop v2 services from writing compatibility columns.

## Public API Shape

- Use `user_id` for Supabase auth users.
- Use internal `parent_id`, `teacher_id`, and `child_id` for domain resources.
- Use `starts_at` as ISO 8601 datetime with timezone for bookings and slots.
- Use integer money fields in cents: `amount_cents`, `hourly_rate_cents`, `price_per_class_cents`.
- Payment state is exposed through `payment_orders` and `payment_charges`, not booking payment columns.
- Public discovery payloads must not expose full addresses, CPF, or parent/teacher private contact data.
- Self-service parent/teacher payloads may include full `address` and must expose CPF only as `cpf_masked`.

## Endpoints

V2 normalized endpoints:

- `GET /api/v2/me`
- `PATCH /api/v2/me`
- `GET /api/v2/parents/me`
- `PATCH /api/v2/parents/me`
- `GET /api/v2/parents/me/children`
- `POST /api/v2/parents/me/children`
- `PATCH /api/v2/parents/me/children/{child_id}`
- `DELETE /api/v2/parents/me/children/{child_id}`
- `GET /api/v2/teachers/me`
- `PATCH /api/v2/teachers/me`
- `GET /api/v2/teachers/me/package-plans`
- `POST /api/v2/teachers/me/package-plans`
- `PATCH /api/v2/teachers/me/package-plans/{package_plan_id}`
- `GET /api/v2/explore/teachers`
- `GET /api/v2/explore/teachers/{teacher_id}`
- `POST /api/v2/bookings`
- `GET /api/v2/bookings/{booking_id}`
- `GET /api/v2/parents/me/bookings`
- `GET /api/v2/teachers/me/bookings`
- `PATCH /api/v2/bookings/{booking_id}/reschedule`
- `PATCH /api/v2/bookings/{booking_id}/teacher/reschedule`
- `POST /api/v2/bookings/{booking_id}/decision`
- `POST /api/v2/bookings/{booking_id}/cancel`
- `POST /api/v2/bookings/{booking_id}/complete`
- `POST /api/v2/bookings/{booking_id}/review`
- `GET /api/v2/bookings/{booking_id}/review`
- `POST /api/v2/packages/purchases`
- `GET /api/v2/parents/me/packages`
- `GET /api/v2/teachers/me/packages`
- `GET /api/v2/bookings/{booking_id}/payment`
- `GET /api/v2/parents/me/payments`
- `GET /api/v2/teachers/me/payments`
- `GET /api/v2/reviews?teacher_id={teacher_id}`
- `GET /api/v2/admin/reviews`
- `PATCH /api/v2/admin/reviews/{review_id}`
- `GET /api/v2/notifications/devices`
- `POST /api/v2/notifications/devices`
- `DELETE /api/v2/notifications/devices/{device_id}`
- `GET /api/v2/notifications/preferences`
- `PUT /api/v2/notifications/preferences`
- `GET /api/v2/notifications`
- `POST /api/v2/notifications/{notification_id}/read`
- `POST /api/v2/admin/notifications`

V2 profile rules:

- `users.role` supports `parent`, `teacher`, and `admin`.
- Public signup remains limited to `parent` and `teacher`; admins are created through internal controlled flows.
- `ParentProfile` and `TeacherProfile` include a full nested `address` for self-service geographic recommendations.
- `cpf` is accepted only in write payloads and never returned raw.
- Teacher fields follow the database: use `biography`, `modality`, `teacher_skills.skill`, and no synthetic `headline` or `skill.level`.
- `ExploreTeacher` payloads use `TeacherSearchResult` and `TeacherPublicProfile`, not UI names like cards/details.
- `GET /api/v2/explore/teachers` accepts discovery filters for skill, city/state, modality, availability window, rating, price and proximity.
- Explore list/detail responses include `rating_summary`, `availability_summary`, `package_summary`, recent reviews and package data needed for initial rendering.
- Teacher package plans are owned by the authenticated teacher and exposed through `/teachers/me/package-plans`.
- Package purchases derive `parent_id` from the authenticated user, validate child ownership through `children.parent_id`, and create both `booking_packages` and normalized payment rows.
- Booking v2 responses return a normalized `Booking` object with nested `child`, `teacher`, `parent`, `payment_order`, `latest_follow_up` and `actions`.
- Payment v2 responses read from `payment_orders` and include nested `payment_charges`.
- Notification v2 responses read/write `notification_devices`, `notification_preferences`, and `notifications`; delivery attempts stay in `notification_deliveries` for worker/provider integrations.

## Review Rules

- A booking has zero or one review.
- Only the authenticated parent owner can create a review.
- A review can only be created when `bookings.status = 'concluida'`.
- Public review lists include only `is_public = true` and `status = 'published'`.
- Public review lists are consolidated at `GET /api/v2/reviews?teacher_id={teacher_id}` instead of being tied to explore-specific routes.
- Admin moderation can update `status` and `is_public`.

## Package Rules

- A teacher can create and update only their own `package_plans`.
- Package plan `code` remains unique per teacher.
- A parent can purchase only for one of their own children.
- Package purchase totals are stored in cents on `booking_packages` and mirrored into `payment_orders`/`payment_charges`.
- Package purchase responses expose derived `booked_sessions`, `completed_sessions`, and `remaining_sessions` counters.
- Package purchases may include `first_booking`; the requested first lesson is persisted on `booking_packages` and becomes a normal package-backed booking when the package is active.
- Bookings created with `package_id` require an active package matching parent, teacher and child, and consume remaining sessions before creating extra paid bookings.
- `payment_method` is required for one-off bookings and optional when `package_id` is provided.
- Package payment provider remains `internal` until Pagar.me order/charge creation is implemented.

## Notification Rules

- A device belongs to one `users.id` and is registered through `(device_type, provider, push_token)`.
- Re-registering an existing push token reactivates it for the authenticated user.
- Preferences are keyed by `(user_id, channel, notification_type)`.
- A user can read and mark only their own notifications.
- Admin-created notifications write queued rows; sending and delivery attempts belong to async/mobile provider workers.

## Booking Rules

- Parent identity is derived from the authenticated user; clients do not submit `parent_id`.
- `child_id` must belong to the authenticated parent.
- `teacher_id` must exist and support the requested modality.
- New and rescheduled lessons must respect the minimum lead time.
- Scheduling conflicts are checked by `teacher_id + starts_at` for active bookings.
- Booking creation also creates/updates a `payment_order` and `payment_charge` with provider `internal` until Pagar.me is integrated.
