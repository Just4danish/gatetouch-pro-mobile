import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { StageCanvas as StageCanvasType } from '../three/StageCanvas'

export function SceneSlot({ onMiss }: { onMiss: () => void }) {
  const [Canvas3D, setCanvas3D] = useState<typeof StageCanvasType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let alive = true
    setError(null)
    setCanvas3D(null)
    import('../three/StageCanvas')
      .then((m) => {
        const Comp = m.StageCanvas ?? (m as { default?: typeof StageCanvasType }).default
        if (alive && Comp) setCanvas3D(() => Comp)
        else if (alive) setError('3D canvas module missing export')
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      alive = false
    }
  }, [nonce])

  if (error) {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>3D view failed to load</Text>
        <Text style={styles.msg}>{error}</Text>
        <Pressable style={styles.btn} onPress={() => setNonce((n) => n + 1)}>
          <Text style={styles.btnText}>Retry</Text>
        </Pressable>
      </View>
    )
  }

  if (!Canvas3D) return null
  return <Canvas3D onMiss={onMiss} />
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { color: '#f5f5f7', fontWeight: '700', fontSize: 16 },
  msg: { color: '#93a0b0', fontSize: 12, textAlign: 'center' },
  btn: {
    marginTop: 8,
    backgroundColor: '#0a84ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnText: { color: '#fff', fontWeight: '700' },
})
