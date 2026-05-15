import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useBooking } from "@/hooks/useBooking";

const services = [
  {
    id: "home_clean",
    title: "Home clean",
    description: "Standard 2-hour clean",
    duration: 120,
    priceCents: 4500,
  },
  {
    id: "deep_clean",
    title: "Deep clean",
    description: "Deep clean for kitchens and bathrooms",
    duration: 180,
    priceCents: 6800,
  },
];

export default function ServiceSelectScreen() {
  const router = useRouter();
  const setDraft = useBooking((state) => state.setDraft);

  const handleSelect = (service: {
    id: string;
    title: string;
    duration: number;
  }) => {
    setDraft({ serviceId: service.id, duration: service.duration });
    router.push("/(booking)/schedule");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select service</Text>
      {services.map((service) => (
        <Card key={service.id} style={styles.card}>
          <Text style={styles.serviceTitle}>{service.title}</Text>
          <Text style={styles.description}>{service.description}</Text>
          <Button title="Choose" onPress={() => handleSelect(service)} />
        </Card>
      ))}
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
  card: {
    marginBottom: 16,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 12,
  },
});
