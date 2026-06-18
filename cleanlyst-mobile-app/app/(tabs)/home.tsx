import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Button from "@/components/ui/Button";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cleanlyst Mobile</Text>
      <Text style={styles.subtitle}>
        Find cleaners, manage bookings, and track live status in one place.
      </Text>
      <Button
        title="Book Cleaner"
        onPress={() => router.push("/(tabs)/cleaners")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#4b5563",
    marginBottom: 24,
    lineHeight: 24,
  },
});
