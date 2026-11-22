import { useEffect, useRef, useState } from 'react'
import { BackHandler, Button, Linking, StatusBar, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import { classifyNavigation, configuredAppUrl } from './navigation'

const appUrl = configuredAppUrl(process.env.EXPO_PUBLIC_ECONEXUS_URL, __DEV__)

function AppContent() {
  const web = useRef(null)
  const canGoBack = useRef(false)
  const [failed, setFailed] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!web.current || !canGoBack.current) return false
      web.current.goBack()
      return true
    })
    return () => subscription.remove()
  }, [])

  function openInBrowser(url) {
    Linking.openURL(url).catch(() => {})
  }

  function handleNavigation({ url, isTopFrame }) {
    const destination = classifyNavigation(url, appUrl, __DEV__)
    if (destination === 'app') return true
    if (destination === 'external' && isTopFrame !== false) openInBrowser(url)
    return false
  }

  function handleNewWindow({ nativeEvent: { targetUrl } }) {
    const destination = classifyNavigation(targetUrl, appUrl, __DEV__)
    if (destination === 'app') {
      web.current?.injectJavaScript(`window.location.assign(${JSON.stringify(targetUrl)}); true;`)
    } else if (destination === 'external') {
      openInBrowser(targetUrl)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {!appUrl || failed ? (
        <View style={styles.message}>
          <Text style={styles.title}>EcoNexus</Text>
          <Text>{appUrl ? 'Impossible de charger EcoNexus.' : 'Configurez l’adresse HTTPS d’EcoNexus.'}</Text>
          {failed && (
            <Button title="Réessayer" onPress={() => {
              canGoBack.current = false
              setLoadAttempt((attempt) => attempt + 1)
              setFailed(false)
            }} />
          )}
        </View>
      ) : (
        <WebView
          key={loadAttempt}
          ref={web}
          source={{ uri: appUrl }}
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={handleNavigation}
          onOpenWindow={handleNewWindow}
          onNavigationStateChange={(state) => { canGoBack.current = state.canGoBack }}
          onError={() => setFailed(true)}
          onContentProcessDidTerminate={() => web.current?.reload()}
          onRenderProcessGone={() => setFailed(true)}
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          geolocationEnabled
          mixedContentMode="never"
          allowFileAccess={false}
        />
      )}
    </SafeAreaView>
  )
}

export default function App() {
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  message: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
})
