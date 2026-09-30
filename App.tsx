import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SplashScreen from 'expo-splash-screen'
import { CorridorScreen } from './src/screens/CorridorScreen'
import { LoginScreen } from './src/screens/LoginScreen'
import { useAuth } from './src/store/auth'
import { useTheme, watchSystemTheme } from './src/store/theme'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function App() {
  const isAuthenticated = useAuth((s) => s.isAuthenticated)
  const restoringSession = useAuth((s) => s.restoringSession)
  const restoreSession = useAuth((s) => s.restoreSession)
  const hydrateTheme = useTheme((s) => s.hydrate)
  const [splashHidden, setSplashHidden] = useState(false)

  useEffect(() => {
    void hydrateTheme()
    void restoreSession()
    return watchSystemTheme()
  }, [hydrateTheme, restoreSession])

  useEffect(() => {
    if (restoringSession || splashHidden) return
    // Authenticated: CorridorScreen hides splash after the 3D stage is ready.
    if (isAuthenticated) return
    SplashScreen.hideAsync()
      .catch(() => {})
      .finally(() => setSplashHidden(true))
  }, [restoringSession, isAuthenticated, splashHidden])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {restoringSession ? (
          <View style={{ flex: 1 }} />
        ) : isAuthenticated ? (
          <CorridorScreen />
        ) : (
          <LoginScreen />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
