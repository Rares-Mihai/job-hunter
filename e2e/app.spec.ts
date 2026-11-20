import { execFileSync } from "node:child_process";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { E2E_ENV } from "../playwright.config";

/** Signs a browser in as a brand-new user (see create-user.mts). */
async function signIn(context: BrowserContext, name: string) {
  const output = execFileSync("node", ["e2e/create-user.mts", name], {
    env: { ...process.env, ...E2E_ENV },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  await context.addCookies(JSON.parse(output));
}

async function addApplication(
  page: Page,
  fields: { company: string; role: string; posting?: string; stage?: string },
) {
  await page.goto("/applications/new");
  await page.getByLabel("Company").fill(fields.company);
  await page.getByLabel("Role").fill(fields.role);
  if (fields.posting) await page.getByLabel("Job posting").fill(fields.posting);
  if (fields.stage) await page.getByLabel("Stage").selectOption(fields.stage);
  await page.getByRole("button", { name: "Add application" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: fields.company }),
  ).toBeVisible();
}

function column(page: Page, stage: string) {
  return page.locator(`section[aria-labelledby="column-${stage}"]`);
}

async function drag(page: Page, company: string, stage: string) {
  const card = await page
    .locator("article", { hasText: company })
    .first()
    .boundingBox();
  const target = await column(page, stage)
    .locator("> div")
    .last()
    .boundingBox();
  if (!card || !target) throw new Error("card or column not found");
  await page.mouse.move(card.x + 40, card.y + 20);
  await page.mouse.down();
  await page.mouse.move(card.x + 60, card.y + 30, { steps: 4 });
  await page.mouse.move(target.x + 60, target.y + 60, { steps: 10 });
  await page.mouse.up();
}

test("signed-out visitors are sent to the sign-in page", async ({ page }) => {
  for (const path of ["/", "/stats", "/cv", "/account", "/applications/new"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in$/);
  }
  await expect(
    page.getByRole("button", { name: "Sign in with GitHub" }),
  ).toBeVisible();
});

test("the demo board works without an account", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Try the demo first" }).click();
  await expect(
    column(page, "wishlist").getByRole("heading", { level: 3 }),
  ).toHaveCount(2);

  await drag(page, "Northwind Labs", "applied");
  await expect(column(page, "applied")).toContainText("Northwind Labs");
});

test("track an application from wishlist to offer", async ({
  page,
  context,
}) => {
  await signIn(context, "Ana");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "No applications yet" }),
  ).toBeVisible();

  await addApplication(page, { company: "Endava", role: "Junior Developer" });
  await addApplication(page, { company: "Amazon", role: "SDE Intern" });

  await page.goto("/");
  await expect(column(page, "wishlist")).toContainText("Endava");
  await expect(page.getByLabel("This week's goal")).toContainText(
    "0 of 5 sent",
  );

  // Search narrows the board.
  await page.getByLabel("Find").fill("amazon");
  await expect(page.getByText("1 of 2 shown")).toBeVisible();
  await expect(column(page, "wishlist")).not.toContainText("Endava");
  await page.getByLabel("Find").fill("");

  await drag(page, "Endava", "applied");
  await expect(column(page, "applied")).toContainText("Endava");
  await expect(page.getByLabel("This week's goal")).toContainText(
    "1 of 5 sent",
  );

  await drag(page, "Endava", "offer");
  await expect(column(page, "offer")).toContainText("Endava");
  await expect(page.getByText("An offer. Congratulations!")).toBeAttached();

  // The move survives a reload and is in the history.
  await page.reload();
  await column(page, "offer").getByRole("link", { name: "Endava" }).click();
  await expect(page.getByText("Moved from Applied to Offer")).toBeVisible();

  await page.goto("/stats");
  await expect(
    page.getByRole("heading", { name: "How far they got" }),
  ).toBeVisible();
});

test("the form refuses unsafe links and keeps what was typed", async ({
  page,
  context,
}) => {
  await signIn(context, "Ana");
  await page.goto("/applications/new");
  await page.getByLabel("Link to the posting").fill("javascript:alert(1)");
  await page.getByLabel("Notes").fill("keep me");
  await page.getByRole("button", { name: "Add application" }).click();

  await expect(page.getByText("Enter the company name.")).toBeVisible();
  await expect(
    page.getByText("The link must start with http:// or https://"),
  ).toBeVisible();
  await expect(page.getByLabel("Notes")).toHaveValue("keep me");
});

test("upload a CV and use every AI feature", async ({ page, context }) => {
  await signIn(context, "Ana");

  await page.goto("/cv");
  await page
    .locator("#cvFile")
    .setInputFiles("src/lib/__fixtures__/no-text.pdf");
  await page.getByRole("button", { name: "Upload PDF" }).click();
  await expect(page.getByText(/No text was found/)).toBeVisible();

  await page
    .locator("#cvFile")
    .setInputFiles("src/lib/__fixtures__/sample-cv.pdf");
  await page.getByRole("button", { name: "Upload PDF" }).click();
  await expect(page.getByText("Uploaded", { exact: true })).toBeVisible();
  await expect(page.locator("#cvText")).toHaveValue(/Ana Popescu/);

  await addApplication(page, {
    company: "Cedar Systems",
    role: "Backend Intern",
    posting: "We need Python and SQL. Docker is a plus.",
  });

  await page.getByRole("button", { name: "Analyze posting" }).click();
  await expect(
    page.getByText("A junior role for someone who knows Python and SQL."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Compare with my CV" }).click();
  await expect(page.getByText("You cover the required skills.")).toBeVisible();

  await page.getByRole("button", { name: "Draft a cover letter" }).click();
  // The letter is streamed: the first part shows before the whole text does.
  await expect(page.getByText(/I built a library/)).toBeVisible();
  await expect(
    page.getByText(/I built a library system with PostgreSQL/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Prepare for the interview" }).click();
  await expect(
    page.getByText("How would you design a table for loans?"),
  ).toBeVisible();

  // Changing the posting makes all of it stale, so it is cleared.
  // The "Add application" page is kept alive in the background after
  // navigating away, so pick the form that is actually on screen.
  await page
    .getByLabel("Job posting")
    .filter({ visible: true })
    .fill("A different job entirely.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("button", { name: "Analyze posting" }),
  ).toBeVisible();
  await expect(page.getByText(/I built a library system/)).toHaveCount(0);
});

test("one user cannot open another user's application", async ({ browser }) => {
  const anaContext = await browser.newContext();
  await signIn(anaContext, "Ana");
  const ana = await anaContext.newPage();
  await addApplication(ana, { company: "Private Co", role: "Intern" });
  const url = ana.url();

  const bogdanContext = await browser.newContext();
  await signIn(bogdanContext, "Bogdan");
  const bogdan = await bogdanContext.newPage();
  await bogdan.goto(url);
  await expect(
    bogdan.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await bogdan.goto("/");
  await expect(bogdan.getByText("Private Co")).toHaveCount(0);

  await anaContext.close();
  await bogdanContext.close();
});

test("move a card with the keyboard", async ({ page, context }) => {
  await signIn(context, "Ana");
  await addApplication(page, { company: "Keyboard Co", role: "Intern" });
  await page.goto("/");

  // Each step waits for the screen-reader announcement, which is also how a
  // person using a screen reader knows the key press was taken.
  const said = (text: string | RegExp) =>
    expect(page.getByText(text).first()).toBeAttached();
  const moveButton = page.getByRole("button", { name: "Move Keyboard Co" });

  await moveButton.focus();
  await page.keyboard.press("Space");
  await said("Keyboard Co is over Wishlist.");
  await page.keyboard.press("ArrowRight");
  await said("Keyboard Co is over Applied.");
  await page.keyboard.press("ArrowRight");
  await said("Keyboard Co is over Interview.");
  await page.keyboard.press("Space");
  await said("Keyboard Co moved to Interview.");
  await expect(column(page, "interview")).toContainText("Keyboard Co");
  // Focus stays on the card that was moved, ready for the next key press.
  await expect(moveButton).toBeFocused();

  // Escape cancels a move.
  await page.keyboard.press("Space");
  await said("Keyboard Co is over Interview.");
  await page.keyboard.press("ArrowLeft");
  await said("Keyboard Co is over Applied.");
  await page.keyboard.press("Escape");
  await said(/Move cancelled/);
  await expect(column(page, "interview")).toContainText("Keyboard Co");

  // Enter on the card's link still opens it.
  await page.getByRole("link", { name: "Keyboard Co" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Moved from Wishlist to Interview"),
  ).toBeVisible();
});

test("deadline reminders are opt-in, and the daily trigger is locked", async ({
  page,
  context,
  request,
}) => {
  await signIn(context, "Ana");
  await page.goto("/account");
  const box = page.getByRole("checkbox", { name: /Email me when a job/ });
  await expect(box).not.toBeChecked();
  await box.check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(box).toBeChecked();

  // Without the secret, nobody can make the server send emails.
  expect((await request.get("/api/cron/reminders")).status()).toBe(401);
  const wrong = await request.get("/api/cron/reminders", {
    headers: { authorization: "Bearer guess" },
  });
  expect(wrong.status()).toBe(401);
});

test("deleting the account removes the data and signs out", async ({
  page,
  context,
}) => {
  await signIn(context, "Ana");
  await addApplication(page, { company: "Soon Gone", role: "Intern" });

  await page.goto("/account");
  const button = page.getByRole("button", {
    name: "Delete my account and data",
  });
  await expect(button).toBeDisabled();
  await page.getByLabel(/Type .delete. to confirm/).fill("delete");
  await button.click();

  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("every page links to the source code", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(
    page.getByRole("link", { name: "Source code on GitHub" }),
  ).toHaveAttribute("href", "https://github.com/Rares-Mihai/job-hunter");
});
