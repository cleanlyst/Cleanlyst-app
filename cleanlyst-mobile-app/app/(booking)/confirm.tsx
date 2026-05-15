import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Button from "@/components/ui/Button";
import { useBooking } from "@/hooks/useBooking";

export default function BookingConfirmScreen() {
  const router = useRouter();
  const { draft, resetDraft } = useBooking();

  const handleConfirm = () => {
    resetDraft();
    router.replace("/booking/booking-id/status");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Confirm booking</Text>
      <Text style={styles.body}>
        You will only create the booking request after tapping confirm.
      </Text>
      <View style={styles.summary}>
        <Text style={styles.sectionTitle}>Address</Text>
        <Text>{draft.address ?? "Not set"}</Text>
        <Text style={styles.sectionTitle}>Notes</Text>
        <Text>{draft.notes ?? "None"}</Text>
      </View>
      <Button title="Confirm request" onPress={handleConfirm} />
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
});
