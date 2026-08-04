/**
 * React Native CLI entry point.
 *
 * The component name registered here must match the one the native projects
 * launch: `AppDelegate.swift` (iOS) and `MainActivity.kt` (Android) both read
 * it from app.json, so all three stay in step through that one file.
 */
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
