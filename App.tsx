import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Food Log</Text>
        <Text style={styles.date}>{today}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Calories today</Text>
        <Text style={styles.cardValue}>0</Text>
        <View style={styles.macros}>
          <Macro label="Protein" />
          <Macro label="Carbs" />
          <Macro label="Fat" />
        </View>
      </View>

      <View style={styles.empty}>
        <Text style={styles.emptyText}>No meals logged yet.</Text>
        <Text style={styles.emptyHint}>Meal logging is coming in the next step.</Text>
      </View>

      <StatusBar style="dark" />
    </View>
  );
}

function Macro({ label }: { label: string }) {
  return (
    <View style={styles.macro}>
      <Text style={styles.macroValue}>0 g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F7F4',
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2A1F',
  },
  date: {
    fontSize: 16,
    color: '#6B7568',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardLabel: {
    fontSize: 14,
    color: '#6B7568',
  },
  cardValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#2E7D32',
    marginVertical: 4,
  },
  macros: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  macro: {
    alignItems: 'center',
    flex: 1,
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2A1F',
  },
  macroLabel: {
    fontSize: 13,
    color: '#6B7568',
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    marginTop: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#1F2A1F',
  },
  emptyHint: {
    fontSize: 14,
    color: '#6B7568',
    marginTop: 6,
  },
});
