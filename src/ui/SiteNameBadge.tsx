import { useEffect, useState } from 'react'
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { getSystemConfig } from '../api/systemConfig'
import { useCorridor } from '../store/corridor'
import { useTheme } from '../store/theme'
import { colors } from '../theme/tokens'
import { Glass } from './Glass'

function isBlankSiteName(value: unknown): boolean {
  if (value == null) return true
  const n = String(value).trim()
  if (!n) return true
  const lower = n.toLowerCase()
  return lower === 'null' || lower === 'undefined'
}

/** Always-on site caption in the lower-right of the 3D stage. */
export function SiteNameBadge({ landscape }: { landscape: boolean }) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const name = useCorridor((s) => s.name)
  const setName = useCorridor((s) => s.setName)
  const [siteLabel, setSiteLabel] = useState<string | null>(null)
  const { width: winW, height: winH } = useWindowDimensions()

  const shortest = Math.min(winW, winH)
  const isTablet = shortest >= 600
  const titleSize = isTablet ? (landscape ? 18 : 20) : landscape ? 15 : 16
  const padH = isTablet ? 14 : 12
  const padV = isTablet ? 8 : 7

  useEffect(() => {
    let alive = true
    void getSystemConfig()
      .then((config) => {
        if (!alive) return
        if (isBlankSiteName(config.site_name)) {
          setSiteLabel(null)
          return
        }
        const site = String(config.site_name).trim()
        setSiteLabel(site)
        setName(site)
      })
      .catch(() => {
        if (alive) setSiteLabel(null)
      })
    return () => {
      alive = false
    }
  }, [setName])

  useEffect(() => {
    if (isBlankSiteName(name)) return
    const next = String(name).trim()
    const lower = next.toLowerCase()
    if (lower === 'new installation' || lower === 'new corridor' || lower === 'site') return
    setSiteLabel(next)
  }, [name])

  if (siteLabel == null || isBlankSiteName(siteLabel)) return null

  const glassFill =
    theme === 'dark' ? 'rgba(36, 40, 48, 0.28)' : 'rgba(255, 255, 255, 0.24)'

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        landscape ? styles.wrapLand : styles.wrapPort,
        isTablet && (landscape ? styles.wrapLandTablet : styles.wrapPortTablet),
      ]}
      testID="app.site.badge"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Glass
        overlay={glassFill}
        style={[
          styles.glass,
          {
            borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.45)',
            paddingHorizontal: padH,
            paddingVertical: padV,
            maxWidth: isTablet ? 420 : landscape ? 300 : 240,
          },
        ]}
      >
        <Text
          style={[
            styles.title,
            {
              color: c.text,
              fontSize: titleSize,
              lineHeight: Math.round(titleSize * 1.2),
            },
          ]}
          numberOfLines={1}
        >
          {siteLabel}
        </Text>
      </Glass>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 11,
    alignItems: 'flex-end',
  },
  wrapPort: {
    bottom: 14,
    right: 12,
  },
  wrapLand: {
    bottom: 14,
    right: 14,
  },
  wrapPortTablet: {
    bottom: 18,
    right: 18,
  },
  wrapLandTablet: {
    bottom: 18,
    right: 18,
  },
  glass: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-end',
  },
  title: {
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'right',
  },
})
