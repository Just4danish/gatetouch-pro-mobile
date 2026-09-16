import * as THREE from 'three'

let patched = false

/**
 * Three.js MeshPhysicalMaterial enables USE_TRANSMISSION for glass, then
 * reads material.dispersion in getIBLVolumeRefraction. Dispersion is only
 * assigned when USE_DISPERSION is on (value > 0), so NVIDIA/ANGLE warns:
 * C7050 material.dispersion might be used before being initialized.
 */
export function patchThreeShaders() {
  if (patched) return
  patched = true
  const chunk = THREE.ShaderChunk.lights_physical_fragment
  if (!chunk || chunk.includes('material.dispersion = 0.0')) return
  THREE.ShaderChunk.lights_physical_fragment = chunk.replace(
    '#ifdef USE_DISPERSION',
    'material.dispersion = 0.0;\n#ifdef USE_DISPERSION',
  )
}

export function toStandardMaterial(src: THREE.Material): THREE.MeshStandardMaterial {
  const phys = src as THREE.MeshPhysicalMaterial
  if (!phys.isMeshPhysicalMaterial) return src as THREE.MeshStandardMaterial
  return new THREE.MeshStandardMaterial({
    name: src.name,
    color: phys.color.clone(),
    map: phys.map,
    roughness: phys.roughness,
    metalness: phys.metalness,
    roughnessMap: phys.roughnessMap,
    metalnessMap: phys.metalnessMap,
    normalMap: phys.normalMap,
    emissive: phys.emissive?.clone?.() ?? new THREE.Color(0x000000),
    emissiveMap: phys.emissiveMap,
    emissiveIntensity: phys.emissiveIntensity ?? 0,
    envMap: phys.envMap,
    envMapIntensity: phys.envMapIntensity,
    transparent: phys.transparent || phys.transmission > 0,
    opacity: phys.transmission > 0 ? Math.min(0.92, Math.max(0.18, 1 - phys.transmission * 0.75)) : phys.opacity,
    side: phys.side,
    depthWrite: phys.transmission > 0 ? false : phys.depthWrite,
  })
}

export function stripPhysicalMaterials(root: THREE.Object3D) {
  const seen = new Map<string, THREE.Material>()
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !mesh.material) return
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const next = list.map((src) => {
      const hit = seen.get(src.uuid)
      if (hit) return hit
      const std = toStandardMaterial(src)
      seen.set(src.uuid, std)
      return std
    })
    mesh.material = Array.isArray(mesh.material) ? next : next[0]
  })
}
