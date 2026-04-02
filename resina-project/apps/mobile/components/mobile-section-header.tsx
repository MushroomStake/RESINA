import { Platform, StatusBar, Text, View } from "react-native";

type MobileSectionHeaderProps = {
  title: string;
};

const ANDROID_TOP_GAP = Math.max(StatusBar.currentHeight ?? 0, 0) * 0.15;

export function MobileSectionHeader({ title }: MobileSectionHeaderProps) {
  return (
    <View
      className="items-center pb-1.5"
      style={{ paddingTop: Platform.OS === "android" ? 8 + ANDROID_TOP_GAP : 8 }}
    >
      <Text className="text-center text-base font-bold text-gray-800 tracking-[0.2px]">{title}</Text>
    </View>
  );
}
