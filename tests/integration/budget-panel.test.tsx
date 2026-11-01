import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../../src/App';
import { MiraProvider } from '../../src/lib/store';

function renderApp() {
  return render(
    <MiraProvider>
      <App />
    </MiraProvider>,
  );
}

describe('budget panel', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('recalculates remaining the moment an allocation is edited', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByTestId('demo-birthday'));
    await user.click(screen.getByTestId('nav-budget'));

    // Demo birthday budget is ₹20,000 and starts fully allocated.
    expect(await screen.findByTestId('budget-total')).toHaveTextContent('20,000');
    expect(screen.getByTestId('budget-allocated')).toHaveTextContent('20,000');
    expect(screen.getByTestId('budget-remaining')).toHaveTextContent('₹0');

    // Raise the venue line to 8,000 (from its suggested value) and blur to commit.
    const venue = screen.getByTestId('budget-allocation-venue');
    await user.clear(venue);
    await user.type(venue, '8000');
    await user.tab();

    // Remaining is now negative; an over-budget warning appears with a suggestion.
    expect(await screen.findByTestId('budget-warning')).toBeInTheDocument();
    expect(screen.getByTestId('budget-remaining')).toHaveTextContent('-');
    expect(screen.getByTestId('budget-total')).toHaveTextContent('20,000');
  });

  it('never silently fixes an over-budget plan: the total stays untouched after an allocation edit', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByTestId('demo-birthday'));
    await user.click(screen.getByTestId('nav-budget'));
    expect(await screen.findByTestId('budget-total')).toHaveTextContent('20,000');

    const venue = screen.getByTestId('budget-allocation-venue');
    await user.clear(venue);
    await user.type(venue, '50000');
    await user.tab();

    expect(await screen.findByTestId('budget-warning')).toBeInTheDocument();
    // The user's total is preserved — Mira suggests, never overwrites.
    expect(screen.getByTestId('budget-total')).toHaveTextContent('20,000');
    // The remaining is negative (over budget).
    expect(screen.getByTestId('budget-remaining')).toHaveTextContent('-');
  });

  it('retotals every line when the total budget changes', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByTestId('demo-birthday'));
    await user.click(screen.getByTestId('nav-budget'));
    expect(await screen.findByTestId('budget-total')).toHaveTextContent('20,000');

    const retotal = screen.getByLabelText('Change total budget (INR)');
    await user.clear(retotal);
    await user.type(retotal, '40000');
    await user.click(screen.getByTestId('budget-retotal-submit'));

    expect(await screen.findByTestId('budget-total')).toHaveTextContent('40,000');
    expect(screen.getByTestId('budget-allocated')).toHaveTextContent('40,000');
    expect(screen.getByTestId('budget-remaining')).toHaveTextContent('₹0');
  });

  it('rejects an empty allocation with an inline, announced error', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByTestId('demo-birthday'));
    await user.click(screen.getByTestId('nav-budget'));

    const venue = screen.getByTestId('budget-allocation-venue');
    await user.clear(venue);
    await user.tab();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // The plan is unchanged: allocated still equals total.
    expect(screen.getByTestId('budget-allocated')).toHaveTextContent('20,000');
  });
});
