import { Badge } from '../../components'
import { BRAND } from '../../domain/types'
import { cx } from '../../lib/cx'
import { FeatureVisual } from './FeatureVisuals'
import { FEATURES } from './featureList'
import styles from './Features.module.css'
import page from './LandingPage.module.css'

/** "Everything a split needs": the ten signature features as a bento grid of mini mockups. */
export function Features() {
  return (
    <section id="features" className={page.section} aria-labelledby="features-title">
      <div className={page.sectionHead}>
        <p className={page.eyebrow}>Why {BRAND.name}</p>
        <h2 id="features-title" className={page.h2}>
          One app for every split
        </h2>
        <p className={page.lede}>
          From a ₹90 chai run to a month’s rent — and the part everyone dreads: actually getting paid back.
        </p>
      </div>
      <ul className={styles.grid} role="list">
        {FEATURES.map((feature) => (
          <li key={feature.id} className={cx(styles.tile, styles[feature.size])}>
            <FeatureVisual id={feature.id} />
            <div className={styles.text}>
              <p className={styles.eyebrow}>
                {feature.eyebrow}
                {feature.pro && <Badge tone="pro">Pro</Badge>}
              </p>
              <h3 className={styles.title}>{feature.title}</h3>
              <p className={styles.body}>{feature.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
