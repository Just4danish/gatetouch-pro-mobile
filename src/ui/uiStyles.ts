import { StyleSheet, type ViewStyle, type TextStyle } from 'react-native'
import type { ThemeColors } from '../theme/tokens'

export function makeUiStyles(c: ThemeColors) {
  return StyleSheet.create({
    panel: {
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 10,
      gap: 8,
    } as ViewStyle,
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    } as ViewStyle,
    wrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    } as ViewStyle,
    subtabs: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    } as ViewStyle,
    tabBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 14,
      backgroundColor: c.surface,
    } as ViewStyle,
    tabBtnOn: {
      backgroundColor: c.accent,
    } as ViewStyle,
    tabText: {
      color: c.text2,
      fontSize: 13,
      fontWeight: '600',
    } as TextStyle,
    tabTextOn: {
      color: c.onAccent,
    } as TextStyle,
    ghostBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 14,
      backgroundColor: c.surface,
    } as ViewStyle,
    ghostText: {
      color: c.accentFg,
      fontSize: 13,
      fontWeight: '600',
    } as TextStyle,
    primaryBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: c.accent,
    } as ViewStyle,
    primaryText: {
      color: c.onAccent,
      fontSize: 13,
      fontWeight: '700',
    } as TextStyle,
    dangerBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: c.tintRedBg,
      borderWidth: 1,
      borderColor: c.tintRedBd,
    } as ViewStyle,
    dangerText: {
      color: c.redFg,
      fontSize: 13,
      fontWeight: '700',
    } as TextStyle,
    btn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: c.fill2,
    } as ViewStyle,
    btnText: {
      color: c.text,
      fontSize: 13,
      fontWeight: '600',
    } as TextStyle,
    btnDisabled: {
      opacity: 0.35,
    } as ViewStyle,
    sectionTitle: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
      marginTop: 4,
    } as TextStyle,
    hint: {
      color: c.text3,
      fontSize: 12,
    } as TextStyle,
    label: {
      color: c.text2,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 6,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    } as TextStyle,
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 14,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: 'transparent',
    } as ViewStyle,
    chipOn: {
      backgroundColor: c.accentTint,
      borderColor: c.accent,
    } as ViewStyle,
    chipText: {
      color: c.text,
      fontSize: 13,
    } as TextStyle,
    empty: {
      color: c.text3,
      fontSize: 13,
      paddingVertical: 16,
      textAlign: 'center',
    } as TextStyle,
    spacer: {
      flex: 1,
    } as ViewStyle,
  })
}
