import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import { MiraProvider } from '../../src/lib/store';

function renderApp() {
  return render(
    <MiraProvider>
      <App />
    </MiraProvider>,
  );
}

describe('missing AI configuration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Simulate a deployed instance where the operator set no credentials:
    // the health endpoint says "not configured" and the proxy answers 503.
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/health')) {
          return Promise.resolve(
            new Response(JSON.stringify({ ok: true, aiConfigured: false }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        if (url.includes('/api/ai')) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: 'AI provider is not configured' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to the built-in planner and says so, without breaking the flow', async () => {
    const user = userEvent.setup();
    renderApp();

    // The header badge tells the truth about the mode.
    expect(await screen.findByTestId('mode-badge')).toHaveTextContent(/Demo mode/i);

    // The app is still fully usable: create an event and chat.
    await user.click(screen.getByTestId('event-type-birthday'));
    await user.type(screen.getByTestId('chat-input'), 'Party for 20 guests, budget ₹15000');
    await user.click(screen.getByTestId('chat-send'));

    // A clear, non-technical notice explains the fallback...
    expect(await screen.findByText(/no AI provider is configured/i)).toBeInTheDocument();
    // ...and the built-in planner still did the work.
    expect(await screen.findByDisplayValue('20')).toBeInTheDocument();
    expect(screen.getByDisplayValue('15000')).toBeInTheDocument();
  });

  it('never leaks secrets or upstream details into the DOM', async () => {
    const { container } = renderApp();
    await waitFor(() => expect(screen.getByTestId('mode-badge')).toBeInTheDocument());

    const html = container.innerHTML;
    // Nothing that looks like an API key or env var name appears in the client.
    expect(html).not.toMatch(/sk-[A-Za-z0-9]{10,}/);
    expect(html).not.toMatch(/MIRA_AI_API_KEY/);
    expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9]/);
    // The proxy contract itself is honoured: only aiConfigured is exposed.
    const health = await fetch('/api/health');
    const body = (await health.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['aiConfigured', 'ok']);
  });
});
