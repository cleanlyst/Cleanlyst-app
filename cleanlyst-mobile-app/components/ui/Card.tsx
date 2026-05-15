import { View, StyleSheet, ViewStyle } from "react-native";
import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  style?: ViewStyle;
};

export default function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
});
