import { useCallback, useEffect, useRef, useState, useMemo, memo } from 'react'
import ReactGridLayout, { type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { useDashboardStore, useActivePage } from '../store'
import { getWidget } from '../widgets/registry'
import { WidgetCard } from './WidgetCard'
import type { WidgetInstance, WidgetLayout } from '../types'

const COLS  = 12
const MARGIN: [number, number] = [10, 10]

// Row height scales with viewport — fills screen comfortably at any resolution
// Target: ~14 rows visible at default zoom. Min 44px (touch targets), max 80px.
function calcRowHeight(): number {
  return Math.min(80, Math.max(44, Math.floor((window.innerHeight - 52) / 14)))
}

// ── Memoized widget card to avoid re-renders when sibling state changes ──────
const MemoWidgetCard = memo(function MemoWidgetCard({
  instance,
  pageId,
  isEditing,
}: {
  instance:  WidgetInstance
  pageId:    string
  isEditing: boolean
}) {
  const removeWidget = useDashboardStore(s => s.removeWidget)
  const def = getWidget(instance.type)
  if (!def) return null

  return (
    <WidgetCard
      definition={def}
      instance={instance}
      isEditing={isEditing}
      onRemove={() => removeWidget(pageId, instance.id)}
    />
  )
})

// Better version: takes widgets array so we can look up type by id
function applyDefinitionConstraints(
  layout: WidgetLayout[],
  widgets: WidgetInstance[]
): WidgetLayout[] {
  return layout.map(item => {
    const instance = widgets.find(w => w.id === item.i)
    if (!instance) return item
    const def = getWidget(instance.type)
    if (!def) return item

    // Dynamic min size from widget definition (e.g. based on config + current width)
    const dynamic = def.getMinSize?.(instance.config, { w: item.w })
    const minW = dynamic?.minW ?? def.minW ?? 1
    const minH = dynamic?.minH ?? def.minH ?? 1
    return {
      ...item,
      minW,
      minH,
      // Also clamp current size if somehow below minimum
      w: Math.max(item.w, minW),
      h: Math.max(item.h, minH),
    }
  })
}

export function DashboardCanvas() {
  const page         = useActivePage()
  const isEditing    = useDashboardStore(s => s.isEditing)
  const updateLayout = useDashboardStore(s => s.updateLayout)

  // Container-based width measurement — more accurate than window.innerWidth
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth]     = useState(window.innerWidth - 20)
  const [rowHeight, setRowHeight] = useState(calcRowHeight)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width)
      // rowHeight depends on viewport height, not container width
      // Only recalc on window resize, not every container resize
    })

    const onResize = () => setRowHeight(calcRowHeight())
    window.addEventListener('resize', onResize)
    ro.observe(el)
    return () => { ro.disconnect(); window.removeEventListener('resize', onResize) }
  }, [])

  // Prevent saving layout on initial mount fire from react-grid-layout
  const isMounted = useRef(false)
  useEffect(() => {
    isMounted.current = false
  }, [page.id])

  // Apply widget definition constraints to layout — runs on every render
  // but is cheap (just a .map) and ensures minW/minH are always correct
  const constrainedLayout = useMemo(
    () => applyDefinitionConstraints(page.layout, page.widgets),
    [page.layout, page.widgets]
  )

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      if (!isMounted.current) { isMounted.current = true; return }
      if (!isEditing) return
      // Re-apply constraints on save too, so persisted layout is always clean
      updateLayout(page.id, applyDefinitionConstraints(newLayout, page.widgets))
    },
    [page.id, page.widgets, isEditing, updateLayout]
  )

  // Center-based drag: position widget based on its center, not top-left
  const handleDrag = useCallback(
    (
      _layout: Layout[],
      _oldItem: Layout,
      newItem: Layout,
      _placeholder: Layout,
      event: MouseEvent,
      element: HTMLElement | null
    ) => {
      if (!element) return
      const grid = element.closest('.react-grid-layout') as HTMLElement | null
      if (!grid) return

      const gridW  = grid.offsetWidth
      const colW   = (gridW - (COLS - 1) * MARGIN[0]) / COLS
      const rowH   = rowHeight + MARGIN[1]
      const rect   = grid.getBoundingClientRect()
      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top

      const rawCol = mouseX / (colW + MARGIN[0]) - newItem.w / 2
      const rawRow = mouseY / rowH - newItem.h / 2

      newItem.x = Math.max(0, Math.min(COLS - newItem.w, Math.round(rawCol)))
      newItem.y = Math.max(0, Math.round(rawRow))
    },
    []
  )

  return (
    <div
      ref={containerRef}
      style={{ padding: '10px 10px 10px 28px', flex: 1, overflowY: 'auto' }}
      className={isEditing ? 'edit-mode' : ''}
    >
      <ReactGridLayout
        layout={constrainedLayout}
        cols={COLS}
        rowHeight={rowHeight}
        width={width}
        margin={MARGIN}
        containerPadding={[0, 0]}
        isDraggable={isEditing}
        isResizable={isEditing}
        preventCollision={false}
        compactType={'vertical'}
        onLayoutChange={handleLayoutChange}
        onDrag={handleDrag}
        draggableHandle=".widget-header"
        resizeHandles={['se']}
        useCSSTransforms
      >
        {page.widgets.map(instance => (
          <div key={instance.id}>
            <MemoWidgetCard
              instance={instance}
              pageId={page.id}
              isEditing={isEditing}
            />
          </div>
        ))}
      </ReactGridLayout>
    </div>
  )
}
