/** @param {{ config: import('expo/config').ExpoConfig }} ctx */
module.exports = ({ config }) => ({
  ...config,
  // Expo Go draws `name` under the splash icon. The logo already includes
  // GatetouchPro, so hide that extra label in Go. Installed builds keep it.
  name: process.env.EAS_BUILD ? 'GatetouchPro' : '\u200b',
})
