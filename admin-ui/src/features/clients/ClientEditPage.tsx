import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { isApiError } from '../../api/client'
import { errorMessage, mapFieldErrors } from '../../api/errors'
import { useClient, useUpdateClient } from '../../api/queries'
import type { ClientUpdate } from '../../api/types'
import { NotFound } from '../../auth/SystemScreens'
import { useToast } from '../../components/feedback/feedback'
import { IconPhone } from '../../components/icons'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Card, CardHeader, InfoRow } from '../../components/ui/Card'
import { Field, Input, Textarea } from '../../components/ui/Form'
import { PageHeader } from '../../components/ui/PageHeader'
import { SkeletonText } from '../../components/ui/Skeleton'
import { ErrorState } from '../../components/ui/States'
import { useI18n } from '../../i18n/context'
import { fullName } from '../../lib/format'
import { useUnsavedChanges } from '../../lib/useUnsavedChanges'
import { ClientLangBadge } from './ClientsPage'

const EMPTY: ClientUpdate = { first_name: '', last_name: '', phone: '', location: '' }

export function ClientEditPage() {
  const { id = '' } = useParams()
  const { t } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const { data: client, isLoading, error, refetch } = useClient(id)
  const save = useUpdateClient(id)
  const [form, setForm] = useState<ClientUpdate>(EMPTY)
  const [initial, setInitial] = useState<ClientUpdate>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fill the form once — a background refetch must not overwrite what the user is typing.
  const loadedId = useRef<string | null>(null)
  useEffect(() => {
    if (!client || loadedId.current === id) return
    loadedId.current = id
    const values = {
      first_name: client.first_name ?? '',
      last_name: client.last_name ?? '',
      phone: client.phone ?? '',
      location: client.location ?? '',
    }
    setForm(values)
    setInitial(values)
  }, [client, id])

  const dirty = (Object.keys(form) as Array<keyof ClientUpdate>).some((key) => form[key] !== initial[key])
  const allowLeave = useUnsavedChanges(dirty)

  if (isApiError(error) && error.status === 404) return <NotFound />
  const back = { to: `/clients/${id}`, label: t('back') }

  const set = (key: keyof ClientUpdate, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    if (errors[key]) setErrors((current) => ({ ...current, [key]: '' }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setErrors({})
    save.mutate(
      { ...form, first_name: form.first_name.trim(), last_name: form.last_name.trim(), phone: form.phone.trim() },
      {
        onSuccess: () => {
          allowLeave()
          toast.success(t('client_saved'))
          navigate(`/clients/${id}`)
        },
        onError: (caught) => {
          const fields = mapFieldErrors(caught, t)
          setErrors(fields)
          if (!Object.keys(fields).length) toast.error(errorMessage(caught, t))
        },
      },
    )
  }

  return (
    <div className="max-w-3xl">
      <PageHeader back={back} title={t('edit_client')} description={client ? fullName(client.first_name, client.last_name) : undefined} />
      {!client ? (
        <Card>
          {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : isLoading ? <SkeletonText className="p-6" lines={6} /> : null}
        </Card>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-6">
          <Card>
            <CardHeader title={t('client_info')} description={t('update_client_details')} />
            <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
              <Field label={t('first_name')} error={errors.first_name}>
                {(props) => (
                  <Input {...props} value={form.first_name} onChange={(event) => set('first_name', event.target.value)} maxLength={150} autoComplete="off" />
                )}
              </Field>
              <Field label={t('last_name')} error={errors.last_name}>
                {(props) => (
                  <Input {...props} value={form.last_name} onChange={(event) => set('last_name', event.target.value)} maxLength={150} autoComplete="off" />
                )}
              </Field>
              <Field label={t('phone')} error={errors.phone} className="sm:col-span-2">
                {(props) => (
                  <Input
                    {...props}
                    type="tel"
                    inputMode="tel"
                    placeholder="+998 90 123 45 67"
                    leading={<IconPhone size={18} />}
                    value={form.phone}
                    onChange={(event) => set('phone', event.target.value)}
                  />
                )}
              </Field>
              <Field label={t('location')} error={errors.location} className="sm:col-span-2">
                {(props) => (
                  <Textarea {...props} rows={3} value={form.location} onChange={(event) => set('location', event.target.value)} />
                )}
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title={t('telegram_info')} />
            <dl className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-3">
              <InfoRow label={t('telegram_username')}>{client.tg_nick ? `@${client.tg_nick}` : '—'}</InfoRow>
              <InfoRow label={t('telegram')}>{client.telegram ? t('telegram_linked') : t('telegram_not_linked')}</InfoRow>
              <InfoRow label={t('language')}>
                <ClientLangBadge lang={client.lang} />
              </InfoRow>
            </dl>
          </Card>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <ButtonLink to={`/clients/${id}`} variant="secondary">
              {t('cancel')}
            </ButtonLink>
            <Button type="submit" loading={save.isPending} disabled={!dirty}>
              {t('save_changes')}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
