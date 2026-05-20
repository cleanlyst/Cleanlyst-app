import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Button from "@/components/ui/Button";
import { useBooking } from "@/hooks/useBooking";
import { formatCents } from "@/utils/currency";

export default function PricingScreen() {
  const router = useRouter();
  const { draft } = useBooking();

  const totalCents = draft.quoteCents ?? 0;
  const serviceTitle = draft.serviceTitleSnapshot ?? "Selected service";
  const date = draft.scheduledStart ?? draft.date ?? "Not scheduled";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Review pricing</Text>
      <Text style={styles.body}>Confirm the booking details before sending your request.</Text>
      <View style={styles.summary}>
        <Text style={styles.sectionTitle}>Cleaner</Text>
        <Text>{draft.cleanerName ?? "Cleaner selected"}</Text>
        <Text style={styles.sectionTitle}>Service</Text>
        <Text>{serviceTitle}</Text>
        <Text style={styles.sectionTitle}>Date</Text>
        <Text>{date}</Text>
        <Text style={styles.sectionTitle}>Total</Text>
        <Text style={styles.total}>{formatCents(totalCents)}</Text>
      </View>
      <Button title="Continue to confirmation" onPress={() => router.push("/(booking)/confirm")} />
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
