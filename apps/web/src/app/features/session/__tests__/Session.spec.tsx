import { act, render, screen } from '@testing-library/react';
import { t } from '@/app/i18n';
import { useAuthStore } from '@/app/store/authStore';
import { SESSION } from '@/test/fixtures';
import Session from '../Session';

describe('Session island (header chip)', () => {
  it('keeps its place until the session is known, then links the profile by name', () => {
    render(<Session />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    act(() => useAuthStore.getState().setSession(SESSION));
    const link = screen.getByRole('link', {
      name: t('session.profileLink', { name: 'Ada Lovelace' }),
    });
    expect(link).toHaveAttribute('href', '/app/profile');
    expect(link).toHaveTextContent('AAda');
  });

  it('links the English profile on English pages', () => {
    useAuthStore.getState().setSession(SESSION);
    render(<Session locale="en-US" />);
    expect(screen.getByRole('link', { name: 'Your profile, Ada Lovelace' })).toHaveAttribute(
      'href',
      '/en/app/profile',
    );
  });
});
