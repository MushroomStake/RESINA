import { Platform, StatusBar, Text, View } from "react-native";

type MobileSectionHeaderProps = {
  title: string;
  textVariant?: "light" | "dark";
};

const ANDROID_TOP_GAP = Math.max(StatusBar.currentHeight ?? 0, 0) * 0.15;

export function MobileSectionHeader({ title, textVariant = "dark" }: MobileSectionHeaderProps) {
  const isLightText = textVariant === "light";

  return (
    <View
      className="items-center pb-1.5"
      style={{ paddingTop: Platform.OS === "android" ? 8 + ANDROID_TOP_GAP : 8 }}
    >
      <Text
        className="text-center text-base font-bold tracking-[0.2px]"
        style={{
          color: isLightText ? "#edf4ff" : "#1f2937",
          textShadowColor: isLightText ? "rgba(5, 12, 24, 0.24)" : "transparent",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: isLightText ? 2 : 0,
        }}
      >
        {title}
      </Text>
    </View>
  );
}
