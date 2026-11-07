import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { authHeaders, buildUrl } from '@/api/client';
import { projectsApi } from '@/api/endpoints/projects';
import { config } from '@/lib/config';

/** Download the project ZIP to the cache and hand it to the share sheet (§1.1). */
export async function shareProjectZip(projectId: string, name: string): Promise<void> {
  if (config.mockApi || Platform.OS === 'web') {
    throw new Error('ZIP download needs the live backend.');
  }
  const safe = name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 60) || 'project';
  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create({ intermediates: true });
  const target = new File(dir, `${safe}.zip`);
  if (target.exists) target.delete();
  const headers = await authHeaders({ guest: true });
  const file = await File.downloadFileAsync(buildUrl(projectsApi.downloadPath(projectId)), target, { headers, idempotent: true });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/zip', dialogTitle: `Share ${name}`, UTI: 'public.zip-archive' });
}
