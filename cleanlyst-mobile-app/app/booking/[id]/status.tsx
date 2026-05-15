import { View, Text, StyleSheet } from "react-native";
import { useSearchParams } from "expo-router";

export default function BookingStatusScreen() {
  const { id } = useSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Booking status</Text>
      <Text style={styles.body}>Tracking booking {id ?? "unknown"}.</Text>
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
