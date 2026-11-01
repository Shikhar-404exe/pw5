import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../../src/App';
import { MiraProvider } from '../../src/lib/store';

describe('debug', () => {
  it('over budget test', async () => {
    const user = userEvent.setup();
    render(
      <MiraProvider>
        <App />
      </MiraProvider>,
    );
    await user.click(screen.getByTestId('demo-birthday'));
    await user.click(screen.getByTestId('nav-budget'));
    const venue = screen.getByTestId('budget-allocation-venue') as HTMLInputElement;
    await user.clear(venue);
    await user.type(venue, '50000');
    await user.tab();
    await user.tab();
    const buttons = screen.getAllByRole('button', { name: 'Apply' });
    await user.click(buttons[0]!);
    console.log('ALLOCATED:', screen.getByTestId('budget-allocated').textContent);
    console.log('REMAINING:', screen.getByTestId('budget-remaining').textContent);
    // Use .toHaveTextContent
    expect(screen.getByTestId('budget-remaining')).toHaveTextContent('-');
    console.log('PASS');
  });
});
