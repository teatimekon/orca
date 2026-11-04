import { describe, expect, it } from 'vitest'
import { parseCmdJTaskSourceUrl } from './worktree-palette-task-url-match'

describe('parseCmdJTaskSourceUrl without Linear and Jira', () => {
  it.each(['https://acme.atlassian.net/browse/ENG-1', 'https://linear.app/acme/issue/ENG-1/title'])(
    'does not recognise %s as a task source URL',
    (url) => {
      expect(parseCmdJTaskSourceUrl(url)).toBeNull()
    }
  )
})
