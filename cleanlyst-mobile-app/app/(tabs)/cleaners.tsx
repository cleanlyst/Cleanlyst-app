import { View, Text, FlatList, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import CleanerCard from "@/components/cleaner/CleanerCard";
import { Cleaner } from "@/types/cleaner";

const demoCleaners: Cleaner[] = [
  { id: "cleaner-1", name: "Maya", hourlyRate: 24, rating: 4.9 },
  { id: "cleaner-2", name: "Arjun", hourlyRate: 28, rating: 4.8 },
];

export default function CleanersScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Available cleaners</Text>
      <FlatList
        data={demoCleaners}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CleanerCard
            cleaner={item}
            onPress={() => router.push("/(booking)/service-select")}
          />
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 16,
  },
  list: {
    gap: 12,
  },
});
