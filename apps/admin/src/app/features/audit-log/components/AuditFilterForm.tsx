import { AppButton } from '@acme/ui';
import { FormTextField } from '@/app/components/FormTextField';
import { AUDIT_ENTITY_ID_MAX } from '@/app/helpers/listQuery';
import { t } from '@/app/i18n';
import { useAuditFilterForm } from '../hooks/useAuditLogPage';

interface AuditFilterFormProps {
  entityId: string | null;
  onApply: (value: string) => void;
  onClear: () => void;
}

export function AuditFilterForm({ entityId, onApply, onClear }: AuditFilterFormProps) {
  const form = useAuditFilterForm(entityId ?? '', onApply);
  return (
    <form
      method="post"
      noValidate
      role="search"
      onSubmit={form.onSubmit}
      className="flex flex-col gap-2 sm:flex-row sm:items-start"
    >
      <div className="min-w-0 grow">
        <FormTextField
          control={form.control}
          name="entityId"
          label={t('auditLog.filter.label')}
          description={t('auditLog.filter.hint')}
          autoComplete="off"
          maxLength={AUDIT_ENTITY_ID_MAX}
        />
      </div>
      <div className="flex gap-2 sm:pt-7">
        <AppButton type="submit" variant="secondary">
          {t('auditLog.filter.submit')}
        </AppButton>
        {entityId && (
          <AppButton variant="ghost" onPress={onClear}>
            {t('auditLog.filter.clear')}
          </AppButton>
        )}
      </div>
    </form>
  );
}
