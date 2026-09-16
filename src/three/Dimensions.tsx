import { drei } from '../lib/r3f'
import type { Layout } from '../store/corridor'

const { Text } = drei

function DimBar({
  x1,
  x2,
  z,
  label,
  color,
}: {
  x1: number
  x2: number
  z: number
  label: string
  color: string
}) {
  const w = Math.max(x2 - x1, 0.001)
  const cx = (x1 + x2) / 2
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.005, z]}>
        <planeGeometry args={[w, 0.011]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      {[x1, x2].map((tx, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[tx, 0.005, z]}>
          <planeGeometry args={[0.012, 0.11]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} />
        </mesh>
      ))}
      <Text
        position={[cx, 0.04, z]}
        fontSize={0.08}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.004}
        outlineColor="#000000"
      >
        {label}
      </Text>
    </group>
  )
}

/** Datasheet-style dimension lines: each clear gap plus the overall width. */
export function Dimensions({ layout, depth }: { layout: Layout; depth: number }) {
  const z = depth / 2 + 0.15
  const edges = layout.edges
  return (
    <group>
      {edges.slice(0, -1).map((e, i) => {
        const next = edges[i + 1]
        const mm = Math.round((next.left - e.right) * 1000)
        return (
          <DimBar
            key={e.id}
            x1={e.right}
            x2={next.left}
            z={z}
            label={`${mm} mm`}
            color="#0a84ff"
          />
        )
      })}
      {edges.length > 0 && (
        <DimBar
          x1={edges[0].left}
          x2={edges[edges.length - 1].right}
          z={z + 0.38}
          label={`overall ${Math.round((edges[edges.length - 1].right - edges[0].left) * 1000)} mm`}
          color="#ff9f0a"
        />
      )}
    </group>
  )
}
