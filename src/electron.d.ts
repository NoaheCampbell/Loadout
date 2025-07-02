interface ElectronAPI {
  closeWindow: () => void
  minimizeWindow: () => void
  maximizeWindow: () => void
  platform: NodeJS.Platform
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}

export {} 