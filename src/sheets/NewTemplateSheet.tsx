import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createTemplate } from '../store'
import { openList } from '../store/nav'
import { useSheet } from './SheetProvider'

export function NewTemplateSheet() {
  const { closeSheet } = useSheet()
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 60)
    return () => window.clearTimeout(t)
  }, [])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const id = createTemplate(name)
    if (!id) {
      inputRef.current?.focus()
      return
    }
    closeSheet()
    openList(id)
  }

  return (
    <>
      <h3>New template</h3>
      <form autoComplete="off" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="f-tpln">Name</label>
          <input
            ref={inputRef}
            className="in"
            id="f-tpln"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Beach Weekend"
          />
        </div>
        <div className="sheet-actions">
          <button type="submit" className="btn btn-primary btn-wide">
            Create template
          </button>
        </div>
      </form>
    </>
  )
}
