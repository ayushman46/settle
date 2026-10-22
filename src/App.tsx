import { Suspense, useLayoutEffect, useState, type ReactNode } from 'react'
import { AppShell, type AppShellProps } from './app/AppShell'
import { shouldOpenApp } from './app/launch'
import { HOME_PATH, isAppPath, publicPage } from './app/routes'
import { navigate, Redirect, useLocation } from './app/router'
import { ThemeSync } from './app/ThemeSync'
import { setLinkNavigator, ToastProvider } from './components'
import styles from './App.module.css'

export type AppProps = AppShellProps

/**
 * Settle, top to bottom: the app under `/app` (with its shell), the public pages — the sales
 * page at `/`, a friend's pay page at `/pay`, privacy and terms — and the person's theme on all of
 * them. Opening `/` from the installed app, or as a returning user on a phone, goes straight to
 * the app. Anything else unknown goes to `/`.
 */
export function App(props: AppProps) {
  const location = useLocation()
  // Decided once, for the page the visit started on; later visits to `/` show the sales page.
  const [openApp, setOpenApp] = useState(() => location.path === '/' && shouldOpenApp())
  if (openApp && location.path !== '/') setOpenApp(false)

  useLayoutEffect(() => {
    // Design-system links (section "See all", tab bar) navigate in place.
    setLinkNavigator((href) => navigate(href))
    return () => setLinkNavigator(null)
  }, [])

  let page: ReactNode
  if (isAppPath(location.path)) {
    page = <AppShell {...props} />
  } else {
    const match = publicPage(location.path)
    if (match === null) {
      page = <Redirect to="/" />
    } else if (match.key === 'landing' && openApp) {
      page = <Redirect to={HOME_PATH} />
    } else {
      const Page = match.page
      page = (
        <Suspense fallback={<div className={styles.publicFallback} aria-busy="true" />}>
          <Page key={match.key} />
        </Suspense>
      )
    }
  }

  return (
    <ToastProvider>
      <ThemeSync />
      {page}
    </ToastProvider>
  )
}
