import { test, expect } from "@playwright/test";

test.describe("Fusion Advantec - AI Sales Support Hub E2E Suite", () => {
  test("1. Route Protection redirects unauthenticated users to /login", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("h1")).toContainText("Sales Support Hub");
  });

  test("2. Full User Journey: Register -> Login (1h Token) -> AI Product Search -> Manage Products CRUD", async ({
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

    // Step B: Login User
    await page.fill("#login-username", testUser);
    await page.fill("#login-password", testPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("/", { timeout: 10000 });
    await expect(page.locator("h1")).toContainText("Sales Support Hub");
    await expect(page.getByText("Protected Route (JWT Active)")).toBeVisible();

    // Step C: AI Product Suggestion (Figure 1 & Figure 2)
    await page.fill(
      '[data-testid="search-query-input"]',
      "Customer needs an automated single-use chromatography system for GMP monoclonal antibody purification"
    );
    await page.click('[data-testid="find-products-button"]');

    const resultsSection = page.locator('[data-testid="ai-results-section"]');
    await expect(resultsSection).toBeVisible({ timeout: 15000 });
    await expect(resultsSection).toContainText("Product Suggestion");
    await expect(resultsSection).toContainText("Supporting Documents");
    await expect(resultsSection).toContainText("Cross-selling");
    await expect(resultsSection).toContainText("DynaChrom system");

    // Step D: Manage Products Tab - Add / Edit / Delete Product (Figure 3)
    await page.click('[data-testid="tab-manage-products"]');
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
    await page.fill("#product-category", "Filtration & Membranes");
    await page.fill("#product-type", "TFF Filtration");
    await page.fill("#product-sub-type", "PES Cassette");
    await page.click('[data-testid="submit-product-modal"]');

    await expect(page.getByText(productName)).toBeVisible();

    // Edit the created product
    await page.click(`[data-testid="edit-product-${productName}"]`);
    await page.fill("#product-brand", "Advantec BioProcess");
    await page.click('[data-testid="submit-product-modal"]');
    await expect(page.getByText("Advantec BioProcess")).toBeVisible();

    // Delete the created product
    await page.click(`[data-testid="delete-product-${productName}"]`);
    await expect(page.getByText(productName)).toHaveCount(0);
  });
});
