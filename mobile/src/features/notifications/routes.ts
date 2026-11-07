import { isValidId } from '@/lib/deepLinks';

/** Push payloads carry ids only (§6.5). */
export type PushData = { type?: string; jobId?: string; projectId?: string; buildId?: string; deploymentId?: string };

export function routeForPush(data: PushData): string | null {
  switch (data.type) {
    case 'job_complete':
    case 'job_partial':
    case 'job_failed':
      return isValidId(data.jobId) ? `/job/${data.jobId}` : null;
    case 'plan_ready':
      return isValidId(data.jobId) ? `/job/${data.jobId}/plan` : null;
    case 'build_finished':
      return isValidId(data.projectId) ? `/project/${data.projectId}/android-build` : null;
    case 'deploy_finished':
      return isValidId(data.projectId) ? `/project/${data.projectId}/deploy` : null;
    case 'team_invite':
      return '/team';
    default:
      if (isValidId(data.jobId)) return `/job/${data.jobId}`;
      if (isValidId(data.projectId)) return `/project/${data.projectId}`;
      return null;
  }
}
