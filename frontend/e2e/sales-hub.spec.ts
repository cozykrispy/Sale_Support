import { test, expect } from "@playwright/test";

test.describe("Fusion Advantec - AI Sales Support Hub E2E Suite", () => {
  test("1. Route Protection redirects unauthenticated users to /login", async ({
    page,
  }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("h1")).toContainText("Sales Support Hub");
  });

  test("2. Full Multi-Route Journey: Register -> Login -> /home Search -> /productmanage CRUD -> /analyze Graphs", async ({
    page,
  }) => {
    const uniqueSuffix = Date.now();
    const testUser = `sales_${uniqueSuffix}`;
    const testEmail = `sales_${uniqueSuffix}@fusion.co.th`;
    const testPassword = "SecurePassword123!";

    // Step A: Register User
    await page.goto("/register");
    await page.fill("#register-username", testUser);
    await page.fill("#register-email", testEmail);
    await page.fill("#register-password", testPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // Step B: Login User -> redirects to /home
    await page.fill("#login-username", testUser);
    await page.fill("#login-password", testPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });
    await expect(page.locator("h1")).toContainText("Sales Support Hub");

    // Step C: Search on /home and open Product Detail Modal
    await page.fill(
      '[data-testid="search-query-input"]',
      "DynaChrom system"
    );
    await page.click('[data-testid="find-products-button"]');

    const resultsSection = page.locator('[data-testid="ai-results-section"]');
    await expect(resultsSection).toBeVisible({ timeout: 15000 });
    await expect(resultsSection).toContainText("DynaChrom system");

    // Step D: Navigate to /productmanage and test Add/Edit/Delete with Confirmation Dialog
    await page.click('[data-testid="tab-manage-products"]');
    await expect(page).toHaveURL(/\/productmanage/, { timeout: 10000 });
    await expect(
      page.locator('[data-testid="catalog-count-heading"]')
    ).toContainText("Product Catalog");

    // Open Add New Product Modal
    await page.click('[data-testid="add-product-button"]');
    const productName = `Advantec UltraFilter ${uniqueSuffix}`;
    await page.fill("#product-name", productName);
    await page.fill("#product-brand", "Advantec");
    await page.fill(
      "#product-description",
      "High-flux tangential flow filtration cassette for bioprocess concentration and diafiltration."
    );
    await page.fill(
      "#product-image-url",
      "https://example.com/ultrafilter.jpg"
    );
    await page.click('[data-testid="submit-product-modal"]');
    // Confirm Create in ConfirmDialog
    await page.click('[data-testid="confirm-dialog-submit"]');

    await expect(page.getByText(productName)).toBeVisible();

    // Delete the created product with Confirmation Dialog
    await page.click(`[data-testid="delete-product-${productName}"]`);
    await page.click('[data-testid="confirm-dialog-submit"]');
    await expect(page.getByText(productName)).toHaveCount(0);

    // Step E: Navigate to /analyze and verify Graphs
    await page.click('[data-testid="tab-analytics-dashboard"]');
    await expect(page).toHaveURL(/\/analyze/, { timeout: 10000 });
    await expect(page.getByText("Graph 01 / Category Coverage Bar Chart")).toBeVisible();
  });
});
