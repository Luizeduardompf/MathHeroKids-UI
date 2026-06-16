// REQUIRED: expo-router/entry must be required (not used directly as main)
// Using "main": "expo-router/entry" directly crashes in EAS Update on Expo Go SDK 54.
// This wrapper fixes the issue.
require('expo-router/entry');
