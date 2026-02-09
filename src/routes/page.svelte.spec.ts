import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
	it('should render the app title', async () => {
		render(Page);

		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
		await expect.element(heading).toHaveTextContent('Excel → JSON');
	});

	it('should show the drop zone when no file is loaded', async () => {
		render(Page);

		const dropText = page.getByText('拖拽 Excel 文件到此处');
		await expect.element(dropText).toBeInTheDocument();
	});
});
