import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../../src/App';
import { MiraProvider } from '../../src/lib/store';
import { STORAGE_KEY } from '../../src/lib/persist';

function renderApp() {
  return render(
    <MiraProvider>
      <App />
    </MiraProvider>,
  );
}

describe('checklist persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('toggling an item updates progress and survives a full remount', async () => {
    const user = userEvent.setup();
    const first = renderApp();

    await user.click(screen.getByTestId('demo-wedding'));
    await user.click(screen.getByTestId('nav-checklist'));

    expect(await screen.findByTestId('checklist-progress-percent')).toHaveTextContent('0%');

    // Toggle the first visible checklist item.
    const toggles = screen.getAllByRole('checkbox');
    await user.click(toggles[0]!);

    // Progress moves and the total plan is stored.
    expect(await screen.findByTestId('checklist-progress-percent')).not.toHaveTextContent('0%');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeTruthy();

    // Simulate a browser refresh: unmount everything, then mount a fresh tree.
    first.unmount();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeTruthy();

    renderApp();
    expect(await screen.findByTestId('app-shell')).toBeInTheDocument();
    await user.click(screen.getByTestId('nav-checklist'));
    expect(await screen.findByTestId('checklist-progress-percent')).not.toHaveTextContent('0%');

    // Exactly one item is ticked — the user's work was preserved, not regenerated.
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes.filter((box) => box.checked)).toHaveLength(1);
  });

  it('Reset data clears storage and returns to the honest empty state', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByTestId('demo-community'));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeTruthy();

    await user.click(screen.getByTestId('reset-button'));
    // Confirm step required — destructive actions are never one-click.
    await user.click(screen.getByTestId('reset-confirm'));

    // Storage now holds only the empty initial plan — the demo data is gone.
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    expect(stored?.profile).toBeNull();
    expect(stored?.budget).toBeNull();
    expect(stored?.timeline).toEqual([]);
    expect(stored?.checklist).toEqual([]);

    expect(await screen.findByTestId('no-event-empty')).toBeInTheDocument();

    // Every module returns to its own honest empty state.
    await user.click(screen.getByTestId('nav-budget'));
    expect(screen.getByTestId('budget-empty')).toBeInTheDocument();
    await user.click(screen.getByTestId('nav-timeline'));
    expect(screen.getByTestId('timeline-empty')).toBeInTheDocument();
    await user.click(screen.getByTestId('nav-checklist'));
    expect(screen.getByTestId('checklist-empty')).toBeInTheDocument();
  });
});
