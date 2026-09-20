import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("login page renders with no accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Accesso venditore" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("language switcher toggles the page language", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Accesso venditore" })).toBeVisible();

  await page.getByRole("button", { name: "EN" }).click();
  await expect(page.getByRole("heading", { name: "Seller sign in" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("register page renders with no accessibility violations", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Registrazione venditore" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
