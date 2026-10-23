import { localHref } from '@/app/helpers/navigation';
import { t } from '@/app/i18n';
import { ROUTES } from '@/app/lib/endpoints';
import { useAuthStore } from '@/app/store/authStore';

/** The header's "who is signed in": first name and initial, linking to the profile. */
export function useSessionChip() {
  const user = useAuthStore((state) => state.user);
  const firstName = user?.fullName.split(' ')[0] ?? '';
  return {
    isVisible: user !== null,
    firstName,
    initial: firstName.charAt(0),
    href: localHref(ROUTES.profile),
    label: t('session.profileLink', { name: user?.fullName ?? '' }),
  };
}
