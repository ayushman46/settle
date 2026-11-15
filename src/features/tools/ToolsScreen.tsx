import { useMemo, useState } from 'react'
import { goBack, navigate } from '../../app/router'
import { Card, ListRow, PageTitle, Screen, SectionHeader, TextField, TopBar } from '../../components'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { NotesSheet } from '../notes/NotesSheet'
import { TOOL_SECTIONS, TOOLS, type ToolEntry, type ToolPlace, type ToolSection } from './registry'
import styles from './Tools.module.css'

const SECTION_KEYS: Record<ToolSection, MessageKey> = {
  settle: 'tools.section.settle',
  collect: 'tools.section.collect',
  home: 'tools.section.home',
  family: 'tools.section.family',
  out: 'tools.section.out',
  you: 'tools.section.you',
}

const PLACE_KEYS: Record<ToolPlace, MessageKey> = {
  group: 'tools.place.group',
  person: 'tools.place.person',
  expense: 'tools.place.expense',
  cash: 'tools.place.cash',
}

/**
 * `/app/tools` — everything Settle does, on one screen: grouped by what a person needs, with a
 * search that reads names and descriptions. A tool with its own page opens it; one that lives
 * inside a group, a person or an expense says so and opens the list to pick from.
 */
export function ToolsScreen() {
  const t = useT()
  const [query, setQuery] = useState('')
  const [notes, setNotes] = useState(false)
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)

  const found = useMemo(() => {
    if (words.length === 0) return TOOLS
    return TOOLS.filter((tool) => {
      const text = `${t(tool.title)} ${t(tool.body)} ${tool.id}`.toLowerCase()
      return words.every((word) => text.includes(word))
    })
    // `t` changes only with the language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, t])

  const open = (tool: ToolEntry): void => {
    if (tool.place === 'cash') setNotes(true)
    else navigate(tool.path)
  }

  const row = (tool: ToolEntry) => {
    const Icon = tool.icon
    return (
      <li key={tool.id}>
        <ListRow
          leading={
            <span className={styles.icon} aria-hidden="true">
              <Icon />
            </span>
          }
          title={t(tool.title)}
          subtitle={
            <>
              {t(tool.body)}
              {tool.place && <span className={styles.place}>{t(PLACE_KEYS[tool.place])}</span>}
            </>
          }
          onClick={() => open(tool)}
          chevron
        />
      </li>
    )
  }

  return (
    <Screen header={<TopBar onBack={() => goBack('/app')} />} contentClassName={styles.content}>
      <PageTitle title={t('tools.title')} subtitle={t('tools.subtitle')} />
      <TextField
        label={t('tools.search.label')}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder={t('tools.search.placeholder')}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
      />
      {words.length > 0 && (
        <p className={styles.count} role="status">
          {found.length === 0 ? t('tools.search.none') : t('tools.search.count', { count: found.length })}
        </p>
      )}
      {TOOL_SECTIONS.map((section) => {
        const list = found.filter((tool) => tool.section === section)
        if (list.length === 0) return null
        return (
          <section key={section} className={styles.section} aria-labelledby={`tools-${section}`}>
            <SectionHeader id={`tools-${section}`} title={t(SECTION_KEYS[section])} />
            <Card>
              <ul className={styles.list}>{list.map(row)}</ul>
            </Card>
          </section>
        )
      })}
      <NotesSheet amount={0} currency="INR" editable open={notes} onClose={() => setNotes(false)} />
    </Screen>
  )
}
