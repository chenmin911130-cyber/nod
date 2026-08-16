import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const PILL =
  'inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 backdrop-blur-md shadow-sm';

export function CopilotIndicator(props) {
  const {
    property,
    busy,
    imageBusy,
    responseTokens,
    isReconnecting,
    paused,
    isMockSession,
  } = props;
  const [reconnectingDuration, setReconnectingDuration] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const TIMEOUT_THRESHOLD = 60; // Show refresh button after 60 seconds of trying to reconnect

  // Track how long we've been reconnecting
  useEffect(() => {
    let timer = null;

    if (isReconnecting) {
      timer = setInterval(() => {
        setReconnectingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setReconnectingDuration(0);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isReconnecting]);

  // Desktop-specific: refresh via URL param to preserve session state
  const handleRefresh = () => {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('refresh', Date.now().toString());
    window.location.href = currentUrl.toString();
  };

  if (!property) {
    return (
      <div className={PILL}>
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></span>
        <span className="text-[11px] font-medium text-red-400">
          Initializing…
        </span>
      </div>
    );
  }

  if (isReconnecting) {
    return (
      <div className={PILL}>
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent"></span>
        <span className="text-[11px] font-medium text-yellow-400">
          {reconnectingDuration < TIMEOUT_THRESHOLD
            ? `Reconnecting (${reconnectingDuration}s)…`
            : 'Connection issue detected'}
        </span>
        {reconnectingDuration >= TIMEOUT_THRESHOLD && (
          <div className="relative">
            <button
              onClick={handleRefresh}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
              className="ml-1 rounded-full bg-cyan-500 px-2 py-0.5 text-[11px] font-semibold text-white transition-colors hover:bg-cyan-600"
              aria-label="Refresh page and reconnect the entire session"
            >
              Refresh
            </button>
            {showTooltip && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1 text-xs bg-gray-800 text-white rounded shadow whitespace-nowrap z-10">
                This will reconnect the whole session
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-800 transform rotate-45"></div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (responseTokens?.transcript !== '' && responseTokens?.isFinal !== true) {
    return (
      <div className={PILL}>
        <span className="border-design-orange h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent"></span>
        <span className="text-design-orange text-[11px] font-medium">
          Transcribing…
        </span>
      </div>
    );
  }

  if (busy || imageBusy) {
    return (
      <div className={PILL}>
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent"></span>
        <span className="text-[11px] font-medium text-cyan-300">
          AI is working…
        </span>
      </div>
    );
  }

  if (isMockSession) {
    return (
      <div className={PILL}>
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
        </span>
        <span className="text-[11px] font-medium text-emerald-200">
          Recording
        </span>
      </div>
    );
  }

  if (paused) {
    return (
      <div className={PILL}>
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
        <span className="text-[11px] font-medium text-amber-200">
          Manual Mode
        </span>
      </div>
    );
  }

  return (
    <div className={PILL}>
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
      </span>
      <span className="text-[11px] font-medium text-emerald-200">
        Auto Mode
      </span>
    </div>
  );
}

CopilotIndicator.propTypes = {
  property: PropTypes.bool,
  busy: PropTypes.bool,
  imageBusy: PropTypes.bool,
  responseTokens: PropTypes.object,
  isReconnecting: PropTypes.bool,
  paused: PropTypes.bool,
  isMockSession: PropTypes.bool,
};
