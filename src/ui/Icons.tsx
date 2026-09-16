import Svg, { Circle, Path } from 'react-native-svg'

type IconProps = { color: string; size?: number }

export function IconSun({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth={1.8} />
      <Path
        d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  )
}

export function IconMoon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16.5 13.4A6.5 6.5 0 1 1 10.6 7.5 5.2 5.2 0 0 0 16.5 13.4Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function IconHelp({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8.2" stroke={color} strokeWidth={1.8} />
      <Path d="M9.6 9.4a2.4 2.4 0 1 1 3.3 2.2c-.7.3-1.1.8-1.1 1.6V14" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx="12" cy="16.6" r="0.9" fill={color} />
    </Svg>
  )
}

export function IconUndo({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 8H4v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 12a7 7 0 1 0 2-4.9L4 8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function IconRedo({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M16 8h4v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M19 12a7 7 0 1 1-2-4.9L20 8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function IconMark({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 4.5h3.2v15H7A2.5 2.5 0 0 1 4.5 17V7A2.5 2.5 0 0 1 7 4.5Z" stroke={color} strokeWidth={1.7} />
      <Path d="M10.2 8.2 19.5 12v3.4L10.2 19" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
    </Svg>
  )
}

export function IconFit({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 5H5v3M16 5h3v3M8 19H5v-3M16 19h3v-3" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  )
}

export function IconPlan({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 7h14M5 12h14M5 17h9" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  )
}

export function IconFront({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 18 12 6l8 12" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  )
}

export function IconEye({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3.5 12S7 6.5 12 6.5 20.5 12 20.5 12 17 17.5 12 17.5 3.5 12 3.5 12Z" stroke={color} strokeWidth={1.8} />
      <Circle cx="12" cy="12" r="2.4" stroke={color} strokeWidth={1.8} />
    </Svg>
  )
}

export function IconChevron({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}
