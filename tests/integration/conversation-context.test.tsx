import { render, screen, waitFor } from '@testing-library/react';
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

describe('conversation keeps context across turns', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('changing the theme preserves guests, budget and date', async () => {
    const user = userEvent.setup();
    renderApp();

    // Turn 1: a full profile in one message.
    await user.click(screen.getByTestId('event-type-wedding'));
    await user.type(
      screen.getByTestId('chat-input'),
      'Reception for 120 guests in Pune, budget ₹3 lakh, theme minimalist, on 10 October 2026',
    );
    await user.click(screen.getByTestId('chat-send'));

    expect(await screen.findByDisplayValue('120')).toBeInTheDocument();
    expect(screen.getByDisplayValue('300000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pune')).toBeInTheDocument();

    // Turn 2: change just the theme.
    await user.type(screen.getByTestId('chat-input'), 'Change the theme to rustic');
    await user.click(screen.getByTestId('chat-send'));

    // The theme changed...
    expect(await screen.findByDisplayValue('rustic')).toBeInTheDocument();
    // ...and everything else survived — context is kept, nothing was re-asked.
    expect(screen.getByDisplayValue('120')).toBeInTheDocument();
    expect(screen.getByDisplayValue('300000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pune')).toBeInTheDocument();
    expect(screen.queryByText('How many guests are you expecting?')).not.toBeInTheDocument();
  });

  it('many turns stay usable and the transcript keeps growing', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByTestId('event-type-birthday'));
    for (let index = 0; index < 9; index += 1) {
      await user.type(screen.getByTestId('chat-input'), `note number ${index}`);
      await user.click(screen.getByTestId('chat-send'));
      // Wait for this turn to be answered before sending the next one.
      await waitFor(() => {
        expect(screen.getAllByTestId('chat-user')).toHaveLength(index + 1);
      });
    }

    // Every turn is visible in the transcript.
    expect(screen.getAllByTestId('chat-user')).toHaveLength(9);
  });
});
