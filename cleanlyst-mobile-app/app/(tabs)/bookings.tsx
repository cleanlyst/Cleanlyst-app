import { View, Text, StyleSheet } from "react-native";

export default function BookingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bookings</Text>
      <Text style={styles.body}>
        Your active and past bookings will appear here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: "#4b5563",
  },
});
