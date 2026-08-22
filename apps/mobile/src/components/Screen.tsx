import { ScrollView, View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/index.ts";

interface ScreenProps extends ViewProps {
  /** Scrolls by default; pass false for full-bleed screens such as the camera. */
  scroll?: boolean;
  /** Skip the horizontal padding so a header band can run edge to edge. */
  flush?: boolean;
}

/** Themed page background with safe-area insets; the root of every route. */
export function Screen({ scroll = true, flush = false, style, children, ...rest }: ScreenProps) {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top,
    paddingBottom: insets.bottom + space(3),
    paddingHorizontal: flush ? 0 : space(2),
  };
  if (!scroll) {
    return (
      <View {...rest} style={[{ flex: 1, backgroundColor: colors.background }, padding, style]}>
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[padding, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Stack({ gap = 2, style, ...rest }: ViewProps & { gap?: number }) {
  const { space } = useTheme();
  return <View {...rest} style={[{ gap: space(gap) }, style]} />;
}
