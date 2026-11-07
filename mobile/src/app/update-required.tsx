import * as Application from 'expo-application';
import { Linking, Platform } from 'react-native';
import { Button } from 'react-native-paper';

import { Screen } from '@/components/Screen';
import { EmptyView } from '@/components/StateViews';

const STORE_URL = Platform.select({
  ios: 'itms-apps://apps.apple.com/app/id0000000000', // set after App Store Connect creates the app record
  default: `market://details?id=${Application.applicationId ?? 'com.ideaplatform.app'}`,
});

/** Blocking screen when below app-config.minSupportedVersion (§6.6). */
export default function UpdateRequired() {
  return (
    <Screen edges={['top', 'bottom']} scroll={false}>
      <EmptyView
        icon="cellphone-arrow-down"
        title="Update required"
        body="This version of IDEA is no longer supported. Please update to keep building."
        action={
          <Button mode="contained" icon="open-in-new" onPress={() => Linking.openURL(STORE_URL!)}>
            Update now
          </Button>
        }
      />
    </Screen>
  );
}
