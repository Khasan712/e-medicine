import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { errorMessage, mapFieldErrors } from '../api/errors'
import type { NamePair } from '../api/types'
import { useI18n } from '../i18n/context'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Form'
import { Modal } from './ui/Modal'

interface NamePairModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  submitLabel: string
  initial?: NamePair
  /** Should throw the API error on failure (field errors are shown in the form). */
  onSubmit: (values: NamePair) => Promise<unknown>
  placeholderUz?: string
  placeholderRu?: string
  icon?: ReactNode
}

/** A small form with the Uzbek and Russian name (categories, units). */
export function NamePairModal(props: NamePairModalProps) {
  // The form mounts with every opening, so it always starts from `initial`.
  return props.open ? <NamePairDialog {...props} /> : null
}

function NamePairDialog({
  onClose,
  title,
  description,
  submitLabel,
  initial,
  onSubmit,
  placeholderUz,
  placeholderRu,
  icon,
}: NamePairModalProps) {
  const { t } = useI18n()
  const formId = useId()
  const [values, setValues] = useState<NamePair>({ name_uz: initial?.name_uz ?? '', name_ru: initial?.name_ru ?? '' })
  const [errors, setErrors] = useState<Partial<Record<keyof NamePair, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (key: keyof NamePair, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = { name_uz: values.name_uz.trim(), name_ru: values.name_ru.trim() }
    const nextErrors: typeof errors = {}
    if (!trimmed.name_uz) nextErrors.name_uz = t('field_required')
    if (!trimmed.name_ru) nextErrors.name_ru = t('field_required')
    setErrors(nextErrors)
    setFormError(null)
    if (Object.keys(nextErrors).length) return
    setBusy(true)
    try {
      await onSubmit(trimmed)
      onClose()
    } catch (error) {
      const fields = mapFieldErrors(error, t)
      setErrors(fields)
      if (!Object.keys(fields).length) setFormError(errorMessage(error, t))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!busy}
      title={title}
      description={description}
      icon={icon}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('cancel')}
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
        {formError && (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {formError}
          </p>
        )}
        <Field label={t('name_uz')} error={errors.name_uz} required>
          {(props) => (
            <Input
              {...props}
              data-autofocus
              value={values.name_uz}
              onChange={(event) => set('name_uz', event.target.value)}
              maxLength={100}
              placeholder={placeholderUz}
              autoComplete="off"
            />
          )}
        </Field>
        <Field label={t('name_ru')} error={errors.name_ru} required>
          {(props) => (
            <Input
              {...props}
              value={values.name_ru}
              onChange={(event) => set('name_ru', event.target.value)}
              maxLength={100}
              placeholder={placeholderRu}
              autoComplete="off"
            />
          )}
        </Field>
      </form>
    </Modal>
  )
}
