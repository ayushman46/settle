import type { ReactNode } from 'react'
import { cx } from '../lib/cx'
import styles from './Illustration.module.css'

export type IllustrationName =
  | 'empty-activity'
  | 'empty-groups'
  | 'empty-insights'
  | 'welcome-scan'
  | 'welcome-split'
  | 'welcome-settle'
  | 'offline'

export interface IllustrationProps {
  name: IllustrationName
  /** Width in px (height is 4/5 of it); shrinks to fit narrow containers. Default 168. */
  size?: number
  /** Accessible description. Omit when it's decoration beside text that says the same (the usual case). */
  title?: string
  className?: string
}

/** A four-pointed sparkle centred on (x, y). */
function Sparkle({ x, y, r, className = styles.accent }: { x: number; y: number; r: number; className?: string }) {
  const k = r * 0.22
  return (
    <path
      className={cx(className, styles.outline, styles.sparkle)}
      d={`M${x} ${y - r} C${x + k} ${y - k} ${x + k} ${y - k} ${x + r} ${y} C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + r} C${x - k} ${y + k} ${x - k} ${y + k} ${x - r} ${y} C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - r}Z`}
    />
  )
}

/** A stylised rupee mark inside a coin centred on (x, y). */
function Coin({ x, y, r }: { x: number; y: number; r: number }) {
  const s = r / 22
  return (
    <g className={styles.coin}>
      <circle className={cx(styles.accent, styles.outline)} cx={x} cy={y} r={r} />
      <circle className={styles.coinRim} cx={x} cy={y} r={r - 5 * s} />
      <path
        className={styles.stroke}
        d={`M${x - 7 * s} ${y - 9 * s}h${14 * s}M${x - 7 * s} ${y - 3 * s}h${14 * s}M${x - 3 * s} ${y - 9 * s}c${7 * s} 0 ${7 * s} ${9 * s} 0 ${9 * s}h${-4 * s}l${9 * s} ${10 * s}`}
        style={{ strokeWidth: 2.75 * s }}
      />
    </g>
  )
}

/** A friendly faceless person: shoulders + head, standing on y = `base`. */
function Person({ x, base, scale = 1, tone }: { x: number; base: number; scale?: number; tone: string | undefined }) {
  const w = 24 * scale
  const head = 12.5 * scale
  return (
    <g>
      <path
        className={cx(tone, styles.outline)}
        d={`M${x - w} ${base} v-${4 * scale} a${w} ${20 * scale} 0 0 1 ${2 * w} 0 v${4 * scale} z`}
      />
      <circle className={cx(tone, styles.outline)} cx={x} cy={base - 34 * scale} r={head} />
    </g>
  )
}

const BLOB = 'M28 94C22 54 58 18 104 20c46 2 78 30 72 72-6 38-42 58-78 54-40-4-64-18-70-52Z'

const ART: Readonly<Record<IllustrationName, () => ReactNode>> = {
  'empty-activity': () => (
    <>
      <path className={styles.blob} d={BLOB} />
      <ellipse className={styles.shadow} cx="102" cy="146" rx="46" ry="5" />
      <g className={styles.float}>
        <path
          className={cx(styles.paper, styles.outline)}
          d="M60 30q0-8 8-8h68q8 0 8 8v94l-6 6-6-6-6 6-6-6-6 6-6-6-6 6-6-6-6 6-6-6-6 6-6-6-6 6-6-6Z"
        />
        <rect className={styles.ink} x="72" y="36" width="34" height="7" rx="3.5" />
        <rect className={styles.faint} x="72" y="52" width="58" height="6" rx="3" />
        <rect className={styles.faint} x="72" y="64" width="44" height="6" rx="3" />
        <rect className={styles.faint} x="72" y="76" width="52" height="6" rx="3" />
        <path className={styles.dash} d="M70 92h64" />
        <rect className={styles.faint} x="72" y="102" width="22" height="7" rx="3.5" />
        <rect className={styles.ink} x="104" y="101" width="28" height="9" rx="4.5" />
      </g>
      <Coin x={148} y={114} r={21} />
      <Sparkle x={44} y={40} r={11} />
      <Sparkle x={160} y={36} r={6} className={styles.inkFill} />
      <Sparkle x={36} y={112} r={5} className={styles.inkFill} />
    </>
  ),

  'empty-groups': () => (
    <>
      <path className={styles.blob} d={BLOB} />
      <ellipse className={styles.shadow} cx="100" cy="140" rx="64" ry="5" />
      <Person x={62} base={128} scale={0.86} tone={styles.av2} />
      <Person x={138} base={128} scale={0.86} tone={styles.av1} />
      <Person x={100} base={136} tone={styles.av0} />
      <g className={styles.pop}>
        <circle className={cx(styles.accent, styles.outline)} cx="152" cy="44" r="16" />
        <path className={styles.stroke} d="M152 37v14M145 44h14" />
      </g>
      <Sparkle x={42} y={44} r={9} />
      <Sparkle x={124} y={26} r={5} className={styles.inkFill} />
    </>
  ),

  'empty-insights': () => (
    <>
      <path className={styles.blob} d={BLOB} />
      <ellipse className={styles.shadow} cx="100" cy="140" rx="58" ry="5" />
      <rect className={cx(styles.paper, styles.outline)} x="38" y="28" width="124" height="104" rx="16" />
      <circle className={styles.trackRing} cx="78" cy="68" r="17" />
      <circle className={cx(styles.ring, styles.ringFood)} cx="78" cy="68" r="17" pathLength="100" strokeDasharray="44 56" />
      <circle
        className={cx(styles.ring, styles.ringTravel)}
        cx="78"
        cy="68"
        r="17"
        pathLength="100"
        strokeDasharray="28 72"
        strokeDashoffset="-48"
      />
      <circle
        className={cx(styles.ring, styles.ringAccent)}
        cx="78"
        cy="68"
        r="17"
        pathLength="100"
        strokeDasharray="16 84"
        strokeDashoffset="-80"
      />
      <path className={styles.dash} d="M110 90h40" />
      <rect className={cx(styles.faint, styles.grow)} x="112" y="68" width="9" height="22" rx="3" />
      <rect className={cx(styles.ink, styles.grow)} x="126" y="52" width="9" height="38" rx="3" />
      <rect className={cx(styles.accent, styles.outlineThin, styles.grow)} x="140" y="60" width="9" height="30" rx="3" />
      <rect className={styles.ink} x="54" y="102" width="46" height="7" rx="3.5" />
      <rect className={styles.faint} x="54" y="114" width="70" height="6" rx="3" />
      <Sparkle x={168} y={30} r={10} />
      <Sparkle x={30} y={52} r={5} className={styles.inkFill} />
    </>
  ),

  'welcome-scan': () => (
    <>
      <path className={styles.blob} d={BLOB} />
      <ellipse className={styles.shadow} cx="100" cy="152" rx="40" ry="4" />
      <rect className={cx(styles.paper, styles.outline)} x="64" y="10" width="72" height="138" rx="16" />
      <rect className={styles.inkFill} x="90" y="17" width="20" height="5" rx="2.5" />
      <path className={cx(styles.paper, styles.outlineThin)} d="M78 36h44v70l-5.5 5-5.5-5-5.5 5-5.5-5-5.5 5-5.5-5-5.5 5-5.5-5Z" />
      <rect className={styles.ink} x="85" y="44" width="20" height="5" rx="2.5" />
      <rect className={styles.faint} x="85" y="56" width="30" height="4" rx="2" />
      <rect className={styles.faint} x="85" y="65" width="24" height="4" rx="2" />
      <rect className={styles.faint} x="85" y="74" width="28" height="4" rx="2" />
      <rect className={styles.ink} x="99" y="88" width="16" height="6" rx="3" />
      <path className={styles.bracket} d="M72 40v-8h8M128 40v-8h-8M72 104v8h8M128 104v8h-8" />
      <g className={styles.scan}>
        <rect className={styles.scanGlow} x="70" y="60" width="60" height="14" rx="7" />
        <rect className={styles.accent} x="70" y="66" width="60" height="3" rx="1.5" />
      </g>
      <rect className={cx(styles.accent, styles.outline)} x="84" y="124" width="32" height="12" rx="6" />
      <Sparkle x={42} y={38} r={10} />
      <Sparkle x={160} y={110} r={7} />
      <Sparkle x={158} y={34} r={4.5} className={styles.inkFill} />
    </>
  ),

  'welcome-split': () => (
    <>
      <path className={styles.blob} d={BLOB} />
      <ellipse className={styles.shadow} cx="100" cy="140" rx="52" ry="5" />
      <g className={styles.spin}>
        <path className={cx(styles.av0, styles.outline)} d="M100 82V34a48 48 0 0 1 41.57 72Z" />
        <path className={cx(styles.av1, styles.outline)} d="M100 82l41.57 24a48 48 0 0 1-83.14 0Z" />
        <path className={cx(styles.av2, styles.outline)} d="M100 82l-41.57 24A48 48 0 0 1 100 34Z" />
        <circle className={cx(styles.paper, styles.outline)} cx="100" cy="82" r="13" />
        <path className={styles.stroke} d="M95 77h10M95 82h10M97 77c5 0 5 5 0 5h-1l6 6" style={{ strokeWidth: 2.25 }} />
      </g>
      <circle className={cx(styles.av0, styles.outline)} cx="160" cy="40" r="11" />
      <circle className={cx(styles.av1, styles.outline)} cx="164" cy="124" r="11" />
      <circle className={cx(styles.av2, styles.outline)} cx="36" cy="118" r="11" />
      <Sparkle x={40} y={42} r={10} />
      <Sparkle x={132} y={20} r={4.5} className={styles.inkFill} />
    </>
  ),

  'welcome-settle': () => (
    <>
      <path className={styles.blob} d={BLOB} />
      <ellipse className={styles.shadow} cx="100" cy="146" rx="62" ry="5" />
      <Person x={48} base={124} scale={0.9} tone={styles.av0} />
      <Person x={152} base={124} scale={0.9} tone={styles.av1} />
      <path className={cx(styles.stroke, styles.travel)} d="M68 70C80 40 120 40 132 70" />
      <path className={styles.stroke} d="M124 66l8 5 2-9" />
      <Coin x={100} y={46} r={15} />
      <rect className={cx(styles.paper, styles.outline)} x="80" y="96" width="40" height="40" rx="8" />
      <path
        className={styles.inkFill}
        d="M86 102h10v10H86zM104 102h10v10h-10zM86 120h10v10H86zM100 116h4v4h-4zM106 122h8v4h-8zM110 116h4v4h-4zM100 126h4v4h-4z"
      />
      <g className={styles.pop}>
        <circle className={cx(styles.positive, styles.outline)} cx="168" cy="54" r="13" />
        <path className={styles.checkMark} d="M162 54.5l4 4 8-8.5" />
      </g>
      <Sparkle x={34} y={40} r={9} />
      <Sparkle x={124} y={18} r={4.5} className={styles.inkFill} />
    </>
  ),

  offline: () => (
    <>
      <path className={styles.blob} d={BLOB} />
      <ellipse className={styles.shadow} cx="100" cy="138" rx="52" ry="5" />
      <path className={styles.wave} d="M66 116a48 48 0 0 1 68 0M78 128a30 30 0 0 1 44 0" />
      <path
        className={cx(styles.paper, styles.outline)}
        d="M62 96a22 22 0 0 1 4-43.6A30 30 0 0 1 124 46a24 24 0 0 1 18 46 6 6 0 0 1-4 4Z"
      />
      <path className={styles.slash} d="M56 30l92 84" />
      <circle className={styles.inkFill} cx="100" cy="134" r="4" />
      <Sparkle x={160} y={36} r={8} />
      <Sparkle x={38} y={44} r={4.5} className={styles.inkFill} />
    </>
  ),
}

/**
 * Spot illustrations in the brand style — ink outlines, soft fills, accent sparkles — drawn
 * entirely from theme tokens, so they look right in light, dark and every accent. Decorative
 * unless given a `title`. Gently animated on first paint (static with reduced motion).
 */
export function Illustration({ name, size = 168, title, className }: IllustrationProps) {
  const draw = ART[name] ?? ART['empty-activity']
  const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true }
  return (
    <svg
      {...a11y}
      viewBox="0 0 200 160"
      width={size}
      height={(size * 4) / 5}
      className={cx(styles.art, className)}
      data-illustration={name}
      focusable="false"
    >
      {draw()}
    </svg>
  )
}
