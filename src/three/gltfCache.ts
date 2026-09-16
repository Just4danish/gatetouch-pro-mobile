import { Asset } from 'expo-asset'
import { File } from 'expo-file-system'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const cache = new Map<number, Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>>()

function parseGltf(data: ArrayBuffer) {
  return new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((resolve, reject) => {
    new GLTFLoader().parse(
      data,
      '',
      (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations ?? [] }),
      reject,
    )
  })
}

export function loadGltf(moduleId: number) {
  let hit = cache.get(moduleId)
  if (!hit) {
    hit = (async () => {
      const asset = Asset.fromModule(moduleId)
      await asset.downloadAsync()
      const uri = asset.localUri || asset.uri
      if (!uri) throw new Error('GLB asset has no uri')
      try {
        return await parseGltf(await new File(uri).arrayBuffer())
      } catch {
        const gltf = await new GLTFLoader().loadAsync(uri)
        return { scene: gltf.scene, animations: gltf.animations ?? [] }
      }
    })()
    cache.set(moduleId, hit)
  }
  return hit
}
