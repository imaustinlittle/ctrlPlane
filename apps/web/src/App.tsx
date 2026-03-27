import { useEffect } from 'react'
import { DashboardCanvas } from './components/DashboardCanvas'
import { Topbar }          from './components/Topbar'
import { SidePanel }       from './components/SidePanel'
import { ToastContainer }  from './components/Toast'
import { useDashboardStore } from './store'

export default function App() {
  const initFromAPI = useDashboardStore(s => s._initFromAPI)
  const isLoaded    = useDashboardStore(s => s.isLoaded)

  useEffect(() => { initFromAPI() }, []) // eslint-disable-line

  if (!isLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', gap: 12, color: 'var(--text2)', fontSize: 14 }}>
        <div style={{
          width: 32, height: 32,
          border: '2px solid var(--border)', borderTop: '2px solid var(--accent)',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
        <span>Loading ctrlPlane...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Topbar />
      <SidePanel />
      <DashboardCanvas />
      <ToastContainer />
    </div>
  )
}
