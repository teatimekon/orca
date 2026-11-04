import { defineMethod } from '../core'
import { pureUnavailable } from './pure-unavailable'
import {
  AgentIssueContext,
  AgentSearchIssues,
  LinearCommentDelete,
  LinearCommentEdit,
  LinearCurrentContext,
  LinearIssueAddComment,
  LinearIssueAttachLink,
  LinearIssueCreate,
  LinearIssueList,
  LinearIssueRelationWrite,
  LinearIssueSetState,
  LinearIssueUpdateTask,
  LinearProjectList,
  LinearSaveIssue,
  LinearTeamLookup,
  LinearWorkspaceRead
} from '../../../../shared/rpc-contract/linear-agent-access-params'

export const LINEAR_AGENT_ACCESS_METHODS = [
  defineMethod({
    name: 'linear.saveIssue',
    permission: 'workspace',
    params: LinearSaveIssue,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.agentSearchIssues',
    permission: 'workspace',
    params: AgentSearchIssues,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.issueContext',
    permission: 'workspace',
    params: AgentIssueContext,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.agentTeamList',
    permission: 'workspace',
    params: LinearWorkspaceRead,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.agentTeamMembers',
    permission: 'workspace',
    params: LinearTeamLookup,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.agentTeamStates',
    permission: 'workspace',
    params: LinearTeamLookup,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.agentTeamLabels',
    permission: 'workspace',
    params: LinearTeamLookup,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.agentIssueList',
    permission: 'workspace',
    params: LinearIssueList,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.agentProjectList',
    permission: 'workspace',
    params: LinearProjectList,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.resolveCurrentIssue',
    permission: 'workspace',
    params: LinearCurrentContext,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.issueSetState',
    permission: 'workspace',
    params: LinearIssueSetState,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.issueUpdateTask',
    permission: 'workspace',
    params: LinearIssueUpdateTask,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.issueRelationWrite',
    permission: 'workspace',
    params: LinearIssueRelationWrite,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.issueAddComment',
    permission: 'workspace',
    params: LinearIssueAddComment,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.commentEdit',
    permission: 'workspace',
    params: LinearCommentEdit,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.commentDelete',
    permission: 'workspace',
    params: LinearCommentDelete,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.issueAttachLink',
    permission: 'workspace',
    params: LinearIssueAttachLink,
    handler: async () => pureUnavailable()
  }),
  defineMethod({
    name: 'linear.issueCreate',
    permission: 'workspace',
    params: LinearIssueCreate,
    handler: async () => pureUnavailable()
  })
]
