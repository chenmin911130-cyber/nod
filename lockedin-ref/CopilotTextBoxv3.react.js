import React, { useMemo, useState, useRef, useEffect } from 'react';
import MarkdownRenderer from '../utils/MarkdownRenderer.react';
import TeleprompterRenderer from '../utils/TeleprompterRenderer.react';
import { FaRegCopy, FaArrowCircleUp } from 'react-icons/fa';
import minizedLogo from '../../assets/icon-reticle-white.svg';
import {
  User,
  Handshake,
  Play,
  Pause,
  RotateCcw,
  Pin,
  Check,
  CircleCheckBig,
} from 'lucide-react';
import { constructScreenshotURL } from '../../util';
import ScreenshotPreview from '../media/ScreenshotPreview.react';
import { ListeningDots } from './ListeningIndicator.react';

export function CopilotTextBoxv3(props) {
  const {
    transcript,
    timestamp,
    transcriptMeta,
    enableStreamingTone = false,
    setAutoScroll,
    reverseOrder,
    background,
    fontSize,
    imageUrl,
    renderMode = 'markdown',
    teleprompterWpm,
    isLatestAi = false,
    isListening = false,
    isPinnable = false,
    isPinned = false,
    onPin,
    similarity,
    allowManualSubmit = false,
    paused = false,
    busy = false,
    emitSubmit,
    isInterviewerSelectable = false,
    isInterviewerSelected = false,
    interviewerSelectionDisabled = false,
    onToggleInterviewerSelection,
  } = props;

  const date = useMemo(
    () => (timestamp ? new Date(Date.parse(timestamp)) : new Date()),
    [timestamp],
  );
  const [copied, setCopied] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isSubmitted || busy || !emitSubmit) return;
    setIsSubmitted(true);
    emitSubmit({
      transcript,
      role: 'participant',
      update_transcript: true,
    });
  };

  useEffect(() => {
    if (!busy) setIsSubmitted(false);
  }, [busy]);

  // ===== Teleprompter controls =====
  const teleRef = useRef(null);
  const [telePlaying, setTelePlaying] = useState(false);
  const [teleToast, setTeleToast] = useState({ play: false, reset: false });

  const showTeleToast = (key) => {
    setTeleToast((p) => ({ ...p, [key]: true }));
    setTimeout(() => setTeleToast((p) => ({ ...p, [key]: false })), 1000);
  };

  const handleTelePlayToggle = (event) => {
    event.stopPropagation();
    teleRef.current?.togglePlay?.();
    showTeleToast('play');
  };

  const handleTeleReset = (event) => {
    event.stopPropagation();
    teleRef.current?.restart?.();
    showTeleToast('reset');
  };

  const parsedTimestamp = date.toTimeString().split(' ')[0];

  const handleCopy = (event) => {
    event.stopPropagation();
    navigator.clipboard.writeText(transcript).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    });
  };

  const getMessageStyle = () => {
    if (background === 'ai') {
      return {
        container: 'bg-gray-600/30',
        glow: 'shadow-[0_0_24px_rgba(251,191,36,0.12)]',
        icon: 'bg-gradient-to-br from-amber-400 to-yellow-400',
        iconRing: 'ring-2 ring-amber-400/30',
      };
    }
    if (background === 'helper') {
      return {
        container: '',
        glow: 'shadow-[0_0_24px_rgba(16,185,129,0.12)]',
        icon: 'bg-gradient-to-br from-emerald-400 to-teal-500',
        iconRing: 'ring-2 ring-emerald-400/30',
      };
    }
    if (background === 'participant') {
      return {
        container: '',
        glow: 'shadow-[0_0_24px_rgba(6,182,212,0.12)]',
        icon: 'bg-gradient-to-br from-sky-400 to-blue-500',
        iconRing: 'ring-2 ring-sky-400/30',
      };
    }
    return {
      container: '',
      glow: 'shadow-[0_0_24px_rgba(6,182,212,0.12)]',
      icon: 'bg-transparent',
      iconRing: 'ring-2 ring-gray-400/30',
    };
  };

  const onDoubleClick = (e) => {
    if (!isPinnable || !onPin) return;
    if (e.target.closest('button, a, [data-no-pin]')) return;
    const selText = window.getSelection()?.toString()?.trim();
    if (selText) return;
    e.preventDefault();
    onPin();
  };

  const style = getMessageStyle();
  const isTeleprompter = renderMode === 'teleprompter';
  const isStreaming = background === 'ai' && timestamp == null;
  const shouldAutoPlay =
    isTeleprompter && isLatestAi && background === 'ai' && !isStreaming;

  // Match the Live panel (v2): a selectable interviewer/candidate question gets a
  // cyan ring — brighter once checked — so OA/coach bubbles look consistent with
  // Live. Gated on isInterviewerSelectable so mock (no manual selection) keeps
  // its original borderless look.
  const interviewerBubbleClass = isInterviewerSelectable
    ? isInterviewerSelected
      ? 'bg-cyan-500/[0.12] ring-2 ring-inset ring-cyan-400/80 shadow-[0_0_30px_rgba(34,211,238,0.35)]'
      : 'bg-cyan-500/[0.05] ring-1 ring-inset ring-cyan-400/25 shadow-[0_0_24px_rgba(6,182,212,0.12)]'
    : '';

  const useStreamingTone = Boolean(enableStreamingTone && transcriptMeta);

  const tokenToneClass = useMemo(() => {
    if (!useStreamingTone) return 'text-white';

    const isFinal = Boolean(transcriptMeta.isFinal);
    const isFormatted = Boolean(transcriptMeta.isFormatted);

    if (!isFinal) return 'text-gray-400 italic';
    if (isFinal && !isFormatted) return 'text-gray-400';
    return 'text-white';
  }, [transcriptMeta]);

  const shouldRenderAsPlainText =
    useStreamingTone &&
    (!transcriptMeta.isFinal || transcriptMeta.isFormatted === false);

  return (
    <div onDoubleClick={onDoubleClick} className="w-full">
      <div className="w-full flex items-start mt-1 gap-3">
        {isInterviewerSelectable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!interviewerSelectionDisabled) {
                onToggleInterviewerSelection?.();
              }
            }}
            disabled={interviewerSelectionDisabled}
            data-no-pin
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            aria-label={
              isInterviewerSelected ? 'Deselect message' : 'Select message'
            }
            title={
              interviewerSelectionDisabled
                ? 'Selection limit reached'
                : isInterviewerSelected
                  ? 'Deselect'
                  : 'Select to submit together'
            }
            className={`self-center flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              isInterviewerSelected
                ? 'bg-cyan-500 border-cyan-500 text-white shadow-sm shadow-cyan-500/40'
                : interviewerSelectionDisabled
                  ? 'border-white/20 opacity-40 cursor-not-allowed'
                  : 'border-white/40 hover:border-cyan-400 cursor-pointer'
            }`}
          >
            {isInterviewerSelected && (
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            )}
          </button>
        )}
        <div
          className={`flex-shrink-0 mt-1 ${style.iconRing} rounded-full p-0.5`}
        >
          <div
            className={`${style.icon} rounded-full p-1.5 flex items-center justify-center`}
          >
            {background === 'ai' ? (
              <img src={minizedLogo} alt="AI" className="w-3.5 h-3.5" />
            ) : background === 'helper' ? (
              <Handshake className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            ) : (
              <User className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-white font-semibold text-sm tracking-wide">
                {background === 'ai'
                  ? 'AI Coach'
                  : background === 'helper'
                    ? 'Duo'
                    : background === 'participant'
                      ? 'Interviewer'
                      : background}
              </h3>
              {similarity && typeof similarity.score === 'number' && (
                <span
                  title={
                    similarity.note ||
                    'How much your answer overlaps the AI-suggested answer'
                  }
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    similarity.score >= 75
                      ? 'border-rose-300/25 bg-rose-400/10 text-rose-300'
                      : similarity.score >= 45
                        ? 'border-amber-300/25 bg-amber-400/10 text-amber-300'
                        : 'border-emerald-300/25 bg-emerald-400/10 text-emerald-300'
                  }`}
                >
                  <span>{similarity.score}% overlap</span>
                </span>
              )}
              <span className="text-white/40 text-[10px] font-medium">
                {parsedTimestamp}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Teleprompter controls - only for AI messages in teleprompter mode */}
              {isTeleprompter && background === 'ai' && (
                <>
                  <button
                    className="group relative p-1.5 rounded-lg hover:bg-white/10 transition-all duration-200"
                    onClick={handleTelePlayToggle}
                    data-no-pin
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    aria-label={telePlaying ? 'Pause' : 'Play'}
                    data-safe-tooltip={telePlaying ? 'Pause' : 'Play'}
                  >
                    {telePlaying ? (
                      <Pause className="w-3.5 h-3.5 text-white/70 group-hover:text-white transition-colors" />
                    ) : (
                      <Play className="w-3.5 h-3.5 text-white/70 group-hover:text-white transition-colors" />
                    )}
                    {teleToast.play && (
                      <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] text-white bg-black/90 rounded whitespace-nowrap">
                        {telePlaying ? 'Paused' : 'Started'}
                      </span>
                    )}
                  </button>

                  <button
                    className="group relative p-1.5 rounded-lg hover:bg-white/10 transition-all duration-200"
                    onClick={handleTeleReset}
                    data-no-pin
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    aria-label="Restart"
                    data-safe-tooltip="Restart"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-white/70 group-hover:text-white transition-colors" />
                    {teleToast.reset && (
                      <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] text-white bg-black/90 rounded whitespace-nowrap">
                        Reset
                      </span>
                    )}
                  </button>
                </>
              )}

              {isPinnable && onPin && (
                <button
                  className={`group relative p-1.5 rounded-lg transition-all duration-200 ${isPinned ? 'bg-amber-400/20' : 'hover:bg-white/10'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPin();
                  }}
                  data-no-pin
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  aria-label={isPinned ? 'Unpin' : 'Pin'}
                  data-safe-tooltip={isPinned ? 'Unpin message' : 'Pin message'}
                >
                  <Pin
                    className={`w-3.5 h-3.5 transition-colors ${isPinned ? 'text-amber-300' : 'text-white/70 group-hover:text-white'}`}
                    strokeWidth={2.5}
                  />
                </button>
              )}

              {allowManualSubmit && paused && (
                <button
                  type="button"
                  className={`group relative p-1.5 rounded-lg transition-all duration-200 ${
                    busy
                      ? 'cursor-not-allowed opacity-40'
                      : 'hover:bg-white/10 cursor-pointer'
                  }`}
                  onClick={!busy ? handleSubmit : undefined}
                  disabled={busy}
                  data-no-pin
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  aria-label="Submit to AI"
                  data-safe-tooltip={
                    isSubmitted ? 'Submitted' : busy ? 'Processing…' : 'Submit'
                  }
                >
                  {isSubmitted ? (
                    <CircleCheckBig
                      className="w-3.5 h-3.5 text-green-400"
                      strokeWidth={2}
                    />
                  ) : (
                    <FaArrowCircleUp className="w-3.5 h-3.5 text-white/80 group-hover:text-white transition-colors" />
                  )}
                </button>
              )}

              <button
                className="group relative p-1.5 rounded-lg hover:bg-white/10 transition-all duration-200"
                onClick={handleCopy}
                data-no-pin
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
              >
                <FaRegCopy className="w-3.5 h-3.5 text-white/70 group-hover:text-white transition-colors" />
                {copied && (
                  <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] text-white bg-black/90 rounded whitespace-nowrap">
                    Copied!
                  </span>
                )}
              </button>
            </div>
          </div>

          <article
            className={`
              ${interviewerBubbleClass || `${style.container} ${style.glow}`}
              ${isPinned ? 'ring-1 ring-amber-400/40' : ''}
              rounded-2xl
              overflow-hidden
              transition-all
              duration-300
              relative
            `}
          >
            <div
              className={`pl-4 pr-3 py-3 ${isPinned ? 'max-h-[30vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]' : ''}`}
            >
              {imageUrl && (
                <div className="mb-3">
                  <ScreenshotPreview
                    src={constructScreenshotURL(imageUrl)}
                    alt={`${background} shared screenshot`}
                    openButtonLabel={`Open screenshot shared by ${background}`}
                    wrapperClassName="inline-flex"
                  />
                </div>
              )}

              {isListening ? (
                <ListeningDots />
              ) : transcript && isTeleprompter && background === 'ai' ? (
                <TeleprompterRenderer
                  ref={teleRef}
                  text={
                    typeof transcript === 'string'
                      ? transcript
                      : String(transcript)
                  }
                  fontSize={fontSize}
                  teleprompterWpm={teleprompterWpm}
                  hideControls={true}
                  onPlayChange={setTelePlaying}
                  shouldAutoPlay={shouldAutoPlay}
                />
              ) : useStreamingTone ? (
                <div className={tokenToneClass}>
                  {shouldRenderAsPlainText ? (
                    <div
                      className="whitespace-pre-wrap break-words leading-relaxed"
                      style={fontSize ? { fontSize } : undefined}
                    >
                      {transcript}
                    </div>
                  ) : (
                    <MarkdownRenderer
                      content={transcript}
                      fontSize={fontSize}
                    />
                  )}
                </div>
              ) : (
                <MarkdownRenderer content={transcript} fontSize={fontSize} />
              )}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
