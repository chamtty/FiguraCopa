/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['sharp', '@napi-rs/canvas'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Garante que webpack não tenta empacotar módulos nativos
      const { externals } = config
      if (Array.isArray(externals)) {
        externals.push('@napi-rs/canvas')
      }
    }
    return config
  },
}

module.exports = nextConfig
