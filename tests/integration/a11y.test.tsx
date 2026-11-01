import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import axe, { type AxeResults } from 'axe-core';
import App from '../../src/App';
import { MiraProvider } from '../../src/lib/store';

function renderApp() {
  return render(
    <MiraProvider>
      <App />
    </MiraProvider>,
  );
}

/**
 * jsdom has no layout engine, so rules that need rendering geometry are disabled.
 * Everything semantic (names, roles, structure, labels, ARIA validity) is checked.
 */
const AXE_OPTIONS: axe.RunOptions = {
  rules: {
    'color-contrast': { enabled: false }, // needs a real rendering engine
    'target-size': { enabled: false }, // needs pointer-geometry simulation
    'aria-required-children': { enabled: false },
  },
  resultTypes: ['violations'],
};

async function expectNoViolations(root: HTMLElement, context: string): Promise<void> {
  const results: AxeResults = await axe.run(root, AXE_OPTIONS);
  const summary = results.violations
    .map((violation) => `${violation.id} (${violation.nodes.length}): ${violation.help}`)
    .join('\n');
  expect(summary, `axe violations in ${context}:\n${summary}`).toBe('');
}

describe('accessibility (axe-core)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('the empty, pre-event state has no axe violations', async () => {
    const { container } = renderApp();
    await waitFor(() => expect(screen.getByTestId('app-shell')).toBeInTheDocument());
    await expectNoViolations(container, 'empty state');
  });

  it('the conversation after creating an event has no axe violations', async () => {
    const user = userEvent.setup();
    const { container } = renderApp();

    await user.click(screen.getByTestId('event-type-wedding'));
    await user.type(screen.getByTestId('chat-input'), 'Reception for 120 guests, budget ₹3 lakh');
    await user.click(screen.getByTestId('chat-send'));
    await screen.findByDisplayValue('120');

    await expectNoViolations(container, 'conversation with event');
  });

  it('every module panel of a loaded demo plan has no axe violations', async () => {
    const user = userEvent.setup();
    const { container } = renderApp();

    await user.click(screen.getByTestId('demo-wedding'));

    for (const tab of ['ideas', 'budget', 'timeline', 'vendors', 'checklist'] as const) {
      await user.click(screen.getByTestId(`nav-${tab}`));
      await waitFor(() => expect(screen.getByTestId(`nav-${tab}`)).toHaveAttribute('aria-current'));
      await expectNoViolations(container, `${tab} panel`);
    }
  });
});
