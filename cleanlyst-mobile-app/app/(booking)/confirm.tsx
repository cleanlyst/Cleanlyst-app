import { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import Button from "@/components/ui/Button";
import { useBooking } from "@/hooks/useBooking";
import { useAuthStore } from "@/features/auth/authStore";
import { createBookingRequest } from "@/features/bookings/bookingService";

export default function BookingConfirmScreen() {
  const router = useRouter();
  const { draft, resetDraft } = useBooking();
  const userId = useAuthStore((state) => state.user?.id);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!userId) {
      Alert.alert("Authentication required", "Please sign in before confirming a booking.");
      return;
    }

    setSaving(true);
    try {
      await createBookingRequest(userId, draft);
      resetDraft();
      router.replace("/(tabs)/bookings");
    } catch (error) {
      Alert.alert(
        "Booking failed",
        error instanceof Error ? error.message : "Unable to create booking request.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Confirm Booking</Text>
      <Text style={styles.body}>
        Review the final details before placing your booking.
      </Text>
      <View style={styles.summary}>
        <Text style={styles.sectionTitle}>Cleaner</Text>
        <Text>{draft.cleanerName ?? "Not selected"}</Text>
        <Text style={styles.sectionTitle}>Service</Text>
        <Text>{draft.serviceTitleSnapshot ?? "Not selected"}</Text>
        <Text style={styles.sectionTitle}>Location</Text>
        <Text>{draft.address ?? "Not set"}</Text>
        <Text style={styles.sectionTitle}>Notes</Text>
        <Text>{draft.notes ?? "None"}</Text>
      </View>
      <Button
        title={saving ? "Placing booking…" : "Confirm Booking"}
        onPress={handleConfirm}
        disabled={saving}
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
});
