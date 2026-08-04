import { Platform } from 'react-native';
import type { ClientEnv } from '@cura/shared';

/**
 * Client environment for the mobile app.
 *
 * Under Expo, `EXPO_PUBLIC_*` variables were inlined at build time. Bare React
 * Native has no such mechanism — Metro only substitutes `process.env.NODE_ENV`,
 * so any other `process.env` read is simply `undefined` at runtime. Rather than
 * leave a silently-dead lookup in the code, the defaults live here explicitly.
 *
 * To point a build at a real API, either edit `PRODUCTION_API` below or add
 * `react-native-config` and read from it — both are a change to this one file.
 */

/** Android emulators reach the host machine on 10.0.2.2, not localhost. */
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

const DEV_API = `http://${DEV_HOST}:3000/api`;
const DEV_WS = `ws://${DEV_HOST}:3000`;

const PRODUCTION_API = 'https://api.cura.health/api';
const PRODUCTION_WS = 'wss://api.cura.health';

export function readEnv(): ClientEnv {
  const environment: ClientEnv['environment'] = __DEV__ ? 'development' : 'production';

  const env: ClientEnv = {
    apiBaseUrl: __DEV__ ? DEV_API : PRODUCTION_API,
    wsBaseUrl: __DEV__ ? DEV_WS : PRODUCTION_WS,
    environment,
  };

  // Clinical traffic must not leave the device in clear text.
  if (!__DEV__ && !env.apiBaseUrl.startsWith('https://')) {
    throw new Error('Release builds must use an https API base URL');
  }

  return env;
}
