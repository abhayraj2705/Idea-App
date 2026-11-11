import { itemOf, listOf, toProject, toTemplate } from '../adapters';
import { api } from '../client';
import type { ChatMessage, Checkpoint, Conversation, Project, ProjectSummary, Template } from '../types';

const B = '/api/platform/projects';

export type ProjectFilter = 'mine' | 'team' | 'public';

export const projectsApi = {
  /**
   * The server returns one list (your projects + team-shared ones); the tabs are
   * filtered here. `me` is the signed-in user's id.
   */
  list: (filter: ProjectFilter = 'mine', me?: string): Promise<ProjectSummary[]> =>
    api.get<unknown>(B).then((d) => {
      const all = listOf<unknown>(d, 'projects').map(toProject);
      if (filter === 'public') return all.filter((p) => p.isPublic);
      if (filter === 'team') return all.filter((p) => p.teamShared && (!me || p.ownerId !== me));
      return all.filter((p) => !me || !p.ownerId || p.ownerId === me);
    }),
  get: (id: string): Promise<Project> => api.get<unknown>(`${B}/${id}`, { guest: true }).then(toProject),
  remove: (id: string) => api.del<{ deleted: boolean }>(`${B}/${id}`),
  downloadPath: (id: string) => `${B}/${id}/download`,
  setPublic: (id: string, isPublic: boolean) => api.patch<ProjectSummary>(`${B}/${id}/public`, { isPublic }),
  setTeamShared: (id: string, teamShared: boolean) => api.patch<ProjectSummary>(`${B}/${id}/team-shared`, { teamShared }),
  templates: (): Promise<Template[]> =>
    api.get<unknown>(`${B}/templates`).then((d) => listOf<Record<string, unknown>>(d, 'templates').map(toTemplate)),
  cloneTemplate: (templateId: string) => api.post<ProjectSummary>(`${B}/templates/${templateId}/clone`),

  // Conversation thread (guest-accessible)
  conversations: (projectId: string) =>
    api.get<unknown>(`${B}/${projectId}/conversations`, { guest: true }).then((d) => listOf<Conversation>(d, 'conversations')),
  createConversation: (projectId: string) =>
    api.post<unknown>(`${B}/${projectId}/conversations`, {}, { guest: true }).then((d) => itemOf<Conversation>(d, 'conversation')),
  /**
   * The server pages forwards (`afterSeq`), oldest first, so the thread is read
   * in one request (newest messages included); there are no older pages to load.
   */
  messages: (projectId: string, conversationId: string, _beforeSeq?: number) =>
    api
      .get<unknown>(`${B}/${projectId}/conversations/${conversationId}/messages`, { guest: true, query: { limit: 500 } })
      .then((d) => ({ messages: listOf<ChatMessage>(d, 'messages'), hasMore: false })),
  postMessage: (projectId: string, conversationId: string, body: { content: string; mode?: string }) =>
    api.post<ChatMessage>(`${B}/${projectId}/conversations/${conversationId}/messages`, body, { guest: true }),
  checkpoints: (projectId: string) =>
    api.get<unknown>(`${B}/${projectId}/checkpoints`, { guest: true }).then((d) => listOf<Checkpoint>(d, 'checkpoints')),
  checkpoint: (projectId: string, checkpointId: string) =>
    api.get<Checkpoint>(`${B}/${projectId}/checkpoints/${checkpointId}`, { guest: true }),
  restoreCheckpoint: (projectId: string, checkpointId: string) =>
    api.post<{ checkpointId: string }>(`${B}/${projectId}/checkpoints/${checkpointId}/restore`, {}, { guest: true }),
};
