/**
 * QRCode component – thin wrapper around react-native-qrcode-svg so the
 * rest of the app can import it via the '@/components/QRCode' alias as a
 * named export, matching the usage in preview.tsx.
 */
import RNQRCode, { type QRCodeProps } from 'react-native-qrcode-svg';

export { type QRCodeProps };
export function QRCode(props: QRCodeProps) {
  return <RNQRCode {...props} />;
}

