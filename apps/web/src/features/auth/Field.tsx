import { Eye, EyeOff } from 'lucide-react'
import { type InputHTMLAttributes, useId, useState } from 'react'

/** Campo de formulário com rótulo visível, dica e erro ligados por aria. */
export function Field({
  label,
  hint,
  error,
  type = 'text',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null }) {
  const id = useId()
  const [reveal, setReveal] = useState(false)
  const isPassword = type === 'password'
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && reveal ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] outline-none transition-colors placeholder:text-ink-3 focus:border-line-strong aria-[invalid]:border-danger"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? 'Esconder senha' : 'Mostrar senha'}
            className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:bg-surface-2"
          >
            {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

/** Só aceita caminho interno ("/serie/3") — um `?redirect=https://outro.site` não pode levar a pessoa embora. */
export function safeRedirect(value: string | undefined): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}
