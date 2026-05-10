export interface SiteConfig {
  logoUrl?: string
}

const config: SiteConfig = {
  logoUrl: import.meta.env.CHAM_LOGO_URL || undefined,
}

export function useSiteConfig(): SiteConfig {
  return config
}
