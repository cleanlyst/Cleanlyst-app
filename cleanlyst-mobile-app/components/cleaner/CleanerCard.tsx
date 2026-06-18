import { View, Text, Pressable, StyleSheet } from "react-native";
import type { Cleaner } from "@/types/cleaner";

type CleanerCardProps = {
  cleaner: Cleaner;
  onPress: () => void;
};

export default function CleanerCard({ cleaner, onPress }: CleanerCardProps) {
  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View>
        <Text style={styles.name}>{cleaner.name}</Text>
        <Text style={styles.details}>
          {cleaner.rating.toFixed(1)} ★ · {cleaner.reviewCount} reviews
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  details: {
    color: "#6b7280",
    fontSize: 14,
  },
});
