import { useState } from 'react'
import {
  Image,
  type ImageSourcePropType,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
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
}

function HelpFigure({
  source,
  onOpen,
}: {
  source: ImageSourcePropType
  onOpen: () => void
}) {
  return (
    <Pressable
      onPress={() => {
        tap()
        onOpen()
      }}
      accessibilityRole="imagebutton"
      accessibilityLabel="View image full screen"
      accessibilityHint="Opens a larger view of this guide image"
    >
      <Image source={source} style={styles.fig} resizeMode="cover" />
      <Text style={styles.figHint}>Tap to enlarge</Text>
    </Pressable>
  )
}

export function Help({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const u = makeUiStyles(c)
  const [preview, setPreview] = useState<ImageSourcePropType | null>(null)

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
            4. Long-press a unit → Select Multiple, tap a neighbour, then set Clear Width{'\n'}
            5. Switch to Operate and tap a lane
          </Text>

          <HelpFigure source={HELP_IMGS.build} onOpen={() => setPreview(HELP_IMGS.build)} />
          <Text style={u.hint}>Build: 3D above, wizard below — lane groups, then manufacturer, then models.</Text>

          <Text style={u.label}>CAME models</Text>
          {TURNSTILE_MODELS.map((m) => (
            <View key={m.id} style={[styles.row, { borderColor: c.hair }]}>
              <Text style={{ color: c.text, fontWeight: '700' }}>{m.modelCode}</Text>
              <Text style={{ color: c.text3, flex: 1, textAlign: 'right' }}>{m.name}</Text>
            </View>
          ))}

          <HelpFigure source={HELP_IMGS.lanes} onOpen={() => setPreview(HELP_IMGS.lanes)} />
          <Text style={u.hint}>Lanes are created automatically between neighbouring turnstile units.</Text>

          <HelpFigure source={HELP_IMGS.operate} onOpen={() => setPreview(HELP_IMGS.operate)} />
          <Text style={u.hint}>
            Operate: tap a lane card to open or close. Fire and emergency alarms need a PIN on the lane group, then
            slide to confirm.
          </Text>

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
            · Tap a unit — properties (Flip / Remove){'\n'}
            · Long-press a unit — Properties, Flip, Select Multiple, Remove
          </Text>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={preview != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(null)}
      >
        <Pressable
          style={styles.previewBackdrop}
          onPress={() => {
            tap()
            setPreview(null)
          }}
          accessibilityLabel="Close image preview"
        >
          <SafeAreaView style={styles.previewSafe} edges={['top', 'left', 'right', 'bottom']}>
            <View style={styles.previewBar}>
              <Pressable
                style={u.ghostBtn}
                testID="app.help.preview.close"
                onPress={() => {
                  tap()
                  setPreview(null)
                }}
              >
                <Text style={[u.ghostText, { color: '#fff' }]}>Close</Text>
              </Pressable>
            </View>
            {preview != null && (
              <Image source={preview} style={styles.previewImage} resizeMode="contain" />
            )}
          </SafeAreaView>
        </Pressable>
      </Modal>
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
  figHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  previewSafe: {
    flex: 1,
  },
  previewBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  previewImage: {
    flex: 1,
    width: '100%',
    marginHorizontal: 8,
    marginBottom: 16,
  },
})
