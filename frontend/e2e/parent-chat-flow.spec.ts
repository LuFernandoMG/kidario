import { expect, test } from "@playwright/test";

test("parent can open class chat from booking detail", async ({ page }) => {
  const bookingId = "7e8e4f55-9f50-4b6c-9f35-9f84e1f6b0d4";
  const threadId = "ecf3d5a2-1da2-478a-8251-4e3fc0b11dd9";
  const parentProfileId = "2d72596d-c818-430f-b455-2fa2a3434b3b";
  const teacherProfileId = "f2946ab8-92bb-48b1-a7f4-f34e29dcce4f";
  const childId = "252cc8eb-eed9-4453-9666-16ad4365cc62";

  const messages: Array<{
    id: string;
    thread_id: string;
    sender_profile_id: string;
    body: string;
    created_at: string;
  }> = [];

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
    { parentId: parentProfileId },
  );

  await page.route("**/api/v1/bookings/parent/agenda?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        lessons: [
          {
            id: bookingId,
            teacher_id: teacherProfileId,
            teacher_name: "Ana Carolina Silva",
            teacher_avatar_url: null,
            specialty: "Alfabetizacao",
            child_id: childId,
            child_name: "Luca",
            date_iso: "2026-02-20",
            date_label: "20/02/2026",
            time: "14:00",
            modality: "online",
            status: "confirmada",
            created_at_iso: "2026-02-01T10:00:00Z",
            updated_at_iso: "2026-02-01T10:00:00Z",
          },
        ],
      }),
    });
  });

  await page.route(`**/api/v1/bookings/${bookingId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: bookingId,
        parent_profile_id: parentProfileId,
        child_id: childId,
        child_name: "Luca",
        teacher_id: teacherProfileId,
        teacher_name: "Ana Carolina Silva",
        teacher_avatar_url: null,
        specialty: "Alfabetizacao",
        date_iso: "2026-02-20",
        date_label: "20/02/2026",
        time: "14:00",
        duration_minutes: 60,
        modality: "online",
        status: "confirmada",
        price_total: 120,
        currency: "BRL",
        cancellation_reason: null,
        latest_follow_up: null,
        actions: {
          can_reschedule: true,
          can_cancel: true,
          can_complete: false,
        },
      }),
    });
  });

  await page.route(`**/api/v1/chat/threads/from-booking/${bookingId}`, async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        thread: {
          id: threadId,
          booking_id: bookingId,
          parent_profile_id: parentProfileId,
          teacher_profile_id: teacherProfileId,
          child_id: childId,
          booking_status: "confirmada",
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

  await page.route(`**/api/v1/chat/threads/${threadId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        thread: {
          id: threadId,
          booking_id: bookingId,
          parent_profile_id: parentProfileId,
          teacher_profile_id: teacherProfileId,
          child_id: childId,
          booking_status: "confirmada",
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

  await page.route(`**/api/v1/chat/threads/${threadId}/messages?*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ messages }),
    });
  });

  await page.route(`**/api/v1/chat/threads/${threadId}/messages`, async (route) => {
    const payload = await route.request().postDataJSON();
    const body = typeof payload.body === "string" ? payload.body : "";
    const message = {
      id: `msg-${messages.length + 1}`,
      thread_id: threadId,
      sender_profile_id: parentProfileId,
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
