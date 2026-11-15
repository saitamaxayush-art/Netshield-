/**
 * Every collapsible section in the studio: the arrow opens it, the row away from the arrow closes it,
 * Enter and Space do the same, and aria-expanded, the content and the arrow direction always agree.
 * Rows are at least 52px tall with a 24px arrow in a 44px box.
 */
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers'

const SECTIONS = ['Overview', 'Components', 'Critical', 'Degrees', 'Traversal', 'Paths', 'Compare'] as const

test.use({ viewport: { width: 1280, height: 900 } })

async function clickAt(page: Page, target: Locator, fx: number) {
  await target.scrollIntoViewIfNeeded()
  const r = await target.boundingBox()
  if (!r) throw new Error('not visible')
  await page.mouse.click(r.x + r.width * fx, r.y + r.height / 2)
}

/** Degrees the arrow is turned (0 points down, 180 points up). */
const arrowTurn = (arrow: Locator) =>
  arrow.evaluate((el) => {
    const r = getComputedStyle(el).rotate
    return r === 'none' ? 0 : Math.round(Number.parseFloat(r))
  })

test('analysis sections: arrow opens, row closes, Enter and Space toggle, and every state signal agrees', async ({ page, issues }) => {
  await page.goto('/studio?panel=analysis')
  await expect(page.getByTestId('analysis-results')).toBeVisible()
  for (const name of SECTIONS) {
    const header = page.getByRole('button', { name, exact: true })
    const panel = page.locator(`#${await header.getAttribute('aria-controls')}`)
    const arrow = header.locator('svg').last()
    const expectState = async (open: boolean, how: string) => {
      await expect(header, `${name} ${how}`).toHaveAttribute('aria-expanded', String(open))
      if (open) await expect(panel, `${name} ${how}: content shown`).toBeVisible()
      else await expect(panel, `${name} ${how}: content hidden`).toHaveCount(0)
      await expect.poll(() => arrowTurn(arrow), { message: `${name} ${how}: arrow` }).toBe(open ? 180 : 0)
    }
    if ((await header.getAttribute('aria-expanded')) === 'true') await header.click()
    await expectState(false, 'start closed')

    const box = await header.boundingBox()
    const icon = await arrow.boundingBox()
    expect(box!.height, `${name} row height`).toBeGreaterThanOrEqual(52)
    expect(icon!.width, `${name} arrow size`).toBeGreaterThanOrEqual(24)

    await clickAt(page, arrow, 0.5)
    await expectState(true, 'arrow click')
    await clickAt(page, header, 0.3)
    await expectState(false, 'row click away from the arrow')
    await header.focus()
    await page.keyboard.press('Enter')
    await expectState(true, 'Enter')
    await page.keyboard.press('Space')
    await expectState(false, 'Space')
  }
  // One open at a time.
  await page.getByRole('button', { name: 'Critical', exact: true }).click()
  await page.getByRole('button', { name: 'Paths', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Critical', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('button', { name: 'Paths', exact: true })).toHaveAttribute('aria-expanded', 'true')
  expect(issues).toEqual([])
})

test('folding rows (details): arrow opens, row closes, Enter and Space toggle', async ({ page, issues }) => {
  await page.goto('/studio?panel=analysis')
  await expect(page.getByTestId('analysis-results')).toBeVisible()
  const check = async (label: string, details: Locator) => {
    const summary = details.locator('summary')
    const arrow = summary.locator('svg').last()
    const open = () => details.evaluate((d) => (d as HTMLDetailsElement).open)
    const expectState = async (want: boolean, how: string) => {
      await expect.poll(open, { message: `${label} ${how}` }).toBe(want)
      await expect.poll(() => arrowTurn(arrow), { message: `${label} ${how}: arrow` }).toBe(want ? 180 : 0)
    }
    if (await open()) await summary.click()
    const row = await summary.boundingBox()
    expect(row!.height, `${label} row height`).toBeGreaterThanOrEqual(52)
    await clickAt(page, arrow, 0.5)
    await expectState(true, 'arrow click')
    // Away from the arrow, on the empty middle of the row (the row spans the panel's width).
    const panelWidth = (await details.boundingBox())!.width
    expect(row!.width, `${label} row spans the panel`).toBeGreaterThanOrEqual(panelWidth - 1)
    await clickAt(page, summary, 0.55)
    await expectState(false, 'row click')
    await summary.focus()
    await page.keyboard.press('Enter')
    await expectState(true, 'Enter')
    await page.keyboard.press('Space')
    await expectState(false, 'Space')
  }
  await check('Overview "What these numbers mean"', page.locator('[data-testid="section-overview"] details'))
  await page.getByRole('button', { name: 'Simulator', exact: true }).click()
  await check('Simulator "More options"', page.getByTestId('simulation-more'))
  expect(issues).toEqual([])
})
