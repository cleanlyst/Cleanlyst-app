import { View, StyleSheet, Text } from "react-native";
import Button from "@/components/ui/Button";

type BookingCTAProps = {
  label: string;
  actionLabel: string;
  onAction: () => void;
  loading?: boolean;
};

export default function BookingCTA({
  label,
  actionLabel,
  onAction,
  loading = false,
}: BookingCTAProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Button
        title={loading ? "Working…" : actionLabel}
        onPress={onAction}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 12,
  },
  label: {
    color: "#475569",
    fontSize: 14,
  },
});
