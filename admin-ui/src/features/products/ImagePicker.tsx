import { useEffect, useId, useRef, useState } from 'react'
import { IconImage, IconRefresh, IconTrash, IconUndo, IconUpload, IconX } from '../../components/icons'
import { Button } from '../../components/ui/Button'
import { useI18n } from '../../i18n/context'
import { cn } from '../../lib/cn'
import { formatNumber } from '../../lib/format'

export const MAX_IMAGE_MB = 5  // the API limit (LimitedImageField)
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

interface ImagePickerProps {
  /** The image already saved on the server (edit mode). */
  currentUrl: string | null
  file: File | null
  removed: boolean
  onFile: (file: File | null) => void
  onRemove: (removed: boolean) => void
  error?: string | null
  onError: (message: string | null) => void
  disabled?: boolean
}

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${formatNumber(Math.ceil(bytes / 1024))} KB`
}

/** Image upload with drag & drop, type/size checks and a local preview before saving. */
export function ImagePicker({ currentUrl, file, removed, onFile, onRemove, error, onError, disabled }: ImagePickerProps) {
  const { t } = useI18n()
  const inputId = useId()
  const hintId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLLabelElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const previewRef = useRef<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const replacePreview = (url: string | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = url
    setPreview(url)
  }

  // Release the preview's object URL when the form goes away.
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    },
    [],
  )

  const pick = (selected: File | undefined | null) => {
    if (!selected || disabled) return
    if (!ACCEPT.includes(selected.type)) {
      onError(t('field_image_type'))
      return
    }
    if (selected.size > MAX_IMAGE_MB * 1024 * 1024) {
      onError(t('field_image_size', { max: MAX_IMAGE_MB }))
      return
    }
    onError(null)
    onRemove(false)
    replacePreview(URL.createObjectURL(selected))
    onFile(selected)
  }

  const clearSelection = () => {
    replacePreview(null)
    onFile(null)
  }

  const shown = file && preview ? preview : !removed ? currentUrl : null

  // Drag & drop on the drop zone.
  const pickRef = useRef(pick)
  useEffect(() => {
    pickRef.current = pick
  })
  useEffect(() => {
    const zone = dropRef.current
    if (!zone) return
    const over = (event: DragEvent) => {
      event.preventDefault()
      setDragging(true)
    }
    const leave = () => setDragging(false)
    const drop = (event: DragEvent) => {
      event.preventDefault()
      setDragging(false)
      pickRef.current(event.dataTransfer?.files?.[0])
    }
    zone.addEventListener('dragover', over)
    zone.addEventListener('dragleave', leave)
    zone.addEventListener('drop', drop)
    return () => {
      zone.removeEventListener('dragover', over)
      zone.removeEventListener('dragleave', leave)
      zone.removeEventListener('drop', drop)
    }
  }, [shown])

  const input = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept={ACCEPT.join(',')}
      className="sr-only"
      disabled={disabled}
      aria-describedby={hintId}
      aria-invalid={error ? true : undefined}
      onChange={(event) => {
        pick(event.target.files?.[0])
        event.target.value = ''
      }}
    />
  )

  return (
    <div>
      {shown ? (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl bg-subtle ring-1 ring-line">
            <img src={shown} alt={t('product_image')} className="aspect-square w-full object-cover" />
            {file && (
              <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white shadow">
                {t('new_image')}
              </span>
            )}
          </div>
          {file && (
            <p className="truncate text-xs text-muted" title={file.name}>
              {file.name} · {sizeLabel(file.size)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {input}
            <label
              htmlFor={inputId}
              className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-card px-3 text-[13px] font-semibold text-fg-soft shadow-xs transition-colors hover:bg-hover hover:text-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary-500"
            >
              <IconRefresh size={15} />
              {t('change_image')}
            </label>
            {file ? (
              <Button variant="ghost" size="sm" icon={<IconX size={15} />} onClick={clearSelection} disabled={disabled}>
                {t('remove_selected')}
              </Button>
            ) : (
              <Button variant="danger-soft" size="sm" icon={<IconTrash size={15} />} onClick={() => onRemove(true)} disabled={disabled}>
                {t('remove_image')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {input}
          <label
            ref={dropRef}
            htmlFor={inputId}
            className={cn(
              'flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 text-center transition-colors',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary-500',
              dragging
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
                : error
                  ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-500/5'
                  : 'border-line-strong bg-subtle/50 hover:border-primary-400 hover:bg-primary-50/40 dark:hover:bg-primary-500/5',
            )}
          >
            <span className="flex size-14 items-center justify-center rounded-2xl bg-card text-primary-600 shadow-sm ring-1 ring-line dark:text-primary-400">
              {dragging ? <IconImage size={26} /> : <IconUpload size={26} />}
            </span>
            <span className="text-sm font-semibold text-fg">{t('upload_image')}</span>
            <span className="max-w-56 text-[13px] text-muted">{t('drop_image')}</span>
          </label>
          {removed && currentUrl && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <span>{t('image_will_be_removed')}</span>
              <Button variant="ghost" size="xs" icon={<IconUndo size={14} />} onClick={() => onRemove(false)}>
                {t('undo')}
              </Button>
            </div>
          )}
        </>
      )}
      {error ? (
        <p id={hintId} role="alert" className="mt-2 text-[13px] font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : (
        <p id={hintId} className="mt-2 text-xs leading-relaxed text-muted">
          {t('image_recommendation', { max: MAX_IMAGE_MB })}
        </p>
      )}
    </div>
  )
}
