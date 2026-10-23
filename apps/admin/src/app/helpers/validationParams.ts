import { EMAIL_MAX, PASSWORD_MAX } from '@acme/contracts';
import { AUDIT_ENTITY_ID_MAX, LIST_SEARCH_MAX } from './listQuery';

/**
 * Values the validation copy interpolates (G12: a cap shared by API and UI is one constant that
 * the copy interpolates, never a number typed into a sentence).
 */
export const VALIDATION_PARAMS = {
  emailMax: EMAIL_MAX,
  passwordMax: PASSWORD_MAX,
  searchMax: LIST_SEARCH_MAX,
  entityIdMax: AUDIT_ENTITY_ID_MAX,
} as const;
