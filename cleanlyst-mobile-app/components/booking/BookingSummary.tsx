import { View, Text, StyleSheet } from "react-native";
import { BookingDraft } from "@/features/bookings/types";
import { formatCents } from "@/utils/currency";

type BookingSummaryProps = {
  draft: BookingDraft;
  totalCents: number;
};

export default function BookingSummary({
  draft,
  totalCents,
}: BookingSummaryProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Summary</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Service</Text>
        <Text style={styles.value}>{draft.serviceId ?? "Not selected"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Address</Text>
        <Text style={styles.value}>{draft.address ?? "Not set"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Total</Text>
        <Text style={styles.value}>{formatCents(totalCents)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 18,
    padding: 18,
    backgroundColor: "#f8fafc",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  label: {
    color: "#475569",
  },
  value: {
    fontWeight: "600",
    color: "#111827",
  },
});
