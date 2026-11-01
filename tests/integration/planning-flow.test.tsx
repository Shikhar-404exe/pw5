import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../../src/App';
import { MiraProvider } from '../../src/lib/store';

function renderApp() {
  return render(
    <MiraProvider>
      <App />
    </MiraProvider>,
  );
}

describe('birthday planning flow', () => {
  it('creates a birthday event, then generates ideas, budget, timeline and checklist', async () => {
    const user = userEvent.setup();
    renderApp();

    // 1. Create the event.
    await user.click(screen.getByTestId('event-type-birthday'));
    expect(screen.getByTestId('field-guests')).toBeInTheDocument();

    // 2. Enter details through the summary.
    await user.clear(screen.getByTestId('field-guests'));
    await user.type(screen.getByTestId('field-guests'), '30');
    await user.tab();
    await user.clear(screen.getByTestId('field-budget'));
    await user.type(screen.getByTestId('field-budget'), '20000');
    await user.tab();

    // 3. Generate the full plan.
    await user.click(screen.getByTestId('quick-generate-plan'));

    // Budget appears with exact figures.
    await user.click(screen.getByTestId('nav-budget'));
    expect(await screen.findByTestId('budget-total')).toHaveTextContent('20,000');
    expect(screen.getByTestId('budget-allocated')).toHaveTextContent('20,000');
    expect(screen.queryByTestId('budget-warning')).not.toBeInTheDocument();

    // Timeline with relative labels (no date set).
    await user.click(screen.getByTestId('nav-timeline'));
    expect(await screen.findByTestId('timeline-list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(3);
    expect(screen.getByText(/relative/i)).toBeInTheDocument();

    // Checklist with progress.
    await user.click(screen.getByTestId('nav-checklist'));
    expect(await screen.findByTestId('checklist-progress-percent')).toHaveTextContent('0%');
    expect(screen.getByText('Order cake')).toBeInTheDocument();

    // Personalised concepts.
    await user.click(screen.getByTestId('nav-ideas'));
    expect((await screen.findAllByTestId(/^concept-card-/)).length).toBe(3);
  });
});

describe('conversation understanding', () => {
  it('extracts a full profile from one natural-language message', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByTestId('event-type-wedding'));
    await user.type(
      screen.getByTestId('chat-input'),
      'Reception for 120 guests in Pune, budget ₹3 lakh, theme minimalist, on 10 October 2026',
    );
    await user.click(screen.getByTestId('chat-send'));

    expect(await screen.findByText(/Guests: 120/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('120')).toBeInTheDocument(); // guests field
    expect(screen.getByDisplayValue('300000')).toBeInTheDocument(); // budget field
    expect(screen.getByDisplayValue('Pune')).toBeInTheDocument();
  });

  it('asks for missing essentials instead of inventing them', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByTestId('chat-input'), 'I want to plan a birthday party');
    await user.click(screen.getByTestId('chat-send'));

    expect(await screen.findByText('How many guests are you expecting?')).toBeInTheDocument();
    expect(screen.getByText('What is your total budget?')).toBeInTheDocument();
    // jest-dom reports an empty <input type="number"> value as null.
    expect(screen.getByTestId('field-guests')).toHaveValue(null);
    expect(screen.getByTestId('field-budget')).toHaveValue(null);
  });
});
