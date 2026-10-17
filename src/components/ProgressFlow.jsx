import { useLayoutEffect, useRef, useState } from 'react'
import { ResponsiveContainer, Sankey } from 'recharts'

function positionFlowLabels(chart) {
  const svg = chart.querySelector('svg')
  if (!svg) return
  const columns = new Map()
  for (const element of svg.querySelectorAll('.progress-node-label')) {
    const box = element.getBBox()
    const column = element.dataset.column
    if (!columns.has(column)) columns.set(column, [])
    columns.get(column).push({ element, box, top: box.y })
  }
  // Pack measured two-line labels, not proportional nodes, leaving the flow untouched.
  const gap = 8
  for (const labels of columns.values()) {
    labels.sort((a, b) => a.box.y - b.box.y)
    let bottom = 4
    for (const label of labels) {
      label.top = Math.max(label.box.y, bottom)
      bottom = label.top + label.box.height + gap
    }
    bottom = svg.viewBox.baseVal.height - 4
    for (const label of labels.toReversed()) {
      label.top = Math.min(label.top, bottom - label.box.height)
      bottom = label.top - gap
      label.element.setAttribute('transform', `translate(0 ${label.top - label.box.y})`)
    }
  }
}

function FlowNode({ height, width, x, y, payload, index, onInspect }) {
  const above = payload.name === 'Reached interview'
  const left = payload.name === 'Applications'
  const labelX = above ? x + width / 2 : left ? x - 12 : x + width + 12
  const labelY = above ? y - 28 : y + height / 2 - 4
  const label = `${payload.name}: ${payload.count} applications`
  return (
    <g
      className="progress-flow-node"
      tabIndex={0}
      role="img"
      aria-label={label}
      style={{ '--reveal-delay': `${index * 80}ms` }}
      onFocus={() => onInspect({ node: payload.name })}
      onBlur={() => onInspect(null)}
      onMouseEnter={() => onInspect({ node: payload.name })}
      onMouseLeave={() => onInspect(null)}
    >
      <title>{label}</title>
      <rect fill={payload.color} x={x} y={y} width={width} height={height} rx={3} />
      <g className="progress-node-label" data-column={labelX}>
        <text
          className="progress-node-count"
          x={labelX}
          y={labelY}
          textAnchor={above ? 'middle' : left ? 'end' : 'start'}
        >
          {payload.count}
        </text>
        <text
          className="progress-node-name"
          x={labelX}
          y={labelY + 19}
          textAnchor={above ? 'middle' : left ? 'end' : 'start'}
        >
          {payload.name === 'Rejected before interview'
            ? 'Rejected before'
            : payload.name === 'Rejected after interview'
              ? 'Rejected after'
              : payload.name}
        </text>
      </g>
    </g>
  )
}

function FlowLink({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourceControlX,
  targetControlX,
  linkWidth,
  payload,
  index,
  onInspect,
}) {
  const label = `${payload.source.name} to ${payload.target.name}: ${payload.value} applications`
  return (
    <path
      className="recharts-sankey-link progress-flow-link"
      tabIndex={0}
      role="img"
      aria-label={label}
      d={`M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      stroke={payload.target.color}
      strokeWidth={linkWidth}
      fill="none"
      style={{ '--reveal-delay': `${250 + index * 80}ms` }}
      onFocus={() => onInspect({ source: payload.source.name, target: payload.target.name })}
      onBlur={() => onInspect(null)}
      onMouseEnter={() => onInspect({ source: payload.source.name, target: payload.target.name })}
      onMouseLeave={() => onInspect(null)}
    >
      <title>{label}</title>
    </path>
  )
}

export default function ProgressFlow({ data, summary, tablet }) {
  const chart = useRef(null)
  const [inspection, setInspection] = useState(null)
  useLayoutEffect(() => {
    const element = chart.current
    const layout = () => positionFlowLabels(element)
    const observer = new MutationObserver(layout)
    observer.observe(element, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['x', 'y'],
    })
    document.fonts.addEventListener('loadingdone', layout)
    layout()
    return () => {
      observer.disconnect()
      document.fonts.removeEventListener('loadingdone', layout)
    }
  }, [])
  const node = data.nodes.find((item) => item.name === inspection?.node)
  const link = data.links.find(
    (item) =>
      data.nodes[item.source].name === inspection?.source &&
      data.nodes[item.target].name === inspection?.target,
  )
  const caption = node
    ? `${node.name}: ${node.count} applications`
    : link
      ? `${inspection.source} to ${inspection.target}: ${link.value} applications`
      : ''
  return (
    <div
      className="progress-chart-scroll"
      role="group"
      aria-label={`Application flow: ${summary.applications} applications, ${summary.interviewedApplications} reached an interview, and ${summary.offers} received an offer.`}
    >
      <div className="progress-chart" ref={chart}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          initialDimension={{ width: 900, height: 340 }}
        >
          <Sankey
            data={data}
            align="left"
            iterations={0}
            nodeWidth={12}
            nodePadding={30}
            verticalAlign="top"
            margin={
              tablet
                ? { top: 54, bottom: 30, left: 86, right: 126 }
                : { top: 54, bottom: 30, left: 140, right: 170 }
            }
            node={<FlowNode onInspect={setInspection} />}
            link={<FlowLink onInspect={setInspection} />}
          />
        </ResponsiveContainer>
      </div>
      <p className="progress-inspection" role="status">
        {caption}
      </p>
    </div>
  )
}
