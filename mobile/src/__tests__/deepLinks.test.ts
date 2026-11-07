import { parseDeepLink } from '@/lib/deepLinks';

const TOKEN = 'abcDEF123_-.~xyz';

describe('deep link parser', () => {
  it('parses universal links', () => {
    expect(parseDeepLink(`https://ideaplatform.app/verify-email?token=${TOKEN}`)).toEqual({ kind: 'verify-email', token: TOKEN });
    expect(parseDeepLink(`https://ideaplatform.app/reset-password?token=${TOKEN}`)).toEqual({ kind: 'reset-password', token: TOKEN });
    expect(parseDeepLink(`https://ideaplatform.app/team/accept?token=${TOKEN}`)).toEqual({ kind: 'team-accept', token: TOKEN });
  });

  it('parses the custom-scheme OAuth return with a one-time code', () => {
    expect(parseDeepLink(`ideaplatform://oauth?code=${TOKEN}&type=login`)).toEqual({ kind: 'oauth', code: TOKEN, type: 'login' });
    expect(parseDeepLink(`ideaplatform://oauth?code=${TOKEN}`)).toEqual({ kind: 'oauth', code: TOKEN, type: 'login' });
  });

  it('parses job and project links', () => {
    expect(parseDeepLink('ideaplatform://job/job_123')).toEqual({ kind: 'job', jobId: 'job_123' });
    expect(parseDeepLink('/project/p_9')).toEqual({ kind: 'project', projectId: 'p_9' });
  });

  it('rejects malformed or hostile params', () => {
    expect(parseDeepLink('https://ideaplatform.app/verify-email?token=short')).toEqual({ kind: 'unknown' });
    expect(parseDeepLink('https://ideaplatform.app/reset-password?token=<script>alert(1)</script>')).toEqual({ kind: 'unknown' });
    expect(parseDeepLink('ideaplatform://oauth?token=abc')).toEqual({ kind: 'unknown' }); // only `code` is accepted
    expect(parseDeepLink(`ideaplatform://oauth?code=${TOKEN}&type=../../etc`)).toEqual({ kind: 'unknown' });
    expect(parseDeepLink('ideaplatform://job/..%2F..%2Fsecret')).toEqual({ kind: 'unknown' });
    expect(parseDeepLink('ideaplatform://somewhere-else')).toEqual({ kind: 'unknown' });
  });
});
