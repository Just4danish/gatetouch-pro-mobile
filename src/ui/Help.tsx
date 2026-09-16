import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TURNSTILE_MODELS } from '../model/products'
import { colors } from '../theme/tokens'
import { useTheme } from '../store/theme'
import { makeUiStyles } from './uiStyles'
import { tap } from '../lib/feedback'

const HELP_IMGS = {
  build: require('../../assets/help/build.jpg'),
  operate: require('../../assets/help/operate.jpg'),
  lanes: require('../../assets/help/lanes.jpg'),
  library: require('../../assets/help/library.jpg'),
}

export function Help({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const u = makeUiStyles(c)

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top', 'left', 'right', 'bottom']}>
        <View style={[styles.bar, { borderBottomColor: c.hair }]}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Guide</Text>
          <Pressable
            style={u.ghostBtn}
            testID="app.help.close"
            accessibilityLabel="Close guide"
            onPress={() => {
              tap()
              onClose()
            }}
          >
            <Text style={u.ghostText}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 48 }}>
          <Text style={{ color: c.text, fontSize: 16, lineHeight: 24 }}>
            GateTouch Pro configures a real turnstile <Text style={{ fontWeight: '800' }}>installation</Text>.{' '}
            <Text style={{ fontWeight: '800' }}>Build</Text> creates lane groups and places equipment.{' '}
            <Text style={{ fontWeight: '800' }}>Operate</Text> opens and closes lanes.
          </Text>

          <Text style={u.label}>Quick start</Text>
          <Text style={{ color: c.text2, lineHeight: 22 }}>
            1. Create a Lane Group, then open it{'\n'}
            2. Keep CAME selected and tap Next{'\n'}
            3. Tap a model, then Add to the group{'\n'}
            4. Select two units to set Clear Width{'\n'}
            5. Switch to Operate and tap a lane
          </Text>

          <Image source={HELP_IMGS.build} style={styles.fig} resizeMode="cover" />
          <Text style={u.hint}>Build: 3D above, wizard below — lane groups, then manufacturer, then models.</Text>

          <Text style={u.label}>CAME models</Text>
          {TURNSTILE_MODELS.map((m) => (
            <View key={m.id} style={[styles.row, { borderColor: c.hair }]}>
              <Text style={{ color: c.text, fontWeight: '700' }}>{m.modelCode}</Text>
              <Text style={{ color: c.text3, flex: 1, textAlign: 'right' }}>{m.name}</Text>
            </View>
          ))}

          <Image source={HELP_IMGS.lanes} style={styles.fig} resizeMode="cover" />
          <Text style={u.hint}>Lanes are created automatically between neighbouring turnstile units.</Text>

          <Image source={HELP_IMGS.operate} style={styles.fig} resizeMode="cover" />
          <Text style={u.hint}>Operate: tap a lane card to open or close. Emergency release asks for confirmation.</Text>

          <Image source={HELP_IMGS.library} style={styles.fig} resizeMode="cover" />
          <Text style={u.hint}>Installation Library loads from SQLite on this device. Save from Build after placing models.</Text>

          <Text style={u.label}>Gestures</Text>
          <Text style={{ color: c.text2, lineHeight: 22 }}>
            Touch{'\n'}
            · One finger drag — orbit{'\n'}
            · Two finger drag — pan{'\n'}
            · Pinch — zoom{'\n'}
            Mouse{'\n'}
            · Left-drag — orbit{'\n'}
            · Middle- or right-drag — pan{'\n'}
            · Wheel — zoom{'\n'}
            · Tap a unit — properties{'\n'}
            · Long-press a unit — Flip, Duplicate, Select Multiple, Remove
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fig: { width: '100%', height: 160, borderRadius: 14 },
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
