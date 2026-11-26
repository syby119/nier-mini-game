import { ComponentPropsWithoutRef, useLayoutEffect, useRef } from 'react'
import styles from './GameDialogue.module.css'

export default function GameDialog({ children, className = '', ...props }: ComponentPropsWithoutRef<'dialog'>) {
  const ref = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog {...props} ref={ref} className={styles.scene + ' ' + className}
      onCancel={event => event.preventDefault()}>{children}</dialog>
  )
}
