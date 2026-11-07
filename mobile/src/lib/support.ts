import { config } from './config';

/** Support mail link with app version + user id prefilled — never the email or tokens (§15). */
export function supportMailto(userId?: string) {
  const subject = encodeURIComponent('IDEA app support');
  const body = encodeURIComponent(`\n\n—\nApp ${config.appVersion} (${config.buildNumber}) · ${config.platform}\nUser ${userId ?? 'signed out'}`);
  return `mailto:${config.supportEmail}?subject=${subject}&body=${body}`;
}
