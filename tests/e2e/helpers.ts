import type { Page } from "@playwright/test";

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
  await page.getByRole("button", { name: /sign up|register/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-up"), {
    timeout: 10_000,
  });
}
