import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Button from "@/components/ui/Button";
import { useBooking } from "@/hooks/useBooking";
import { formatCents } from "@/utils/currency";

export default function PricingScreen() {
  const router = useRouter();
  const { draft } = useBooking();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pricing</Text>
      <Text style={styles.body}>
        Review your estimated price before confirming the request.
      </Text>
      <View style={styles.summary}>
        <Text style={styles.sectionTitle}>Service</Text>
        <Text>{draft.serviceId ?? "Select a service"}</Text>
        <Text style={styles.sectionTitle}>Estimated total</Text>
        <Text style={styles.total}>{formatCents(4500)}</Text>
      </View>
      <Button
        title="Confirm request"
        onPress={() => router.push("/(booking)/confirm")}
      />
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
    marginBottom: 24,
  },
  summary: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 4,
  },
  total: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 8,
  },
});
