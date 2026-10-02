import { useId, type ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { ErrorCircleIcon } from '../icons'

export interface ControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}

interface FieldProps {
  label: ReactNode
  /** Adds "(ixtiyoriy)" or a custom note after the label. */
  optional?: boolean | string
  hint?: ReactNode
  error?: string | null
  id?: string
  className?: string
  children: (control: ControlProps) => ReactNode
}

/** A label, the control (render prop gets the ids for a11y), a hint and an error. */
export function Field({ label, optional, hint, error, id, className, children }: FieldProps) {
  const autoId = useId()
  const controlId = id ?? autoId
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`
  const describedBy = cx(hint ? hintId : null, error ? errorId : null) || undefined

  return (
    <div className={className}>
      <label htmlFor={controlId} className="block text-sm font-semibold text-slate-700">
        {label}
        {optional && (
          <span className="font-normal text-slate-400"> ({optional === true ? 'ixtiyoriy' : optional})</span>
        )}
      </label>
      <div className="mt-1.5">
        {children({ id: controlId, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-slate-500">
          {hint}
        </p>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  )
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-[13px] font-semibold text-red-600">
      <ErrorCircleIcon size={15} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  )
}
