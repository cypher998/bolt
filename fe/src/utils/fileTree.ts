import type { DirectoryNode, FileSystemTree } from '@webcontainer/api'
import type { ProjectFiles } from '../types'

/** Converts the flat file map into the nested tree WebContainer.mount() expects. */
export function toFileSystemTree(files: ProjectFiles): FileSystemTree {
  const root: FileSystemTree = {}

  for (const [path, contents] of Object.entries(files)) {
    const parts = path.split('/').filter(Boolean)
    const fileName = parts.pop()
    if (!fileName) continue

    let dir = root
    for (const part of parts) {
      const existing = dir[part]
      if (!existing || !('directory' in existing)) {
        dir[part] = { directory: {} }
      }
      dir = (dir[part] as DirectoryNode).directory
    }
    dir[fileName] = { file: { contents } }
  }

  return root
}

export interface TreeNode {
  name: string
  path: string
  children?: TreeNode[]
}

/** Builds a sorted folder/file tree for the file explorer. */
export function toTreeNodes(files: ProjectFiles): TreeNode[] {
  const root: TreeNode = { name: '', path: '', children: [] }

  for (const path of Object.keys(files)) {
    const parts = path.split('/').filter(Boolean)
    let node = root
    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1
      let child = node.children!.find((c) => c.name === part)
      if (!child) {
        child = {
          name: part,
          path: parts.slice(0, index + 1).join('/'),
          ...(isFile ? {} : { children: [] }),
        }
        node.children!.push(child)
      }
      node = child
    })
  }

  const sort = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .sort((a, b) =>
        a.children && !b.children ? -1 : !a.children && b.children ? 1 : a.name.localeCompare(b.name),
      )
      .map((n) => (n.children ? { ...n, children: sort(n.children) } : n))

  return sort(root.children!)
}
