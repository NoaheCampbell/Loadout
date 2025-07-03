import React, { useEffect, useState, useRef } from 'react'
import mermaid from 'mermaid'
import { ipc } from '../../lib/ipc'
import { ZoomIn, ZoomOut, Maximize2, Move } from 'lucide-react'

interface WorkflowDebugInfo {
  nodes: Array<{ name: string; description: string; validations: string[] }>
  edges: Array<{ from: string; to: string; condition?: string }>
  parallelGroups: Array<{ name: string; nodes: string[] }>
}

export function WorkflowTab() {
  const [diagram, setDiagram] = useState<string>('')
  const [debugInfo, setDebugInfo] = useState<WorkflowDebugInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const mermaidRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Zoom and pan state
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    // Initialize mermaid
    mermaid.initialize({ 
      theme: 'default',
      themeVariables: {
        primaryColor: '#4dabf7',
        primaryTextColor: '#fff',
        primaryBorderColor: '#1864ab',
        lineColor: '#6c757d',
        secondaryColor: '#51cf66',
        tertiaryColor: '#be4bdb',
        background: '#f8f9fa',
        mainBkg: '#4dabf7',
        secondBkg: '#51cf66',
        tertiaryBkg: '#be4bdb',
        errorBkgColor: '#ff6b6b',
        errorTextColor: '#fff',
        warningBkgColor: '#fab005',
        warningTextColor: '#000'
      }
    })
    
    // Load workflow visualization
    loadWorkflowVisualization()
  }, [])

  useEffect(() => {
    if (diagram && mermaidRef.current) {
      // Clear previous content
      mermaidRef.current.innerHTML = ''
      
      // Create a unique ID for this diagram
      const id = `mermaid-${Date.now()}`
      
      // Create a div for the diagram
      const div = document.createElement('div')
      div.id = id
      div.innerHTML = diagram
      mermaidRef.current.appendChild(div)
      
      // Render the diagram
      mermaid.init(undefined, div)
    }
  }, [diagram])

  // Mouse wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (containerRef.current && containerRef.current.contains(e.target as Node)) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? 0.9 : 1.1
        setScale(prevScale => Math.min(Math.max(0.1, prevScale * delta), 5))
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [])

  const loadWorkflowVisualization = async () => {
    try {
      setLoading(true)
      const result = await ipc.invoke('workflow:visualize')
      
      if (result.success) {
        setDiagram(result.diagram)
        setDebugInfo(result.debugInfo)
      } else {
        setError(result.error || 'Failed to load workflow visualization')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow visualization')
    } finally {
      setLoading(false)
    }
  }

  const getNodeInfo = (nodeName: string) => {
    return debugInfo?.nodes.find(n => n.name === nodeName)
  }

  // Zoom controls
  const handleZoomIn = () => {
    setScale(prevScale => Math.min(prevScale * 1.2, 5))
  }

  const handleZoomOut = () => {
    setScale(prevScale => Math.max(prevScale * 0.8, 0.1))
  }

  const handleResetView = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  // Pan/drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left click only
      setIsDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })
      setStartPosition(position)
      e.preventDefault()
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const deltaX = e.clientX - dragStart.x
      const deltaY = e.clientY - dragStart.y
      setPosition({
        x: startPosition.x + deltaX,
        y: startPosition.y + deltaY
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp)
      return () => document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading workflow visualization...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-700 dark:text-gray-300 font-medium">Failed to load workflow</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{error}</p>
          <button
            onClick={loadWorkflowVisualization}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Main diagram area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Visual representation of the Loadout project generation workflow with validation steps
            </p>
            
            {/* Zoom controls */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-1">
                <button
                  onClick={handleZoomOut}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
                <span className="px-2 text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[3rem] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
                <button
                  onClick={handleResetView}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Reset view"
                >
                  <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 relative overflow-hidden bg-gray-50 dark:bg-gray-900">
          {/* Instructions overlay */}
          <div className="absolute top-4 left-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 max-w-xs">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Move className="w-4 h-4" />
              <span>Click and drag to pan • Scroll to zoom</span>
            </div>
          </div>
          
          <div 
            ref={containerRef}
            className="w-full h-full overflow-hidden cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <div 
              ref={mermaidRef} 
              className="transform origin-center transition-transform duration-100"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                minHeight: '800px',
                minWidth: '1200px'
              }}
            />
          </div>
        </div>
      </div>

      {/* Debug info panel */}
      <div className="w-96 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Workflow Details</h3>
          
          {/* Node selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select a node to view details:
            </label>
            <select
              value={selectedNode || ''}
              onChange={(e) => setSelectedNode(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select a node --</option>
              {debugInfo?.nodes.map(node => (
                <option key={node.name} value={node.name}>
                  {node.name}
                </option>
              ))}
            </select>
          </div>

          {/* Node details */}
          {selectedNode && (
            <div className="space-y-4">
              {(() => {
                const node = getNodeInfo(selectedNode)
                if (!node) return null
                
                return (
                  <>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-1">Description</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{node.description}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Validations</h4>
                      <ul className="space-y-1">
                        {node.validations.map((validation, idx) => (
                          <li key={idx} className="flex items-start text-sm">
                            <span className="text-green-500 mr-2 mt-0.5">✓</span>
                            <span className="text-gray-600 dark:text-gray-400">{validation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {/* Parallel groups */}
          {debugInfo?.parallelGroups && debugInfo.parallelGroups.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Parallel Execution Groups</h4>
              {debugInfo.parallelGroups.map((group, idx) => (
                <div key={idx} className="mb-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{group.name}:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {group.nodes.map(node => (
                      <span
                        key={node}
                        className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 
                                 text-purple-700 dark:text-purple-300 rounded"
                      >
                        {node}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Color Legend</h4>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <div className="w-4 h-4 rounded bg-[#4dabf7] mr-2"></div>
                <span className="text-gray-600 dark:text-gray-400">Process nodes</span>
              </div>
              <div className="flex items-center text-sm">
                <div className="w-4 h-4 rounded bg-[#be4bdb] mr-2"></div>
                <span className="text-gray-600 dark:text-gray-400">Parallel execution</span>
              </div>
              <div className="flex items-center text-sm">
                <div className="w-4 h-4 rounded bg-[#fab005] mr-2"></div>
                <span className="text-gray-600 dark:text-gray-400">Validation steps</span>
              </div>
              <div className="flex items-center text-sm">
                <div className="w-4 h-4 rounded bg-[#51cf66] mr-2"></div>
                <span className="text-gray-600 dark:text-gray-400">Success states</span>
              </div>
              <div className="flex items-center text-sm">
                <div className="w-4 h-4 rounded bg-[#ff6b6b] mr-2"></div>
                <span className="text-gray-600 dark:text-gray-400">Error states</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 