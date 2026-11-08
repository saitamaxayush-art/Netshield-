/**
 * Shared pieces for showing API results honestly: where a result came from, whether it is out of
 * date, and what went wrong (with Retry, and an explicit, opt in switch to demo mode).
 */
import React from 'react'
import { AlertTriangle, RotateCcw, Clock } from 'lucide-react'
import type { ApiError } from '@/services/api/client'
import { useSettingsStore } from '@/store/settingsStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

/** Friendlier headings for codes where the kind alone is too vague. */
const CODE_LABEL: Record<string, string> = {
  LIMIT_EXCEEDED: 'Network too large for the server',
  PAYLOAD_TOO_LARGE: 'Request too large for the server',
  CLIENT_VALIDATION: 'Not sent: the network breaks a rule',
  TIMEOUT: 'The server ran out of time',
}

const KIND_LABEL: Record<ApiError['kind'], string> = {
  network: 'Backend unreachable',
  timeout: 'Request timed out',
  cancelled: 'Request cancelled',
  validation: 'Request rejected',
  server: 'Backend error',
  invalid_response: 'Unexpected response',
}

export const SourceBadge: React.FC<{ isDemo: boolean; testId: string; backendLabel: string }> = ({ isDemo, testId, backendLabel }) => (
  <Badge variant={isDemo ? 'warning' : 'accent'} size="sm" data-testid={testId} data-source={isDemo ? 'demo' : 'backend'}>
    {isDemo ? 'Demo result' : backendLabel}
  </Badge>
)

export const StaleNotice: React.FC<{ testId: string; onRefresh: () => void; isLoading: boolean; disabledReason?: string }> = ({ testId, onRefresh, isLoading, disabledReason }) => (
  <div
    role="status"
    data-testid={testId}
    className="p-2.5 bg-state-warning-dim border border-state-warning/40 rounded-[2px] text-state-warning flex items-center justify-between gap-2 text-[11px]"
  >
    <span className="flex items-center gap-1.5">
      <Clock className="w-3.5 h-3.5" />
      Results out of date: the network or settings changed after they were computed.{disabledReason ? ` ${disabledReason}` : ''}
    </span>
    <Button variant="outline" size="sm" isLoading={isLoading} onClick={onRefresh} disabled={disabledReason !== undefined}>
      Update
    </Button>
  </div>
)

export const ApiErrorBox: React.FC<{ title: string; error: ApiError; testId: string; onRetry: () => void; hint?: string }> = ({ title, error, testId, onRetry, hint }) => {
  const adapterMode = useSettingsStore((s) => s.adapterMode)
  const switchToDemoMode = useSettingsStore((s) => s.switchToDemoMode)
  const unreachable = error.isNetworkError || error.isTimeout
  return (
    <div
      role="alert"
      data-testid={testId}
      data-error-kind={error.kind}
      data-error-code={error.code}
      className="p-3 bg-state-failure-dim border border-state-failure/40 rounded-[2px] text-state-failure space-y-2"
    >
      <div className="flex items-center gap-1.5 font-semibold text-xs">
        <AlertTriangle className="w-4 h-4" />
        <span>
          {title}: {CODE_LABEL[error.code] ?? KIND_LABEL[error.kind]}
        </span>
      </div>
      <p className="text-[11px]">{error.message}</p>
      {hint && (
        <p className="text-[11px]" data-testid={`${testId}-hint`}>
          {hint}
        </p>
      )}
      <p className="text-[11px]">No result is shown. Nothing was computed in the browser.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" leftIcon={<RotateCcw className="w-3 h-3" />} onClick={onRetry}>
          Retry
        </Button>
        {unreachable && adapterMode === 'backend' && (
          <Button variant="ghost" size="sm" onClick={switchToDemoMode} title="Compute labelled demo results in the browser instead">
            Switch to demo mode
          </Button>
        )}
      </div>
    </div>
  )
}
