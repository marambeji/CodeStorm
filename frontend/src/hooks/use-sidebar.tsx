import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

/** État de la sidebar desktop (dépliée / repliée), mémorisé dans le navigateur. */
interface SidebarState {
  collapsed: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarState>({ collapsed: false, toggle: () => {} })
const KEY = 'sidebar-collapsed'

export const SIDEBAR_WIDTH = { expanded: 256, collapsed: 76 }

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(KEY, c ? '0' : '1')
      } catch {
        /* non bloquant */
      }
      return !c
    })
  }, [])

  return <SidebarContext.Provider value={{ collapsed, toggle }}>{children}</SidebarContext.Provider>
}

export const useSidebar = () => useContext(SidebarContext)
