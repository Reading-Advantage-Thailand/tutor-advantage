import { GoogleAnalytics } from "@next/third-parties/google"

import { env } from "@/env.mjs"

export function Analytics() {
  return <GoogleAnalytics gaId={env.GOOGLE_ANALYTICS_ID} />
}
