"use client";

import { useMemo } from "react";
import type { ArchitectOutput } from "@/lib/agents/schemas";

type Node = ArchitectOutput["nodes"][number];
type NodeWithChildren = Node & { children: NodeWithChildren[] };

function buildTree(nodes: ArchitectOutput["nodes"]): NodeWithChildren[] {
  const map = new Map<string, NodeWithChildren>();
  for (const n of nodes) {
    map.set(n.id, { ...n, children: [] });
  }
  const roots: NodeWithChildren[] = [];
  for (const n of nodes) {
    const node = map.get(n.id);
    if (!node) continue;
    if (n.parentId == null || n.parentId === "") {
      roots.push(node);
    } else {
      const parent = map.get(n.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }
  return roots;
}

function NodeRow({ node }: { node: NodeWithChildren }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1">
      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
        &lt;{node.htmlElement}&gt;
      </span>
      <span className="font-medium text-gray-900">{node.name}</span>
      <span className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-600">
        {node.role}
      </span>
    </div>
  );
}

function ChildList({ nodes }: { nodes: NodeWithChildren[] }) {
  if (nodes.length === 0) return null;
  return (
    <ul className="relative mt-0.5 ml-1 space-y-0 border-l border-gray-300 pl-4">
      {nodes.map((node) => (
        <li key={node.id} className="relative list-none">
          <span
            className="absolute left-0 top-[13px] h-px w-[15px] -translate-x-full bg-gray-300"
            aria-hidden
          />
          <div title={node.purpose}>
            <NodeRow node={node} />
          </div>
          {node.children.length > 0 ? (
            <ChildList nodes={node.children} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

type Props = {
  architect: ArchitectOutput;
};

export function ComponentTreeView({ architect }: Props) {
  const roots = useMemo(
    () => buildTree(architect.nodes),
    [architect.nodes],
  );

  if (roots.length === 0) {
    return (
      <p className="text-sm text-gray-500">No component nodes were returned.</p>
    );
  }

  return (
    <div className="rounded-md border border-gray-300 bg-white p-4">
      <p className="mb-3 text-sm font-medium text-gray-800">
        {architect.pageTitle}
      </p>
      <ul className="space-y-1">
        {roots.map((node) => (
          <li key={node.id} className="list-none">
            <div title={node.purpose}>
              <NodeRow node={node} />
            </div>
            {node.children.length > 0 ? (
              <ChildList nodes={node.children} />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
