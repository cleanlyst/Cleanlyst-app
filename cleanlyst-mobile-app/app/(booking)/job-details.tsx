import { View, Text, StyleSheet, TextInput } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import Button from "@/components/ui/Button";
import { useBooking } from "@/hooks/useBooking";

export default function JobDetailsScreen() {
  const router = useRouter();
  const { setDraft } = useBooking();
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const handleContinue = () => {
    setDraft({ address, notes });
    router.push("/(booking)/pricing");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Property</Text>
      <TextInput
        style={styles.input}
        placeholder="Address"
        value={address}
        onChangeText={setAddress}
      />
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Notes"
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      <Button title="Continue" onPress={handleContinue} disabled={!address} />
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
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: "top",
  },
});
