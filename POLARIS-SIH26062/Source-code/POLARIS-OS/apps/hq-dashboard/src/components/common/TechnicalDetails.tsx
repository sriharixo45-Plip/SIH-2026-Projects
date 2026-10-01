import type { ReactNode } from 'react'

export type TechnicalField = { label: string; value?: ReactNode }

type TechnicalDetailsProps = {
  fields?: TechnicalField[]
  children?: ReactNode
  summary?: string
}

export function TechnicalDetails({ fields = [], children, summary = 'View technical details' }: TechnicalDetailsProps) {
  if (!fields.some((field) => field.value != null && field.value !== '') && children == null) return null
  return <details className="technical-details">
    <summary>{summary}</summary>
    {fields.length > 0 && <dl>{fields.filter((field) => field.value != null && field.value !== '').map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>}
    {children}
  </details>
}
