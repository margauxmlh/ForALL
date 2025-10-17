import { StyleSheet, Text, View } from 'react-native';

export default function PlannerScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Planner screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 18,
    fontWeight: '600',
  },
});
