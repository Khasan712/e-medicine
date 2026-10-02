import { expect, test, type Page } from '@playwright/test'
import { newBusiness, urls } from './env'
import { completeOrder, fillCatalog, openBusiness, placeOrder, signInToAdmin } from './steps'

/**
 * The life of a business, through every part: our panel opens it → its owner signs in to the admin panel and
 * fills the catalog → a customer orders in the shop → the owner completes the order → the customer sees it.
 */
test.describe.serial('a new business from opening to the first order', () => {
  const business = newBusiness()
  const product = 'E2E Chizburger'
  let orderId = 0
  // The owner's and the customer's browsers stay signed in across the steps.
  let owner: Page
  let customer: Page

  test.beforeAll(async ({ browser }) => {
    owner = await (await browser.newContext()).newPage()
    customer = await (await browser.newContext()).newPage()
  })

  test.afterAll(async () => {
    await owner.context().close()
    await customer.context().close()
  })

  test('our panel opens the business', async ({ page }) => {
    await openBusiness(page, business)
    await expect(page.getByText(`${business.slug}.`).first()).toBeVisible()
  })

  test('the owner signs in to the admin panel and fills the catalog', async () => {
    await signInToAdmin(owner, business)
    await fillCatalog(owner, business, product)
  })

  test('a customer orders in the shop', async () => {
    orderId = await placeOrder(customer, business, product)
    expect(orderId).toBeGreaterThan(0)
  })

  test('the owner completes the order and the customer sees it', async () => {
    await completeOrder(owner, business, orderId)
    await customer.goto(`${urls.shop(business.slug)}/orders/${orderId}`)
    await expect(customer.getByText('Buyurtma topshirildi. Yoqimli ishtaha!')).toBeVisible()
  })

  test('a suspended business closes its shop and admin panel until it is activated again', async ({ page }) => {
    await openBusinessPage(page)
    await page.getByRole('button', { name: "To'xtatish" }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: "To'xtatish" }).click()
    await expect(page.getByText("Biznes to'xtatildi")).toBeVisible()

    await customer.goto(urls.shop(business.slug))
    await expect(customer.getByText('Do‘kon vaqtincha ishlamayapti')).toBeVisible()
    await owner.goto(`${urls.admin(business.slug)}/orders`)
    await expect(owner.getByText("Biznes vaqtincha to'xtatilgan").first()).toBeVisible()

    await page.getByRole('button', { name: 'Yoqish' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Yoqish' }).click()
    await expect(page.getByText('Biznes yoqildi')).toBeVisible()
    await customer.goto(urls.shop(business.slug))
    await expect(customer.getByRole('article', { name: product })).toBeVisible()
  })

  /** Our panel, signed in, on the business page. */
  async function openBusinessPage(page: Page) {
    const { platformAccount } = await import('./env')
    const account = platformAccount()
    await page.goto(`${urls.platform}/login`)
    await page.getByLabel('Telefon').fill(account.phone)
    await page.getByLabel('Parol', { exact: true }).fill(account.password)
    await page.getByRole('button', { name: 'Kirish' }).click()
    await expect(page.getByRole('heading', { name: 'Bizneslar' })).toBeVisible()
    await page.goto(`${urls.platform}/b/${business.slug}`)
    await expect(page.getByRole('heading', { name: business.name })).toBeVisible()
  }
})
