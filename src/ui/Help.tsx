import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CATALOG, UNIT_ORDER } from '../model/catalog'
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
            GateTouch Pro has two jobs. <Text style={{ fontWeight: '800' }}>Build</Text> lays out a row of
            turnstiles. <Text style={{ fontWeight: '800' }}>Operate</Text> opens and closes lanes.
          </Text>

          <Text style={u.label}>Quick start</Text>
          <Text style={{ color: c.text2, lineHeight: 22 }}>
            1. Open Corridors and pick a template{'\n'}
            2. Tap models in Layout to add more{'\n'}
            3. On Lanes, tap Auto, then edit a lane{'\n'}
            4. Switch to Operate and tap a lane to open it
          </Text>

          <Image source={HELP_IMGS.build} style={styles.fig} resizeMode="cover" />
          <Text style={u.hint}>Build: 3D world above, tools docked below.</Text>

          <Text style={u.label}>Catalogue</Text>
          {UNIT_ORDER.map((t) => (
            <View key={t} style={[styles.row, { borderColor: c.hair }]}>
              <Text style={{ color: c.text, fontWeight: '700' }}>{CATALOG[t].short}</Text>
              <Text style={{ color: c.text3, flex: 1, textAlign: 'right' }}>{CATALOG[t].subtitle}</Text>
            </View>
          ))}

          <Image source={HELP_IMGS.lanes} style={styles.fig} resizeMode="cover" />
          <Text style={u.hint}>Lanes group wings. Tick two and Group to pair facing arms.</Text>

          <Image source={HELP_IMGS.operate} style={styles.fig} resizeMode="cover" />
          <Text style={u.hint}>Operate: tap to open or close. Slide for emergency release.</Text>

          <Image source={HELP_IMGS.library} style={styles.fig} resizeMode="cover" />
          <Text style={u.hint}>Corridors keeps templates and your saved layouts on this device.</Text>

          <Text style={u.label}>Gestures</Text>
          <Text style={{ color: c.text2, lineHeight: 22 }}>
            · Drag one finger — orbit{'\n'}
            · Drag two fingers — pan{'\n'}
            · Pinch — zoom{'\n'}
            · Tap a unit — properties{'\n'}
            · Long-press a unit — Flip, Duplicate, Remove
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
