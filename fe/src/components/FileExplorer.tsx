import { useState } from 'react'
import type { TreeNode } from '../utils/fileTree'

interface FileExplorerProps {
  nodes: TreeNode[]
  selectedPath?: string
  onSelect: (path: string) => void
}

export function FileExplorer({ nodes, selectedPath, onSelect }: FileExplorerProps) {
  return (
    <ul className="tree">
      {nodes.map((node) => (
        <TreeItem key={node.path} node={node} selectedPath={selectedPath} onSelect={onSelect} />
      ))}
    </ul>
  )
}

function TreeItem({ node, selectedPath, onSelect }: { node: TreeNode } & Omit<FileExplorerProps, 'nodes'>) {
  const [open, setOpen] = useState(true)

  if (!node.children) {
    return (
      <li>
        <button
          type="button"
          className={`tree-item ${node.path === selectedPath ? 'selected' : ''}`}
          onClick={() => onSelect(node.path)}
        >
          📄 {node.name}
        </button>
      </li>
    )
  }

  return (
    <li>
      <button type="button" className="tree-item" onClick={() => setOpen(!open)}>
        {open ? '📂' : '📁'} {node.name}
      </button>
      {open && <FileExplorer nodes={node.children} selectedPath={selectedPath} onSelect={onSelect} />}
    </li>
  )
}
