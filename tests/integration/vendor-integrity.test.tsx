import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../../src/App';
import { MiraProvider } from '../../src/lib/store';
import { SAMPLE_VENDORS } from '../../src/lib/vendors';

function renderApp() {
  return render(
    <MiraProvider>
      <App />
    </MiraProvider>,
  );
}

describe('vendor integrity', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('labels every vendor as a demonstration sample — no fabricated real businesses', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByTestId('demo-wedding'));
    await user.click(screen.getByTestId('nav-vendors'));

    // The panel-level notice is visible before any vendor is shown.
    expect(await screen.findByTestId('vendor-sample-notice')).toHaveTextContent(
      /not real businesses/i,
    );

    // Every card carries its own sample badge.
    const cards = screen.getAllByTestId(/^vendor-card-/);
    expect(cards.length).toBe(SAMPLE_VENDORS.length);
    for (const card of cards) {
      expect(within(card).getByTestId('vendor-sample-badge')).toBeInTheDocument();
      expect(within(card).getByText(/Verification: sample data/i)).toBeInTheDocument();
      expect(within(card).getByText(/Rating: not available \(sample\)/i)).toBeInTheDocument();
    }
  });

  it('contacting a vendor requires an explicit second confirmation', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByTestId('demo-wedding'));
    await user.click(screen.getByTestId('nav-vendors'));

    const firstCard = (await screen.findByTestId(
      `vendor-card-${SAMPLE_VENDORS[0]!.id}`,
    )) as HTMLElement;
    const contact = within(firstCard).getByTestId(`vendor-contact-${SAMPLE_VENDORS[0]!.id}`);
    await user.click(contact);

    // One click is not enough: a confirmation step appears.
    const confirm = within(firstCard).getByTestId(`vendor-confirm-${SAMPLE_VENDORS[0]!.id}`);
    await user.click(confirm);

    expect(
      await within(firstCard).findByTestId(`vendor-contacted-${SAMPLE_VENDORS[0]!.id}`),
    ).toHaveTextContent(/demo/i);
  });

  it('filters vendors deterministically and honestly reports zero results', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByTestId('demo-community'));
    await user.click(screen.getByTestId('nav-vendors'));

    expect(await screen.findByTestId('vendor-result-count')).toHaveTextContent(
      `${SAMPLE_VENDORS.length} sample vendors`,
    );

    // An impossible budget shows the empty state rather than inventing vendors.
    await user.type(screen.getByTestId('vendor-filter-budget'), '1');
    expect(await screen.findByTestId('vendors-no-results')).toBeInTheDocument();
    expect(screen.getByTestId('vendor-result-count')).toHaveTextContent('0 sample vendors');

    // Clearing the filter brings the labelled samples back.
    await user.clear(screen.getByTestId('vendor-filter-budget'));
    expect(await screen.findByTestId(`vendor-card-${SAMPLE_VENDORS[0]!.id}`)).toBeInTheDocument();
  });
});
