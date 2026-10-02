import { useState, type FormEvent } from 'react'
import { useUpdateBusiness } from '../../api/queries'
import type { BusinessDetail, BusinessProfilePatch } from '../../api/types'
import { PaletteIcon } from '../../components/icons'
import { LogoField } from '../../components/LogoField'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ColorField } from '../../components/ui/ColorField'
import { Field } from '../../components/ui/Field'
import { inputClass } from '../../components/ui/styles'
import { MoneyInput } from '../../components/ui/MoneyInput'
import { useToast } from '../../components/ui/toast'
import { brandColor, isHexColor } from '../../lib/color'
import { errorMessage, fieldErrors, fieldMessage } from '../../lib/errors'
import { formatPhone } from '../../lib/phone'

interface Values {
  name: string
  tagline: string
  support_phone: string
  delivery_time: string
  min_order: string
  brand_color: string
}
type FieldName = keyof Values | 'logo'

function valuesOf(business: BusinessDetail): Values {
  return {
    name: business.name,
    tagline: business.tagline,
    support_phone: business.support_phone,
    delivery_time: business.delivery_time,
    min_order: String(business.min_order ?? 0),
    brand_color: brandColor(business.brand_color),
  }
}

/** Only what changed, typed for the API. */
function changesOf(values: Values, saved: Values): BusinessProfilePatch {
  const patch: BusinessProfilePatch = {}
  if (values.name.trim() !== saved.name) patch.name = values.name.trim()
  if (values.tagline.trim() !== saved.tagline) patch.tagline = values.tagline.trim()
  if (values.support_phone.trim() !== saved.support_phone) patch.support_phone = values.support_phone.trim()
  if (values.delivery_time.trim() !== saved.delivery_time) patch.delivery_time = values.delivery_time.trim()
  if (Number(values.min_order || '0') !== Number(saved.min_order)) patch.min_order = Number(values.min_order || '0')
  if (values.brand_color !== saved.brand_color) patch.brand_color = values.brand_color
  return patch
}

const id = (field: FieldName) => `profile-${field.replace('_', '-')}`
/** The API limit for the minimal order (so'm). */
const MAX_MIN_ORDER = 100_000_000

export function ProfileForm({ business }: { business: BusinessDetail }) {
  const update = useUpdateBusiness(business.slug)
  const toast = useToast()
  const saved = valuesOf(business)
  const [values, setValues] = useState(saved)
  const [logo, setLogo] = useState<File | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const changes: BusinessProfilePatch = removeLogo ? { ...changesOf(values, saved), logo: null } : changesOf(values, saved)
  const dirty = logo !== null || Object.keys(changes).length > 0

  const set = (field: keyof Values) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const reset = () => {
    setValues(saved)
    setLogo(null)
    setRemoveLogo(false)
    setErrors({})
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found: Partial<Record<FieldName, string>> = {}
    if (!values.name.trim()) found.name = 'Biznes nomini kiriting'
    if (!isHexColor(values.brand_color)) found.brand_color = fieldMessage('brand_color', 'invalid')
    if (Number(values.min_order || '0') > MAX_MIN_ORDER) found.min_order = 'Juda katta qiymat'

    setErrors(found)
    const first = (Object.keys(found) as FieldName[])[0]
    if (first) {
      document.getElementById(id(first))?.focus()
      return
    }
    if (!dirty) return

    try {
      const updated = await update.mutateAsync({ patch: changes, logo })
      setValues(valuesOf(updated))
      setLogo(null)
      setRemoveLogo(false)
      toast.success('Profil saqlandi')
    } catch (error) {
      const fields = fieldErrors(error) as Partial<Record<FieldName, string>>
      setErrors(fields)
      const field = (Object.keys(fields) as FieldName[])[0]
      if (field) document.getElementById(id(field))?.focus()
      else toast.error("Profilni saqlab bo'lmadi", { description: errorMessage(error) })
    }
  }

  return (
    <Card title="Profil" titleId="business-profile" icon={<PaletteIcon size={18} />}>
      <form noValidate onSubmit={submit} aria-labelledby="business-profile" className="space-y-4">
        <Field id={id('name')} label="Nomi" error={errors.name}>
          {(control) => (
            <input
              {...control}
              value={values.name}
              onChange={(event) => set('name')(event.target.value)}
              maxLength={120}
              className={inputClass(Boolean(errors.name))}
            />
          )}
        </Field>
        <Field id={id('tagline')} label="Shior" error={errors.tagline}>
          {(control) => (
            <input
              {...control}
              value={values.tagline}
              onChange={(event) => set('tagline')(event.target.value)}
              maxLength={200}
              placeholder="Eng mazali burgerlar 30 daqiqada"
              className={inputClass(Boolean(errors.tagline))}
            />
          )}
        </Field>
        <Field id={id('support_phone')} label="Aloqa telefoni" error={errors.support_phone}>
          {(control) => (
            <input
              {...control}
              type="tel"
              inputMode="tel"
              value={values.support_phone}
              onChange={(event) => set('support_phone')(event.target.value)}
              onBlur={() => set('support_phone')(formatPhone(values.support_phone.trim()))}
              maxLength={30}
              placeholder="+998 71 200 00 00"
              className={inputClass(Boolean(errors.support_phone))}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id={id('delivery_time')} label="Yetkazish" error={errors.delivery_time}>
            {(control) => (
              <input
                {...control}
                value={values.delivery_time}
                onChange={(event) => set('delivery_time')(event.target.value)}
                maxLength={20}
                placeholder="30–45"
                className={inputClass(Boolean(errors.delivery_time))}
              />
            )}
          </Field>
          <Field id={id('min_order')} label="Min. buyurtma" error={errors.min_order}>
            {(control) => (
              <MoneyInput
                {...control}
                value={values.min_order}
                onValueChange={set('min_order')}
                invalid={Boolean(errors.min_order)}
                placeholder="0"
              />
            )}
          </Field>
        </div>
        <ColorField id={id('brand_color')} value={values.brand_color} onChange={set('brand_color')} error={errors.brand_color} />
        <LogoField
          id={id('logo')}
          file={logo}
          onChange={setLogo}
          currentUrl={business.logo}
          removed={removeLogo}
          onRemovedChange={setRemoveLogo}
          name={values.name}
          color={values.brand_color}
          error={errors.logo}
        />
        <div className="flex gap-2 pt-1">
          {dirty && (
            <Button variant="ghost" onClick={reset} disabled={update.isPending}>
              Bekor qilish
            </Button>
          )}
          <Button type="submit" variant="dark" block loading={update.isPending} disabled={!dirty}>
            {update.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
