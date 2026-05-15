import { View, ActivityIndicator, StyleSheet, Text } from "react-native";

type LoaderProps = {
  message?: string;
};

export default function Loader({ message = "Loading…" }: LoaderProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  message: {
    marginTop: 12,
    fontSize: 16,
    color: "#4b5563",
  },
});
