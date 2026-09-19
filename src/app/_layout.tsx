import { ads } from "@/ads/adService";
import { ProgressProvider, useProgress } from "@/data/progressStore";
import { colors } from "@/theme";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

SplashScreen.preventAutoHideAsync();

function SyncAds() {
  const progress = useProgress();
  useEffect(() => {
    ads.setRemoved(progress.adsRemoved);
  }, [progress.adsRemoved]);
  return null;
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.cream, alignItems: "center" }}>
      <View style={styles.frame}>
        <ProgressProvider>
          <SyncAds />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.cream },
              animation: "fade",
            }}
          />
        </ProgressProvider>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = {
  frame: {
    flex: 1,
    width: "100%" as const,
    maxWidth: Platform.OS === "web" ? 480 : undefined,
  },
};
