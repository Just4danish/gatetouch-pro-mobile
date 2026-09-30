import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { ApiError, apiErrorMessage } from '../api/client'
import { UnauthorizedRoleError } from '../auth/roles'
import { useAuth } from '../store/auth'
import { useTheme } from '../store/theme'
import { colors } from '../theme/tokens'
import { buzz, chime, tap } from '../lib/feedback'
import { IconEye, IconEyeOff } from '../ui/Icons'

const FORM_MAX_W = 400
const LOGO_DARK = require('../assets/logo/logo_dark.png')
const LOGO_LIGHT = require('../assets/logo/logo.png')

export function LoginScreen() {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const login = useAuth((s) => s.login)
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const landscape = width > height
  // Side-by-side brand + form in any landscape wide enough to fit both columns.
  const splitLayout = landscape && width >= 560
  const contentMaxW = splitLayout
    ? Math.min(width - Math.max(40, insets.left + insets.right + 24), 820)
    : FORM_MAX_W
  const compact = landscape && height < 480

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [focused, setFocused] = useState<'username' | 'password' | null>(null)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true))
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  function scrollFormIntoView() {
    // Let the keyboard finish opening, then bring Sign in into view.
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true })
      }, Platform.OS === 'ios' ? 50 : 120)
    })
  }

  const canSubmit = username.trim().length > 0 && password.length > 0 && !submitting

  async function handleSubmit() {
    tap()
    if (!username.trim() || !password) {
      setError('Enter both username and password.')
      buzz()
      return
    }
    if (submitting) return

    setError(null)
    setSubmitting(true)
    try {
      await login(username, password)
      chime()
    } catch (err) {
      buzz()
      if (err instanceof UnauthorizedRoleError) {
        setError(err.message)
      } else if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setError('Invalid username or password.')
      } else {
        setError(apiErrorMessage(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const brand = (
    <View style={[styles.brand, splitLayout && styles.brandSplit]}>
      <View
        style={[
          styles.logoWrap,
          compact && styles.logoWrapCompact,
          {
            backgroundColor: theme === 'dark' ? '#0a0e14' : '#ffffff',
            borderColor: c.hair,
          },
        ]}
      >
        <Image
          source={theme === 'dark' ? LOGO_DARK : LOGO_LIGHT}
          style={styles.logo}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          accessibilityLabel="GateTouch Pro"
          accessibilityRole="image"
        />
      </View>
      <View style={[styles.brandCopy, splitLayout && styles.brandCopySplit]}>
        <Text
          style={[styles.heading, compact && styles.headingCompact, { color: c.text }]}
          accessibilityRole="header"
        >
          Welcome back
        </Text>
        <Text style={[styles.subtitle, { color: c.text2 }]}>Sign in to continue</Text>
      </View>
    </View>
  )

  const form = (
    <View
      style={[
        styles.card,
        splitLayout && styles.cardSplit,
        splitLayout && !compact && styles.cardLandscape,
        compact && styles.cardCompact,
        {
          backgroundColor: theme === 'dark' ? c.panel : c.card,
          borderColor: c.hair,
          shadowColor: '#000',
          maxWidth: splitLayout ? Math.min(FORM_MAX_W, contentMaxW * 0.52) : FORM_MAX_W,
        },
      ]}
    >
      <Field
        label="Username"
        value={username}
        onChangeText={(v) => {
          setUsername(v)
          if (error) setError(null)
        }}
        placeholder="Enter username"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="username"
        autoComplete="username"
        returnKeyType="next"
        testID="login.username"
        focused={focused === 'username'}
        onFocus={() => {
          setFocused('username')
          if (!splitLayout) scrollFormIntoView()
        }}
        onBlur={() => setFocused((f) => (f === 'username' ? null : f))}
        c={c}
        editable={!submitting}
        compact={compact}
      />

      <Field
        label="Password"
        value={password}
        onChangeText={(v) => {
          setPassword(v)
          if (error) setError(null)
        }}
        placeholder="Enter password"
        secureTextEntry={!showPassword}
        textContentType="password"
        autoComplete="password"
        returnKeyType="go"
        onSubmitEditing={() => {
          void handleSubmit()
        }}
        testID="login.password"
        focused={focused === 'password'}
        onFocus={() => {
          setFocused('password')
          if (!splitLayout) scrollFormIntoView()
        }}
        onBlur={() => setFocused((f) => (f === 'password' ? null : f))}
        c={c}
        editable={!submitting}
        compact={compact}
        trailing={
          <Pressable
            onPress={() => {
              tap()
              setShowPassword((v) => !v)
            }}
            hitSlop={10}
            style={styles.eyeBtn}
            testID="login.password.toggle"
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <IconEyeOff color={c.text2} size={20} /> : <IconEye color={c.text2} size={20} />}
          </Pressable>
        }
      />

      {error ? (
        <Text style={[styles.error, { color: c.redFg }]} testID="login.error">
          {error}
        </Text>
      ) : null}

      <Pressable
        style={[
          styles.submit,
          compact && styles.submitCompact,
          { backgroundColor: c.accent },
          !canSubmit && styles.submitDisabled,
        ]}
        onPress={() => {
          void handleSubmit()
        }}
        disabled={!canSubmit}
        testID="login.submit"
        accessibilityRole="button"
        accessibilityLabel="Sign in"
        accessibilityState={{ disabled: !canSubmit, busy: submitting }}
      >
        {submitting ? (
          <ActivityIndicator color={c.onAccent} testID="login.loading" />
        ) : (
          <Text style={[styles.submitText, { color: c.onAccent }]}>Sign in</Text>
        )}
      </Pressable>
    </View>
  )

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingHorizontal: Math.max(20, insets.left + 12, insets.right + 12, landscape ? 28 : 20),
              paddingTop: landscape ? 12 : 28,
              paddingBottom: keyboardVisible ? 32 : landscape ? 12 : 28,
              ...(keyboardVisible || splitLayout
                ? { flexGrow: 1, justifyContent: keyboardVisible && !splitLayout ? 'flex-start' : 'center' }
                : { minHeight: height - insets.top - insets.bottom }),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.content,
              splitLayout ? styles.contentSplit : styles.contentStack,
              { maxWidth: contentMaxW, width: '100%' },
            ]}
          >
            {brand}
            {form}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

type FieldColors = ReturnType<typeof colors>

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  autoCorrect,
  textContentType,
  autoComplete,
  returnKeyType,
  onSubmitEditing,
  testID,
  trailing,
  focused,
  onFocus,
  onBlur,
  c,
  editable = true,
  compact = false,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder: string
  secureTextEntry?: boolean
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoCorrect?: boolean
  textContentType?: 'username' | 'password'
  autoComplete?: 'username' | 'password'
  returnKeyType?: 'next' | 'go' | 'done'
  onSubmitEditing?: () => void
  testID: string
  trailing?: ReactNode
  focused?: boolean
  onFocus?: () => void
  onBlur?: () => void
  c: FieldColors
  editable?: boolean
  compact?: boolean
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.text2 }]}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          compact && styles.inputRowCompact,
          {
            backgroundColor: c.surface,
            borderColor: focused ? c.accent : c.hair,
            borderWidth: focused ? 1.5 : StyleSheet.hairlineWidth,
            opacity: editable ? 1 : 0.7,
          },
        ]}
      >
        <TextInput
          style={[styles.input, compact && styles.inputCompact, { color: c.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.text3}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          textContentType={textContentType}
          autoComplete={autoComplete}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={onFocus}
          onBlur={onBlur}
          testID={testID}
          accessibilityLabel={label}
          editable={editable}
        />
        {trailing}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  contentStack: {
    gap: 22,
  },
  contentSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    flexGrow: 1,
  },
  brand: {
    alignItems: 'center',
    gap: 12,
  },
  brandSplit: {
    flex: 1,
    minWidth: 0,
    maxWidth: 320,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 14,
  },
  brandCopy: {
    alignItems: 'center',
    gap: 4,
  },
  brandCopySplit: {
    alignItems: 'flex-start',
  },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  logoWrapCompact: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headingCompact: {
    fontSize: 20,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  card: {
    width: '100%',
    maxWidth: FORM_MAX_W,
    alignSelf: 'center',
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 36,
    paddingTop: 40,
    paddingBottom: 40,
    gap: 20,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardSplit: {
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 280,
    width: '100%',
    alignSelf: 'center',
  },
  cardLandscape: {
    paddingHorizontal: 36,
    paddingTop: 36,
    paddingBottom: 36,
    gap: 18,
  },
  cardCompact: {
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 28,
    gap: 14,
  },
  field: { gap: 8 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  inputRow: {
    minHeight: 52,
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inputRowCompact: {
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 14,
  },
  inputCompact: {
    paddingVertical: 10,
  },
  eyeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: -2,
  },
  submit: {
    marginTop: 8,
    minHeight: 52,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitCompact: {
    marginTop: 4,
    minHeight: 44,
  },
  submitDisabled: { opacity: 0.45 },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
  },
})
