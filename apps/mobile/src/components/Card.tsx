import { View, type ViewProps } from "react-native";
import { useTheme } from "../theme/index.ts";

export function Card({ style, ...rest }: ViewProps) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: space(2),
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    />
  );
}
