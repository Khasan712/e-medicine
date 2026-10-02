import { useState, type InputHTMLAttributes, type Ref } from 'react'
import { EyeIcon, EyeOffIcon } from '../icons'
import { inputClass } from './styles'

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  invalid?: boolean
  ref?: Ref<HTMLInputElement>
}

export function PasswordInput({ invalid, className, ref, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input ref={ref} type={visible ? 'text' : 'password'} className={inputClass(invalid, `h-11 pr-12 text-[15px] ${className ?? ''}`)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Parolni yashirish' : "Parolni ko'rsatish"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-1.5 my-auto grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        {visible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
      </button>
    </div>
  )
}
