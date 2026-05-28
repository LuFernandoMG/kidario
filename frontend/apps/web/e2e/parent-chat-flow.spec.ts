import { expect, test } from "@playwright/test";

test("parent can open class chat from booking detail", async ({ page }) => {
  const bookingId = "7e8e4f55-9f50-4b6c-9f35-9f84e1f6b0d4";
  const threadId = "ecf3d5a2-1da2-478a-8251-4e3fc0b11dd9";
  const parentId = "2d72596d-c818-430f-b455-2fa2a3434b3b";
  const teacherId = "f2946ab8-92bb-48b1-a7f4-f34e29dcce4f";
  const childId = "252cc8eb-eed9-4453-9666-16ad4365cc62";

  const messages: Array<{
    id: string;
    thread_id: string;
    sender_user_id: string;
    body: string;
    created_at: string;
  }> = [];

  const booking = {
    id: bookingId,
    parent_id: parentId,
    child_id: childId,
    teacher_id: teacherId,
    package_id: null,
    starts_at: "2026-02-20T14:00:00-03:00",
    duration_minutes: 60,
    modality: "online",
    status: "confirmada",
    cancellation_reason: null,
    confirmed_at: "2026-02-01T10:00:00Z",
    completed_at: null,
    canceled_at: null,
    created_at: "2026-02-01T10:00:00Z",
    updated_at: "2026-02-01T10:00:00Z",
    child: { id: childId, name: "Luca" },
    teacher: { id: teacherId, display_name: "Ana Carolina Silva", profile_photo_url: null },
    parent: { id: parentId, display_name: "Parent User" },
    payment_order: {
      id: "a15ef372-ae24-4ae0-bd2a-4e3d25d9e31d",
      parent_id: parentId,
      booking_id: bookingId,
      package_id: null,
      provider: "internal",
      provider_order_id: null,
      provider_order_code: null,
      amount_cents: 12000,
      currency: "BRL",
      status: "paid",
      charges: [],
      created_at: "2026-02-01T10:00:00Z",
      updated_at: "2026-02-01T10:00:00Z",
    },
    latest_follow_up: null,
    actions: {
      can_reschedule: true,
      can_cancel: true,
      can_complete: false,
      can_review: false,
    },
  };

  await page.addInitScript(
    ({ parentId }) => {
      window.localStorage.setItem(
        "kidario_auth_session_v1",
        JSON.stringify({
          role: "parent",
          email: "parent@example.com",
          fullName: "Parent User",
        }),
      );
      window.localStorage.setItem(
        "kidario_supabase_tokens_v1",
        JSON.stringify({
          accessToken:
            "header." + btoa(JSON.stringify({ sub: parentId })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "") + ".signature",
          refreshToken: "refresh-token",
          expiresIn: 3600,
          tokenType: "bearer",
        }),
      );
    },
    { parentId },
  );

  await page.route("**/api/v2/parents/me/bookings?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ bookings: [booking] }),
    });
  });

  await page.route(`**/api/v2/bookings/${bookingId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(booking),
    });
  });

  await page.route(`**/api/v2/chat/threads/from-booking/${bookingId}`, async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        thread: {
          id: threadId,
          booking_id: bookingId,
          parent_id: parentId,
          teacher_id: teacherId,
          child_id: childId,
          status: "active",
          booking_status: "confirmada",
          is_read_only: false,
          parent_name: "Parent User",
          teacher_name: "Ana Carolina Silva",
          child_name: "Luca",
          created_at: "2026-02-20T10:00:00Z",
          updated_at: "2026-02-20T10:00:00Z",
          last_message_at: null,
        },
      }),
    });
  });

  await page.route(`**/api/v2/chat/threads/${threadId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        thread: {
          id: threadId,
          booking_id: bookingId,
          parent_id: parentId,
          teacher_id: teacherId,
          child_id: childId,
          status: "active",
          booking_status: "confirmada",
          is_read_only: false,
          parent_name: "Parent User",
          teacher_name: "Ana Carolina Silva",
          child_name: "Luca",
          created_at: "2026-02-20T10:00:00Z",
          updated_at: "2026-02-20T10:00:00Z",
          last_message_at: null,
        },
      }),
    });
  });

  await page.route(`**/api/v2/chat/threads/${threadId}/messages?*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ messages }),
    });
  });

  await page.route(`**/api/v2/chat/threads/${threadId}/messages`, async (route) => {
    const payload = await route.request().postDataJSON();
    const body = typeof payload.body === "string" ? payload.body : "";
    const message = {
      id: `msg-${messages.length + 1}`,
      thread_id: threadId,
      sender_user_id: parentId,
      body,
      created_at: "2026-02-20T10:05:00Z",
    };
    messages.push(message);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok", message }),
    });
  });

  await page.goto("/agenda");
  await expect(page.getByText("Minha Agenda")).toBeVisible();
  await page.getByRole("link", { name: /Ana Carolina Silva/i }).first().click();

  await expect(page).toHaveURL(new RegExp(`/aula/${bookingId}`));
  await page.getByRole("button", { name: /Chat da aula/i }).click();

  await expect(page).toHaveURL(new RegExp(`/chat/${threadId}`));
  await page.getByPlaceholder("Escreva uma mensagem...").fill("Olá, professora!");
  await page.getByRole("button", { name: /Enviar mensagem/i }).click();
  await expect(page.getByText("Olá, professora!")).toBeVisible();
});
