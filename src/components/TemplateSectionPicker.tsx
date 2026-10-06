import type { Section } from '../store'

export type TemplateGroup = {
  templateId: string
  templateName: string
  sections: Section[]
}

type Props = {
  groups: TemplateGroup[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}

/** Checkbox picker: templates with nested sections; tap template name = all sections. */
export function TemplateSectionPicker({ groups, selected, onChange }: Props) {
  const toggleSection = (sectionId: string) => {
    const next = new Set(selected)
    if (next.has(sectionId)) next.delete(sectionId)
    else next.add(sectionId)
    onChange(next)
  }

  const toggleTemplate = (group: TemplateGroup) => {
    const ids = group.sections.map((s) => s.id)
    const allOn = ids.length > 0 && ids.every((id) => selected.has(id))
    const next = new Set(selected)
    if (allOn) {
      for (const id of ids) next.delete(id)
    } else {
      for (const id of ids) next.add(id)
    }
    onChange(next)
  }

  if (groups.length === 0) {
    return <p className="hint">No templates yet.</p>
  }

  return (
    <div className="tpl-pick">
      {groups.map((group) => {
        const ids = group.sections.map((s) => s.id)
        const allOn = ids.length > 0 && ids.every((id) => selected.has(id))
        const someOn = ids.some((id) => selected.has(id))
        return (
          <div className="tpl-pick-group" key={group.templateId}>
            <label className="pick-row tpl-pick-title">
              <input
                type="checkbox"
                checked={allOn}
                ref={(el) => {
                  if (el) el.indeterminate = someOn && !allOn
                }}
                onChange={() => toggleTemplate(group)}
              />
              <span>{group.templateName}</span>
            </label>
            <ul className="pick-list tpl-pick-sections">
              {group.sections.map((sec) => (
                <li key={sec.id}>
                  <label className="pick-row">
                    <input
                      type="checkbox"
                      checked={selected.has(sec.id)}
                      onChange={() => toggleSection(sec.id)}
                    />
                    <span>{sec.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

export function buildTemplateGroups(
  templates: { id: string; name: string }[],
  sections: Section[],
): TemplateGroup[] {
  return templates
    .map((t) => ({
      templateId: t.id,
      templateName: t.name,
      sections: sections
        .filter((s) => s.listId === t.id)
        .sort((a, b) => a.position - b.position),
    }))
    .filter((g) => g.sections.length > 0)
}
