import { Platform } from 'react-native'

export const fiber = Platform.OS === 'web'
  ? require('@react-three/fiber')
  : require('@react-three/fiber/native')

export const drei = Platform.OS === 'web'
  ? require('@react-three/drei')
  : require('@react-three/drei/native')
