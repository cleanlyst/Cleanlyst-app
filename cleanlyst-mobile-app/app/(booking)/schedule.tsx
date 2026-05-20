import { useState } from "react";
import { View, Text, StyleSheet, TextInput } from "react-native";
import { useRouter } from "expo-router";
import Button from "@/components/ui/Button";
import { useBooking } from "@/hooks/useBooking";

export default function ScheduleScreen() {
  const router = useRouter();
  const draft = useBooking((state) => state.draft);
  const setDraft = useBooking((state) => state.setDraft);

  const defaultDate = new Date().toISOString().slice(0, 10);
  const [bookingDate, setBookingDate] = useState(defaultDate);
  const [bookingTime, setBookingTime] = useState("10:00");

  const handleContinue = () => {
    const dateTime = new Date(`${bookingDate}T${bookingTime}:00`);
    if (Number.isNaN(dateTime.getTime())) return;

    const scheduledStart = dateTime.toISOString();
    const durationMinutes = draft.duration ?? 60;
    const scheduledEnd = new Date(dateTime.getTime() + durationMinutes * 60000).toISOString();

    setDraft({ date: scheduledStart, scheduledStart, scheduledEnd });
    router.push("/(booking)/job-details");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Schedule</Text>
      <Text style={styles.body}>Choose your preferred booking date and start time.</Text>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          value={bookingDate}
          placeholder="YYYY-MM-DD"
          onChangeText={setBookingDate}
        />
      </View>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Start time</Text>
        <TextInput style={styles.input} value={bookingTime} onChangeText={setBookingTime} />
      </View>
      <Button title="Continue" onPress={handleContinue} />
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
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#f8fafc",
  },
});
