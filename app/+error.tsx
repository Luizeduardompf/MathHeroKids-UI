import { useRouteError } from 'expo-router';
import { View, Text, ScrollView } from 'react-native';

export default function ErrorBoundary() {
  const error = useRouteError() as Error;
  return (
    <View style={{ flex: 1, backgroundColor: '#1a1a2e', padding: 20, paddingTop: 60 }}>
      <Text style={{ color: '#ff6b6b', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
        🚨 Route Error
      </Text>
      <ScrollView>
        <Text style={{ color: '#fff', fontSize: 13 }}>{String(error?.message ?? error)}</Text>
        <Text style={{ color: '#aaa', fontSize: 10, marginTop: 8 }}>{String(error?.stack ?? '')}</Text>
      </ScrollView>
    </View>
  );
}
