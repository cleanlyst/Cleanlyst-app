import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, TextInput, Pressable } from "react-native";
import { useRouter } from "expo-router";
import CleanerCard from "@/components/cleaner/CleanerCard";
import { searchCleaners } from "@/features/cleaners/cleanerService";
import type { Cleaner } from "@/types/cleaner";

export default function CleanersScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCleaners(search = "") {
    setLoading(true);
    setError(null);
    try {
      const results = await searchCleaners(search);
      setCleaners(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load cleaners.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCleaners();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Book Cleaner</Text>
      <Text style={styles.subtitle}>Choose an approved cleaner for your MVP cleaning service.</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by cleaner or business"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          onSubmitEditing={() => loadCleaners(query)}
        />
        <Pressable style={styles.searchButton} onPress={() => loadCleaners(query)}>
          <Text style={styles.searchButtonText}>Search</Text>
        </Pressable>
      </View>
      {loading ? (
        <Text style={styles.statusText}>Loading cleaners…</Text>
      ) : error ? (
        <Text style={[styles.statusText, styles.errorText]}>{error}</Text>
      ) : cleaners.length === 0 ? (
        <Text style={styles.statusText}>No cleaners found. Try a different search term.</Text>
      ) : (
        <FlatList
          data={cleaners}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CleanerCard
              cleaner={item}
              onPress={() =>
                router.push(`/(booking)/service-select?cleanerId=${encodeURIComponent(item.id)}`)
              }
            />
          )}
          contentContainerStyle={styles.list}
        />
      )}
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
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    color: "#6b7280",
    marginBottom: 18,
    fontSize: 15,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 10,
    backgroundColor: "#f8fafc",
  },
  searchButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#2563eb",
  },
  searchButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  statusText: {
    color: "#6b7280",
    marginTop: 12,
    fontSize: 15,
  },
  errorText: {
    color: "#dc2626",
  },
  list: {
    gap: 12,
  },
});
