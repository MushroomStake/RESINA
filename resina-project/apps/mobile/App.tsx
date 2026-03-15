import { useState } from "react";
import { Image, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { supabase } from "./lib/supabase";

export default function App() {
  const [dbStatus, setDbStatus] = useState("Not tested");

  const testSupabaseConnection = async () => {
    setDbStatus("Checking...");
    const { error } = await supabase.auth.getSession();

    if (error) {
      setDbStatus(`Connection error: ${error.message}`);
      return;
    }

    setDbStatus("Connected to Supabase");
  };

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

        <Pressable style={styles.button} onPress={testSupabaseConnection}>
          <Text style={styles.buttonText}>Test Supabase Connection</Text>
        </Pressable>

        <Text style={styles.status}>{dbStatus}</Text>
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
  button: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#2e9d5a",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  status: {
    marginTop: 8,
    textAlign: "center",
    color: "#374151",
    fontSize: 12,
  },
});
