import { api } from '../client';
import type { ChatMessage, Checkpoint, Conversation, Project, ProjectSummary, Template } from '../types';

const B = '/api/platform/projects';

export type ProjectFilter = 'mine' | 'team' | 'public';

export const projectsApi = {
  list: (filter: ProjectFilter = 'mine') => api.get<ProjectSummary[]>(B, { query: { filter } }),
  get: (id: string) => api.get<Project>(`${B}/${id}`, { guest: true }),
  remove: (id: string) => api.del<{ deleted: boolean }>(`${B}/${id}`),
  downloadPath: (id: string) => `${B}/${id}/download`,
  setPublic: (id: string, isPublic: boolean) => api.patch<ProjectSummary>(`${B}/${id}/public`, { isPublic }),
  setTeamShared: (id: string, teamShared: boolean) => api.patch<ProjectSummary>(`${B}/${id}/team-shared`, { teamShared }),
  templates: () => api.get<Template[]>(`${B}/templates`),
  cloneTemplate: (templateId: string) => api.post<ProjectSummary>(`${B}/templates/${templateId}/clone`),

  // Conversation thread (guest-accessible)
  conversations: (projectId: string) => api.get<Conversation[]>(`${B}/${projectId}/conversations`, { guest: true }),
  createConversation: (projectId: string) =>
    api.post<Conversation>(`${B}/${projectId}/conversations`, {}, { guest: true }),
  messages: (projectId: string, conversationId: string, beforeSeq?: number) =>
    api.get<{ messages: ChatMessage[]; hasMore: boolean }>(
      `${B}/${projectId}/conversations/${conversationId}/messages`,
      { guest: true, query: { beforeSeq, limit: 50 } },
    ),
  postMessage: (projectId: string, conversationId: string, body: { content: string; mode?: string }) =>
    api.post<ChatMessage>(`${B}/${projectId}/conversations/${conversationId}/messages`, body, { guest: true }),
  checkpoints: (projectId: string) => api.get<Checkpoint[]>(`${B}/${projectId}/checkpoints`, { guest: true }),
  checkpoint: (projectId: string, checkpointId: string) =>
    api.get<Checkpoint>(`${B}/${projectId}/checkpoints/${checkpointId}`, { guest: true }),
  restoreCheckpoint: (projectId: string, checkpointId: string) =>
    api.post<{ checkpointId: string }>(`${B}/${projectId}/checkpoints/${checkpointId}/restore`, {}, { guest: true }),
};
