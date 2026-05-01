import { expect, type Page } from "@playwright/test";

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  // Wait for redirect away from sign-in page
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"), {
    timeout: 10_000,
  });
}

export async function signUp(
  page: Page,
  name: string,
  email: string,
  password: string
) {
  await page.goto("/sign-up");
  await page.getByLabel(/name/i).fill(name);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-up"), {
    timeout: 10_000,
  });
}

export async function signOut(page: Page) {
  const signOutButton = page.getByRole("button", { name: /sign out/i });
  if (await signOutButton.isVisible().catch(() => false)) {
    await signOutButton.click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 10_000 });
    return;
  }

  await page.context().clearCookies();
  await page.goto("/");
}

export async function openPageAndExpectHeading(
  page: Page,
  path: string,
  heading: string
) {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({
    timeout: 10_000,
  });
}

export async function createDraft(
  page: Page,
  title: string,
  description: string
) {
  await openPageAndExpectHeading(
    page,
    "/user/requests/new",
    "New Reimbursement Request"
  );
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill(description);
  await page.getByRole("button", { name: /create draft/i }).click();
  await expect(page.getByText("Draft created successfully.")).toBeVisible({
    timeout: 10_000,
  });
  await page
    .getByRole("link", { name: /open request to upload receipts/i })
    .click();
  await page.waitForURL(/\/user\/requests\/[^/]+$/, { timeout: 10_000 });
  await expect(page.getByPlaceholder("Request title")).toHaveValue(title, {
    timeout: 10_000,
  });
}

export async function selectShadcn(
  page: Page,
  triggerName: string | RegExp,
  optionLabel: string | RegExp
) {
  await page.getByRole("combobox", { name: triggerName }).click();
  await page.getByRole("option", { name: optionLabel }).click();
}
