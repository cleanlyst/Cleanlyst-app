import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useBooking } from "@/hooks/useBooking";
import { getCleanerPublicProfile, getCleanerServices } from "@/features/cleaners/cleanerService";
import type { CleanerServiceOption } from "@/features/cleaners/cleanerService";

export default function ServiceSelectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ cleanerId?: string }>();
  const cleanerId = typeof params.cleanerId === "string" ? params.cleanerId : undefined;
  const { setDraft } = useBooking();

  const [cleanerName, setCleanerName] = useState<string | null>(null);
  const [services, setServices] = useState<CleanerServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!cleanerId) {
        router.replace("/(tabs)/cleaners");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const cleaner = await getCleanerPublicProfile(cleanerId);
        if (!cleaner) {
          setError("Cleaner not found.");
          return;
        }
        setCleanerName(cleaner.name);

        const items = await getCleanerServices(cleanerId);
        setServices(items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load cleaner services.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [cleanerId, router]);

  const handleSelect = (service: CleanerServiceOption) => {
    setDraft({
      cleanerId,
      cleanerName,
      serviceId: service.id,
      serviceTitleSnapshot: service.title,
      serviceCategorySnapshot: service.category,
      serviceDescriptionSnapshot: service.description ?? null,
      quoteCents: service.base_price_cents,
      cleanerPayoutCents: service.base_price_cents,
      currency: "GBP",
      duration: service.duration_minutes,
    });
    router.push("/(booking)/schedule");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Service</Text>
      <Text style={styles.subtitle}>
        {cleanerName ? `Booking with ${cleanerName}` : "Select a cleaner to continue."}
      </Text>
      {loading ? (
        <Text style={styles.statusText}>Loading services…</Text>
      ) : error ? (
        <Text style={[styles.statusText, styles.errorText]}>{error}</Text>
      ) : services.length === 0 ? (
        <Text style={styles.statusText}>This cleaner has no MVP services available.</Text>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <Text style={styles.serviceTitle}>{item.title}</Text>
              <Text style={styles.description}>{item.category}</Text>
              <Text style={styles.description}>{item.description ?? "Standard cleaning service."}</Text>
              <Text style={styles.price}>£{(item.base_price_cents / 100).toFixed(2)}</Text>
              <Button title="Select" onPress={() => handleSelect(item)} />
            </Card>
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
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "#6b7280",
    marginBottom: 18,
    fontSize: 15,
  },
  statusText: {
    color: "#6b7280",
    fontSize: 15,
    marginTop: 12,
  },
  errorText: {
    color: "#dc2626",
  },
  list: {
    gap: 16,
  },
  card: {
    padding: 18,
    borderRadius: 18,
    marginBottom: 14,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
});
