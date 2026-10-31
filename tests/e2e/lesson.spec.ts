import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function placePart(page: Page, kind: 'resistor' | 'led', anchor: string, rotation = '0') {
  await page.getByLabel('元件', { exact: true }).selectOption(kind);
  await page.getByLabel('锚点孔位', { exact: true }).fill(anchor);
  await page.getByLabel('方向', { exact: true }).selectOption(rotation);
  await page.getByRole('button', { name: '放置元件', exact: true }).click();
}

async function wire(page: Page, from: string, to: string) {
  await page.getByLabel('导线起点').fill(from);
  await page.getByLabel('导线终点').fill(to);
  await page.getByRole('button', { name: '添加导线', exact: true }).click();
}

async function assemble(page: Page, reversed = false) {
  await placePart(page, 'resistor', 'a10');
  await placePart(page, 'led', reversed ? 'c14' : 'c13', reversed ? '180' : '0');
  await wire(page, 'battery:+', 'b10');
  await wire(page, 'd14', 'battery:-');
}

test('deletion works with keyboard and visible toolbar without deleting while typing', async ({ page }) => {
  await page.goto('/');
  await placePart(page, 'resistor', 'a10');
  const part = page.getByRole('button', { name: '电阻 330 欧姆，锚点 a10', exact: true });
  await page.getByLabel('所选元件新锚点').focus();
  await page.keyboard.press('Backspace');
  await expect(part).toBeVisible();
  for (const key of ['Delete', 'Backspace']) {
    await part.click();
    await page.keyboard.press(key);
    await expect(part).toHaveCount(0);
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    await expect(part).toBeVisible();
  }
  await part.click();
  await page.getByRole('toolbar', { name: '电路编辑操作' }).getByRole('button', { name: '删除', exact: true }).click();
  await expect(part).toHaveCount(0);
  await page.reload();
  await expect(part).toHaveCount(0);
});

test('build a valid circuit, inspect connections, and restore after reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  if (test.info().project.name === 'chromium') {
    await page.screenshot({ path: 'test-results/workbench-desktop.png', fullPage: true });
  }
  await assemble(page);
  await page.getByRole('button', { name: '运行电路', exact: true }).click();
  await expect(page.getByRole('heading', { name: '亮起来了！' })).toBeVisible();
  if (test.info().project.name === 'chromium') {
    await page.screenshot({ path: 'test-results/circuit-complete.png', fullPage: true });
  }
  await expect(page.getByText('7.58', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '查看 a1 的连接' }).click();
  await expect(page.getByText('a1 所在网络包含 5 个孔位／端口')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('status')).toContainText('已恢复本地作品');
  await expect(page.getByRole('heading', { name: '亮起来了！' })).toHaveCount(0);
  await page.getByRole('button', { name: '运行电路', exact: true }).click();
  await expect(page.getByRole('heading', { name: '亮起来了！' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('request progressive hints for reversed LED, repair it, and invalidate old results', async ({ page }) => {
  await page.goto('/');
  await assemble(page, true);
  await page.getByRole('button', { name: '运行电路', exact: true }).click();
  await expect(page.getByRole('button', { name: '揭开第一个线索' })).toBeEnabled();
  await expect(page.locator('.hint-list li')).toHaveCount(0);
  await page.getByRole('button', { name: '揭开第一个线索' }).click();
  await expect(page.locator('.hint-list li')).toHaveCount(1);
  await page.getByRole('button', { name: '再给我一个线索' }).click();
  await page.getByRole('button', { name: '再给我一个线索' }).click();
  await expect(page.locator('.hint-list li')).toHaveCount(3);
  await page.getByRole('button', { name: '红色 LED，锚点 c14', exact: true }).click();
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.locator('.hint-list li')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '揭开第一个线索' })).toBeDisabled();
  await placePart(page, 'led', 'c13');
  await page.getByRole('button', { name: '运行电路', exact: true }).click();
  await expect(page.getByRole('heading', { name: '亮起来了！' })).toBeVisible();
});

test('pointer placement previews pins, rejects occupied holes, and supports history', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '电阻 330 Ω · 可调整' }).click();
  const hole = page.getByRole('button', { name: '孔位 a10，空闲', exact: true });
  await hole.hover();
  await expect(page.locator('.preview.valid')).toBeVisible();
  await hole.click();
  await expect(page.getByRole('button', { name: '电阻 330 欧姆，锚点 a10', exact: true })).toBeVisible();
  await wire(page, 'battery:+', 'a10');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: '导线 battery:+ 到 a10', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByRole('button', { name: '电阻 330 欧姆，锚点 a10', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(page.getByRole('button', { name: '电阻 330 欧姆，锚点 a10', exact: true })).toBeVisible();
});

test('complete the lesson using keyboard controls without dragging', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('锚点孔位', { exact: true }).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('a10');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '红色 LED 注意 A / K 极性' }).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('锚点孔位', { exact: true }).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('c13');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '红色 LED，锚点 c13', exact: true })).toBeVisible();
  for (const [from, to] of [['battery:+', 'b10'], ['d14', 'battery:-']]) {
    await page.getByLabel('导线起点').focus();
    await page.keyboard.type(from ?? '');
    await page.keyboard.press('Tab');
    await page.keyboard.type(to ?? '');
    await page.keyboard.press('Enter');
  }
  await page.getByRole('button', { name: '运行电路', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: '亮起来了！' })).toBeVisible();
});

test('surface storage failures without losing the in-memory document', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
  });
  await page.goto('/');
  await placePart(page, 'resistor', 'a10');
  await expect(page.getByRole('status')).toContainText('未保存');
  await expect(page.getByRole('button', { name: '电阻 330 欧姆，锚点 a10', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '重试保存', exact: true })).toBeVisible();
});

test('a wire crossing an empty socket does not prevent selecting that socket', async ({ page }) => {
  await page.goto('/');
  await wire(page, 'battery:+', 'b10');
  await page.getByRole('button', { name: '孔位 c10，空闲', exact: true }).click();
  await expect(page.getByText('c10 所在网络包含 6 个孔位／端口')).toBeVisible();
  await page.getByRole('button', { name: '孔位 c10，空闲', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: '孔位 c11，空闲', exact: true })).toBeFocused();
});
