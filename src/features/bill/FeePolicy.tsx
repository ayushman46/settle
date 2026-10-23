import { useEffect, useId } from 'react'
import { SegmentedControl } from '../../components'
import { useT } from '../../i18n'
import type { FeeSplit } from '../../types'
import styles from './FeePolicy.module.css'

export interface FeePolicyProps {
  value: FeeSplit
  onChange: (value: FeeSplit) => void
  /** Id of the explanation under it (the radiogroup's description). */
  describedBy: string
}

/**
 * "How should fees be shared?" — Equally (between everyone who ordered) or By what each had. A
 * labelled radiogroup whose description is the explanation line under it.
 */
export function FeePolicy({ value, onChange, describedBy }: FeePolicyProps) {
  const t = useT()
  const labelId = useId()
  const groupId = useId()
  const label = t('delivery.paid.policy.label')

  // The design system's control takes a name, not a description: add it to the group itself.
  useEffect(() => {
    document.getElementById(groupId)?.setAttribute('aria-describedby', describedBy)
  }, [groupId, describedBy])

  return (
    <div className={styles.policy}>
      <p id={labelId} className={styles.label} aria-hidden="true">
        {label}
      </p>
      <SegmentedControl<FeeSplit>
        id={groupId}
        ariaLabel={label}
        value={value}
        onChange={onChange}
        options={[
          { value: 'equal', label: t('delivery.paid.policy.equal') },
          { value: 'proportional', label: t('delivery.paid.policy.proportional') },
        ]}
        className={styles.control}
      />
    </div>
  )
}
