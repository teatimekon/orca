import React from 'react'
import { Button } from '@/components/ui/button'
import { CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { translate } from '@/i18n/i18n'
import { getSmartWorkspaceEmptyHint } from '../../../../shared/new-workspace/smart-workspace-source-results'
import { RowIcon, RowLabel } from './smart-workspace-source-row-content'
import type { RowEntry } from './smart-workspace-name-field-model'
import type { WorkItemSourceSearch } from './use-work-item-source-search'

export function SmartWorkspaceSourceResultList({
  model,
  onSelect,
  isLinked,
  beforeResults,
  emptyHint,
  isRowDisabled,
  focusBehavior
}: {
  model: Pick<
    WorkItemSourceSearch,
    | 'mode'
    | 'mrStateFilters'
    | 'mrStateFilter'
    | 'setMrStateFilter'
    | 'typedTextActionRow'
    | 'loading'
    | 'searchResultRows'
  >
  onSelect: (row: RowEntry) => void
  isLinked?: (row: RowEntry) => boolean
  beforeResults?: React.ReactNode
  emptyHint?: string
  isRowDisabled?: (row: RowEntry) => boolean
  focusBehavior?: 'page'
}): React.JSX.Element {
  const {
    mode,
    mrStateFilters,
    mrStateFilter,
    setMrStateFilter,
    typedTextActionRow,
    loading,
    searchResultRows
  } = model
  return (
    <>
      {mode === 'gitlab' ? (
        <div
          className="flex shrink-0 items-center gap-1 border-b border-border/40 px-2 py-1.5"
          onMouseDown={(e) => e.preventDefault()}
        >
          {mrStateFilters.map(({ id, label }) => (
            <Button
              key={id}
              type="button"
              variant={mrStateFilter === id ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setMrStateFilter(id)}
            >
              {label}
            </Button>
          ))}
        </div>
      ) : null}
      <CommandList className="!max-h-none min-h-0 flex-1" data-focus-behavior={focusBehavior}>
        {beforeResults}
        {typedTextActionRow ? (
          <div
            className="sticky top-0 z-10 border-b border-border/40 bg-popover p-1"
            onMouseDown={(event) => event.preventDefault()}
          >
            <CommandItem
              selection="palette"
              key={typedTextActionRow.value}
              value={typedTextActionRow.value}
              onSelect={() => onSelect(typedTextActionRow)}
              density="workspace"
              emphasis={
                typedTextActionRow.kind === 'use-name' ||
                typedTextActionRow.kind === 'create-branch'
                  ? 'pinned'
                  : 'default'
              }
            >
              <RowIcon row={typedTextActionRow} />
              <RowLabel row={typedTextActionRow} />
            </CommandItem>
          </div>
        ) : null}
        {loading && searchResultRows.length === 0 ? (
          <div className="space-y-1 p-1">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-8 animate-pulse rounded bg-muted/40" />
            ))}
          </div>
        ) : searchResultRows.length === 0 && !typedTextActionRow ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {emptyHint ?? getSmartWorkspaceEmptyHint(mode)}
          </div>
        ) : searchResultRows.length > 0 ? (
          <CommandGroup>
            {searchResultRows.map((row) => (
              <CommandItem
                selection="palette"
                key={row.value}
                value={row.value}
                disabled={isLinked?.(row) || isRowDisabled?.(row)}
                onSelect={() => onSelect(row)}
                density="workspace"
              >
                <RowIcon row={row} />
                <RowLabel row={row} />
                {isLinked?.(row) ? (
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {translate('workspace.links.linkedResult', 'Linked')}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </>
  )
}
