import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import type { ReactNode } from "react";

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: ReactNode;
};

export default function Button({
  title,
  onPress,
  disabled = false,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled ? styles.pressed : null,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon}
      <Text style={[styles.text, disabled && styles.textDisabled, textStyle]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    backgroundColor: "#9ca3af",
  },
  text: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  textDisabled: {
    color: "#e5e7eb",
  },
});
