/// <reference types="vite/client" />
import type { DesignCompareApi } from '../../shared/api'

declare global {
  interface Window {
    api: DesignCompareApi
  }
}
