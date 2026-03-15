import { Image, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#f3f5f5" />
      <View style={styles.container}>
        <Text style={styles.title}>RESINA Mobile Preview</Text>
        <Text style={styles.subtitle}>Starter screen for Expo Go and APK build testing</Text>

        <Image
          source={require("./assets/images/login-preview.png")}
          style={styles.previewImage}
          resizeMode="contain"
        />

        <Text style={styles.note}>
          Replace ./assets/images/login-preview.png with your latest login UI screenshot anytime.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f3f5f5",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0d3d73",
  },
  subtitle: {
    textAlign: "center",
    color: "#4b5563",
    marginBottom: 8,
  },
  previewImage: {
    width: "88%",
    maxWidth: 390,
    height: 560,
    borderRadius: 18,
  },
  note: {
    marginTop: 8,
    textAlign: "center",
    color: "#6b7280",
    fontSize: 12,
  },
});
