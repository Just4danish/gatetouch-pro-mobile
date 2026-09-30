import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { apiErrorMessage } from '../api/client'
import {
  getSystemConfig,
  updateSystemConfig,
  type SystemConfigDto,
} from '../api/systemConfig'
import { useTheme } from '../store/theme'
import { useToast } from '../store/toast'
import { colors } from '../theme/tokens'
import { buzz, tap, whoosh } from '../lib/feedback'
import { IconEdit, IconUser, IconUsers } from './Icons'

type UsersListDialogProps = {
  open: boolean
  onClose: () => void
}

type PasswordField = 'operator1_password' | 'operator2_password'

type UserRow = {
  label: string
  username: string
  passwordField: PasswordField
}

function usersFromConfig(config: SystemConfigDto): UserRow[] {
  const name = (v: string | null | undefined) => {
    const s = `${v ?? ''}`.trim()
    return s || '—'
  }
  // Admin is shown under the current-user account menu, not in this list.
  return [
    {
      label: 'Operator 1',
      username: name(config.operator1_username),
      passwordField: 'operator1_password',
    },
    {
      label: 'Operator 2',
      username: name(config.operator2_username),
      passwordField: 'operator2_password',
    },
  ]
}

export function UsersListDialog({ open, onClose }: UsersListDialogProps) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const insets = useSafeAreaInsets()
  const showToast = useToast((s) => s.show)
  const { width: winW, height: winH } = useWindowDimensions()
  const landscape = winW > winH
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [configId, setConfigId] = useState<number | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setError(null)
    setUsers([])
    setConfigId(null)
    setEditing(null)
    void getSystemConfig()
      .then((config) => {
        if (!alive) return
        setConfigId(config.id)
        setUsers(usersFromConfig(config))
      })
      .catch((err) => {
        if (!alive) return
        setError(apiErrorMessage(err))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [open])

  const closeEdit = () => {
    if (saving) return
    setEditing(null)
    setNewPassword('')
    setConfirmPassword('')
    setEditError(null)
  }

  const openEdit = (user: UserRow) => {
    tap()
    setEditing(user)
    setNewPassword('')
    setConfirmPassword('')
    setEditError(null)
  }

  const savePassword = () => {
    if (!editing || configId == null || saving) return
    const next = newPassword.trim()
    if (!next) {
      setEditError('Enter a new password.')
      buzz()
      return
    }
    if (next.length < 4) {
      setEditError('Password must be at least 4 characters.')
      buzz()
      return
    }
    if (next !== confirmPassword.trim()) {
      setEditError('Passwords do not match.')
      buzz()
      return
    }

    const target = editing
    setSaving(true)
    setEditError(null)
    void updateSystemConfig(configId, { [target.passwordField]: next })
      .then(() => {
        whoosh()
        setEditing(null)
        setNewPassword('')
        setConfirmPassword('')
        onClose()
        showToast(`Password updated for ${target.label}`, 'success')
      })
      .catch((err) => {
        buzz()
        showToast(apiErrorMessage(err), 'error')
      })
      .finally(() => {
        setSaving(false)
      })
  }

  const cardMaxH = landscape ? Math.min(winH - 40, 340) : Math.min(winH * 0.8, 520)

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View
        style={[
          styles.root,
          {
            paddingHorizontal: landscape ? 40 : 24,
            paddingTop: Math.max(16, insets.top),
            paddingBottom: Math.max(16, insets.bottom),
          },
        ]}
      >
        <Pressable
          style={[
            styles.backdrop,
            { backgroundColor: theme === 'dark' ? 'rgba(8,10,14,0.55)' : 'rgba(20,24,32,0.32)' },
          ]}
          onPress={editing ? closeEdit : onClose}
          accessibilityLabel="Dismiss"
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme === 'dark' ? c.panel : c.sheetBg,
              borderColor: c.hair,
              shadowColor: '#000',
              maxWidth: landscape ? 400 : 380,
              maxHeight: cardMaxH,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: c.accentTint, borderColor: c.tintBlueBd }]}>
              <IconUsers color={c.accentFg} size={18} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
                Users
              </Text>
              <Text style={[styles.subtitle, { color: c.text3 }]} numberOfLines={1}>
                {loading ? 'Loading operators…' : `${users.length} operator accounts`}
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={c.accent} testID="app.users.loading" />
            </View>
          ) : error ? (
            <Text style={[styles.error, { color: c.redFg }]} testID="app.users.error">
              {error}
            </Text>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {users.map((u) => (
                <UserCard key={u.label} user={u} c={c} onEditPassword={() => openEdit(u)} />
              ))}
            </ScrollView>
          )}

          <Pressable
            style={[styles.closeBtn, { backgroundColor: c.fill2, borderColor: c.hair }]}
            testID="app.users.close"
            accessibilityRole="button"
            accessibilityLabel="Close users list"
            onPress={() => {
              tap()
              onClose()
            }}
          >
            <Text style={[styles.closeText, { color: c.text }]}>Close</Text>
          </Pressable>
        </View>

        {editing ? (
          <View
            style={[
              styles.editCard,
              {
                backgroundColor: theme === 'dark' ? c.panel : c.sheetBg,
                borderColor: c.hair,
                shadowColor: '#000',
                maxWidth: landscape ? 360 : 340,
              },
            ]}
          >
            <Text style={[styles.editTitle, { color: c.text }]}>Change password</Text>
            <Text style={[styles.editSubtitle, { color: c.text3 }]} numberOfLines={1}>
              {editing.label} · {editing.username}
            </Text>

            <Text style={[styles.inputLabel, { color: c.text3 }]}>New password</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              style={[
                styles.input,
                { color: c.text, backgroundColor: c.glass2, borderColor: c.hair },
              ]}
              placeholder="Enter new password"
              placeholderTextColor={c.text3}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!saving}
              testID="app.users.password.new"
            />

            <Text style={[styles.inputLabel, { color: c.text3 }]}>Confirm password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={[
                styles.input,
                { color: c.text, backgroundColor: c.glass2, borderColor: c.hair },
              ]}
              placeholder="Re-enter password"
              placeholderTextColor={c.text3}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!saving}
              testID="app.users.password.confirm"
            />

            {editError ? (
              <Text style={[styles.error, { color: c.redFg }]} testID="app.users.password.error">
                {editError}
              </Text>
            ) : null}

            <View style={styles.editActions}>
              <Pressable
                style={[styles.editBtn, { backgroundColor: c.fill2, borderColor: c.hair }]}
                testID="app.users.password.cancel"
                disabled={saving}
                onPress={closeEdit}
              >
                <Text style={[styles.closeText, { color: c.text2 }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.editBtn,
                  { backgroundColor: c.accent },
                  saving && { opacity: 0.65 },
                ]}
                testID="app.users.password.save"
                disabled={saving}
                onPress={() => {
                  tap()
                  savePassword()
                }}
              >
                <Text style={[styles.closeText, { color: c.onAccent }]}>
                  {saving ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  )
}

function UserCard({
  user,
  c,
  onEditPassword,
}: {
  user: UserRow
  c: ReturnType<typeof colors>
  onEditPassword: () => void
}) {
  const initial = user.username !== '—' ? user.username.charAt(0).toUpperCase() : '?'
  return (
    <View
      style={[styles.userCard, { backgroundColor: c.glass2, borderColor: c.hair }]}
      testID={`app.users.row.${user.label.replace(/\s+/g, '').toLowerCase()}`}
    >
      <View style={styles.userTop}>
        <View style={[styles.avatar, { backgroundColor: c.accentTint, borderColor: c.tintBlueBd }]}>
          {user.username !== '—' ? (
            <Text style={[styles.avatarLetter, { color: c.accentFg }]}>{initial}</Text>
          ) : (
            <IconUser color={c.accentFg} size={14} />
          )}
        </View>
        <View style={styles.userMeta}>
          <View style={[styles.roleChip, { backgroundColor: c.accentTint }]}>
            <Text style={[styles.roleChipText, { color: c.accentFg }]}>{user.label}</Text>
          </View>
          <Text style={[styles.username, { color: c.text }]} numberOfLines={1} selectable>
            {user.username}
          </Text>
        </View>
      </View>
      <View style={[styles.secretRow, { borderTopColor: c.hair }]}>
        <Text style={[styles.secretLabel, { color: c.text3 }]}>Password</Text>
        <View style={styles.secretRight}>
          <Text style={[styles.secretValue, { color: c.text2 }]}>••••••••</Text>
          <Pressable
            style={[styles.editIconBtn, { backgroundColor: c.chrome, borderColor: c.hair }]}
            testID={`app.users.password.edit.${user.passwordField}`}
            accessibilityRole="button"
            accessibilityLabel={`Edit password for ${user.label}`}
            onPress={onEditPassword}
            hitSlop={8}
          >
            <IconEdit color={c.accentFg} size={14} />
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    zIndex: 1,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  center: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 4,
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  listContent: {
    gap: 8,
    paddingBottom: 2,
  },
  userCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 8,
  },
  userTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 13,
    fontWeight: '800',
  },
  userMeta: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  roleChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  username: {
    fontSize: 14,
    fontWeight: '700',
  },
  secretRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  secretLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  secretRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secretValue: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  editIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  editCard: {
    position: 'absolute',
    width: '100%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    zIndex: 2,
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  editTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  editSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 6,
  },
  input: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  editBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
