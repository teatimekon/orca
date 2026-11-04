import { defineMethod } from '../core'
import { pureUnavailable } from './pure-unavailable'
import { ListIssues, McpListIssues } from '../../../../shared/rpc-contract/linear-issue-list-params'
import { CreateProject } from '../../../../shared/rpc-contract/linear-project-create-params'
import {
  Connect,
  CreateIssue,
  CustomViewContents,
  CustomViewId,
  IssueComment,
  IssueId,
  IssueUpdate,
  LinearIssueCommentsParams,
  ListCustomViews,
  ListProjects,
  ProjectId,
  ProjectIssues,
  SearchIssues,
  SelectWorkspace,
  TeamId,
  WorkspaceSelection
} from '../../../../shared/rpc-contract/linear-params'

export const LINEAR_METHODS = [
  defineMethod({
    name: 'linear.connect',
    permission: 'accounts-admin',
    params: Connect,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.disconnect',
    permission: 'accounts-admin',
    params: WorkspaceSelection,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.selectWorkspace',
    permission: 'accounts-admin',
    params: SelectWorkspace,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.status',
    permission: 'workspace',
    params: null,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.testConnection',
    permission: 'workspace',
    params: WorkspaceSelection,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.searchIssues',
    permission: 'workspace',
    params: SearchIssues,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.listIssues',
    permission: 'workspace',
    params: ListIssues,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.mcpListIssues',
    permission: 'workspace',
    params: McpListIssues,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.createIssue',
    permission: 'workspace',
    params: CreateIssue,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.getIssue',
    permission: 'workspace',
    params: IssueId,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.updateIssue',
    permission: 'workspace',
    params: IssueUpdate,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.addIssueComment',
    permission: 'workspace',
    params: IssueComment,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.issueComments',
    permission: 'workspace',
    params: LinearIssueCommentsParams,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.listTeams',
    permission: 'workspace',
    params: WorkspaceSelection,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.listProjects',
    permission: 'workspace',
    params: ListProjects,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.createProject',
    permission: 'workspace',
    params: CreateProject,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.getProject',
    permission: 'workspace',
    params: ProjectId,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.listProjectIssues',
    permission: 'workspace',
    params: ProjectIssues,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.listCustomViews',
    permission: 'workspace',
    params: ListCustomViews,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.getCustomView',
    permission: 'workspace',
    params: CustomViewId,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.listCustomViewIssues',
    permission: 'workspace',
    params: CustomViewContents,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.listCustomViewProjects',
    permission: 'workspace',
    params: CustomViewContents,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.teamStates',
    permission: 'workspace',
    params: TeamId,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.teamLabels',
    permission: 'workspace',
    params: TeamId,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.teamMembers',
    permission: 'workspace',
    params: TeamId,
    handler: async () => pureUnavailable()
  })
]
