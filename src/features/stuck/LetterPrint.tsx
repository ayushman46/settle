/**
 * The letter on paper (or as a PDF from the print dialog), for handing in at a branch: the text, a
 * line to sign, and — for the bank — a second copy for them to sign or stamp as received. Mounted
 * when Print is tapped; while it's mounted the page prints only this (RaiseSheet.module.css).
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { printPage } from '../../lib/nativeApp'
import { PRINT_LINES } from './letters'
import styles from './RaiseSheet.module.css'

export function LetterPrint({ text, title, ackCopy }: { text: string; title: string; ackCopy: boolean }) {
  useEffect(() => {
    const body = document.body
    const printing = styles.printing || 'printing'
    const done = (): void => body.classList.remove(printing)
    body.classList.add(printing)
    window.addEventListener('afterprint', done)
    printPage(title)
    return () => {
      window.removeEventListener('afterprint', done)
      done()
    }
    // Prints once, when mounted (each Print tap mounts a fresh one).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div className={styles.print} lang="en">
      <div className={styles.printText}>{text}</div>
      <p className={styles.printLine}>{PRINT_LINES.signature}</p>
      {ackCopy && (
        <div className={styles.printCopy}>
          <p className={styles.printLine}>{PRINT_LINES.ackCopy}</p>
          <div className={styles.printText}>{text}</div>
          <p className={styles.printLine}>{PRINT_LINES.signature}</p>
          <p className={styles.printLine}>{PRINT_LINES.receivedBy}</p>
        </div>
      )}
    </div>,
    document.body,
  )
}
