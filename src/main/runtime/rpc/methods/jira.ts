import { defineMethod, defineStreamingMethod } from '../core'
import { pureUnavailable, pureUnavailableStream } from './pure-unavailable'
import { JiraFavouriteFilterParams } from '../../../../shared/rpc-contract/jira-favourite-filter-params'
import {
  AssignableUsers,
  AttachmentImage,
  GenerateIssueSummary,
  CancelGenerateIssueSummary,
  Connect,
  CreateIssue,
  IssueComment,
  IssueKey,
  IssueUpdate,
  ListIssues,
  ProjectIssueTypeFields,
  ProjectIssueTypes,
  ProjectStatusOrder,
  SearchIssues,
  SelectSite,
  SiteSelection,
  UserSearch
} from '../../../../shared/rpc-contract/jira-params'

export const JIRA_METHODS = [
  defineStreamingMethod({
    name: 'jira.attachmentImage',
    permission: 'workspace',
    params: AttachmentImage,
    handler: pureUnavailableStream
  }),
  defineMethod({
    name: 'jira.generateIssueSummary',
    permission: 'workspace',
    params: GenerateIssueSummary,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.cancelGenerateIssueSummary',
    permission: 'workspace',
    params: CancelGenerateIssueSummary,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.connect',
    permission: 'accounts-admin',
    params: Connect,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.disconnect',
    permission: 'accounts-admin',
    params: SiteSelection,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.selectSite',
    permission: 'accounts-admin',
    params: SelectSite,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.status',
    permission: 'workspace',
    params: null,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.readStatus',
    permission: 'workspace',
    params: null,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.testConnection',
    permission: 'workspace',
    params: SiteSelection,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.searchIssues',
    permission: 'workspace',
    params: SearchIssues,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.listIssues',
    permission: 'workspace',
    params: ListIssues,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.getIssue',
    permission: 'workspace',
    params: IssueKey,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.lookupIssueSummary',
    permission: 'workspace',
    params: IssueKey,
    handler: async () => pureUnavailable()
  }),
  defineStreamingMethod({
    name: 'jira.getIssueStream',
    permission: 'workspace',
    params: IssueKey,
    handler: pureUnavailableStream
  }),
  defineMethod({
    name: 'jira.createIssue',
    permission: 'workspace',
    params: CreateIssue,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.updateIssue',
    permission: 'workspace',
    params: IssueUpdate,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.addIssueComment',
    permission: 'workspace',
    params: IssueComment,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.issueComments',
    permission: 'workspace',
    params: IssueKey,
    handler: async () => pureUnavailable()
  }),
  defineStreamingMethod({
    name: 'jira.issueCommentsStream',
    permission: 'workspace',
    params: IssueKey,
    handler: pureUnavailableStream
  }),
  defineMethod({
    name: 'jira.listFavouriteFilters',
    permission: 'workspace',
    params: JiraFavouriteFilterParams,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.listProjects',
    permission: 'workspace',
    params: SiteSelection,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.listIssueTypes',
    permission: 'workspace',
    params: ProjectIssueTypes,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.listCreateFields',
    permission: 'workspace',
    params: ProjectIssueTypeFields,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.listPriorities',
    permission: 'workspace',
    params: SiteSelection,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.listAssignableUsers',
    permission: 'workspace',
    params: AssignableUsers,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.searchUsers',
    permission: 'workspace',
    params: UserSearch,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.listTransitions',
    permission: 'workspace',
    params: IssueKey,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'jira.getProjectStatusOrder',
    permission: 'workspace',
    params: ProjectStatusOrder,
    handler: async () => pureUnavailable()
  })
]
