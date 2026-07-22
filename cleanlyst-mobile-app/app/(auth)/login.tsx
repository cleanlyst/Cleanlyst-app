import { View, Text, StyleSheet, TextInput } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import Button from "@/components/ui/Button";
import { useAuthStore } from "@/features/auth/authStore";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const signIn = useAuthStore((state) => state.signIn);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace("/(tabs)/home");
    } catch {
      setError("Unable to sign in. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title={loading ? "Signing in…" : "Sign in"}
        onPress={handleSignIn}
        disabled={loading}
      />
      <Text style={styles.link} onPress={() => router.push("/(auth)/signup")}>
        Create an account
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  error: {
    color: "#b91c1c",
    marginBottom: 16,
  },
  link: {
    marginTop: 16,
    color: "#2563eb",
  },
});
