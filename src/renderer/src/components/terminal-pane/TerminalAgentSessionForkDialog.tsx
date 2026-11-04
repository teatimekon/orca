import { Copy, FileText, GitFork } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  copyAgentSessionForkContext,
  startAgentSessionFork,
  type PreparedAgentSessionFork
} from './terminal-agent-session-fork'
import { translate } from '@/i18n/i18n'
import { slugifyForWorkspaceName } from '../../../../shared/workspace-name'
import { getAgentForkArgv } from '../../../../shared/agent-resume-argv'

type TerminalAgentSessionForkDialogProps = {
  open: boolean
  fork: PreparedAgentSessionFork | null
  onOpenChange: (open: boolean) => void
}

type ForkForm = {
  fork: PreparedAgentSessionFork | null
  workspaceName: string
  firstMessage: string
}

function initialForm(fork: PreparedAgentSessionFork | null): ForkForm {
  return { fork, workspaceName: fork?.defaultWorkspaceName ?? '', firstMessage: '' }
}

/** The command the fork runs, for the dialog's explanation of what "continue" means. */
function describeForkResumeCommand(fork: PreparedAgentSessionFork): string | null {
  return fork.resume
    ? (getAgentForkArgv(fork.resume.agent, fork.resume.providerSession)?.join(' ') ?? null)
    : null
}

export function TerminalAgentSessionForkDialog({
  open,
  fork,
  onOpenChange
}: TerminalAgentSessionForkDialogProps): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [form, setForm] = useState<ForkForm>(() => initialForm(fork))
  // Each prepared fork starts a fresh form; adjusting during render avoids a stale-name frame.
  if (form.fork !== fork) {
    setForm(initialForm(fork))
  }
  const nameInputId = useId()
  const firstMessageId = useId()
  const resumeCommand = fork ? describeForkResumeCommand(fork) : null
  const workspaceSlug = slugifyForWorkspaceName(form.workspaceName)

  const handleCopyContext = async (): Promise<void> => {
    if (!fork || busyRef.current) {
      return
    }
    busyRef.current = true
    setBusy(true)
    try {
      if (await copyAgentSessionForkContext(fork)) {
        onOpenChange(false)
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const handleStartFork = async (): Promise<void> => {
    if (!fork || busyRef.current || !workspaceSlug) {
      return
    }
    busyRef.current = true
    setBusy(true)
    try {
      if (
        await startAgentSessionFork(fork, {
          workspaceName: form.workspaceName,
          firstMessage: form.firstMessage
        })
      ) {
        onOpenChange(false)
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean): void => {
    if (busyRef.current && !nextOpen) {
      return
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {translate(
              'auto.components.terminal.pane.TerminalAgentSessionForkDialog.64e292e8e3',
              'Fork Agent Session'
            )}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'components.terminalAgentSessionFork.description',
              'Create a child workspace from this branch and continue the agent conversation there.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor={nameInputId}>
            {translate('components.terminalAgentSessionFork.workspaceNameLabel', 'Workspace name')}
          </Label>
          <Input
            id={nameInputId}
            value={form.workspaceName}
            autoFocus
            spellCheck={false}
            disabled={busy}
            onChange={(event) => setForm({ ...form, workspaceName: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault()
                void handleStartFork()
              }
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={firstMessageId}>
            {translate(
              'components.terminalAgentSessionFork.firstMessageLabel',
              'First message (optional)'
            )}
          </Label>
          <Textarea
            id={firstMessageId}
            value={form.firstMessage}
            rows={3}
            disabled={busy}
            placeholder={translate(
              'components.terminalAgentSessionFork.firstMessagePlaceholder',
              'Sent once the new agent is ready. Leave empty to type it yourself.'
            )}
            onChange={(event) => setForm({ ...form, firstMessage: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                void handleStartFork()
              }
            }}
          />
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-3">
          {resumeCommand ? (
            <GitFork className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ) : (
            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium">
              {resumeCommand
                ? translate(
                    'components.terminalAgentSessionFork.resumeTitle',
                    'Continue this conversation'
                  )
                : translate(
                    'components.terminalAgentSessionFork.contextTitle',
                    'Captured context only'
                  )}
            </p>
            <p className="text-xs text-muted-foreground break-words">
              {resumeCommand
                ? translate(
                    'components.terminalAgentSessionFork.resumeBody',
                    'The new agent reopens this conversation as a copy with its full history: {{command}}',
                    { command: resumeCommand }
                  )
                : translate(
                    'components.terminalAgentSessionFork.contextBody',
                    'No reopenable conversation for this pane (no session ID yet, or the agent cannot fork one). The new agent receives a bounded transcript as an editable draft instead.'
                  )}
            </p>
            <p className="text-xs text-muted-foreground">
              {translate(
                'components.terminalAgentSessionFork.uncommittedHint',
                'Uncommitted changes stay in the current workspace.'
              )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => void handleCopyContext()}>
            <Copy className="size-4" />
            {translate(
              'auto.components.terminal.pane.TerminalAgentSessionForkDialog.17fc841e59',
              'Copy context'
            )}
          </Button>
          <Button disabled={busy || !workspaceSlug} onClick={() => void handleStartFork()}>
            <GitFork className="size-4" />
            {busy
              ? translate(
                  'auto.components.terminal.pane.TerminalAgentSessionForkDialog.2b10412cfc',
                  'Creating...'
                )
              : translate(
                  'auto.components.terminal.pane.TerminalAgentSessionForkDialog.9d25de2920',
                  'Create fork'
                )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
