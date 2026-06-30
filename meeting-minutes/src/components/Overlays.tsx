interface BusyProps { msg: string | null }
export function Busy({ msg }: BusyProps) {
  return (
    <div className={'busy' + (msg ? ' show' : '')}>
      <div className="busybox"><span className="spin" /><span>{msg || 'Working…'}</span></div>
    </div>
  )
}

interface ToastProps { msg: string }
export function Toast({ msg }: ToastProps) {
  return <div className={'toast' + (msg ? ' show' : '')}>{msg}</div>
}
