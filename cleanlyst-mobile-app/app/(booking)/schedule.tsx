import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Button from "@/components/ui/Button";
import { useBooking } from "@/hooks/useBooking";

export default function ScheduleScreen() {
  const router = useRouter();
  const setDraft = useBooking((state) => state.setDraft);

  const handleContinue = () => {
    setDraft({ date: new Date().toISOString() });
    router.push("/(booking)/job-details");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pick a time</Text>
      <Text style={styles.body}>
        In a real build this screen would show available slots from the cleaner.
      </Text>
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
});
