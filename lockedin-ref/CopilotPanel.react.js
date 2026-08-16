/* eslint-disable react/prop-types */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CopilotCoreCopilotSection } from './CopilotCoreCopilotSection.react';
import { CopilotCoach } from './CopilotCoach.react';
import { CopilotIndicator } from '../ui-style/CopilotIndicator.react';
import { checkMobile, showLeftPanel } from '../../util';
import {
  RECORDING_CONSENT_START_LINE,
  sessionNeedsRecordingConsent,
} from '../../utils/recordingConsentPolicy';
import { emitToast } from '../../toastHelper';
import CancelShareModal from '../../Modals/CancelShareModal.react';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firestore';
import DocumentViewer from '../ui-style/DocumentViewer.react';
import SessionNotesWorkspace from '../ui-style/SessionNotesWorkspace.react';
import PanelResizer from '../utils/PanelResizer.react';
import { Loader2, AlertCircle, SendHorizontal } from 'lucide-react';
import { PANEL_CONFIG } from '../utils/panelConfig';
import { CodeContextList } from './CodeContextList.react';
import { InterviewerAnswerCapsule } from '../button/CopilotButtons.react.js';
import {
  countInputTokens,
  COPILOT_INPUT_TOKEN_LIMIT,
} from '../../utils/tokenCounter';

const CHARACTER_LIMIT = 2000;

export function CopilotPanel(props) {
  const {
    chatPersisted,
    boundaryMicros,
    hasMoreHistory = false,
    loadingOlderHistory = false,
    onLoadOlderHistory,
    aiResponses,
    coachResponses,
    autoScroll,
    setAutoScroll,
    reverseOrder,
    property,
    readySignalReceived,
    isReconnecting,
    busy,
    coachBusy,
    imageBusy,
    aiResponseTokens,
    coachResponsesTokens,
    participantRequests,
    participantResponseTokens,
    userRequests,
    userResponseTokens,
    answerSimilarityScores,
    mockAnswerDraft = '',
    onSubmitMockAnswer,
    session,
    hideCoach,
    selectDisplayError,
    emitSubmit,
    paused,
    selectedInterviewerSignatures,
    newInterviewerQuestionCount = 0,
    interviewerSelectionMax = 10,
    onToggleInterviewerSelection,
    onSubmitRecentInterviewer,
    onClearInterviewerSelection,
    fontSize,
    helperMessages,
    helperConnected,
    helperUserId,
    helperResponseTokens,
    codeContexts,
    onRemoveCodeContext,
    onClearCodeContexts,
    paymentPlan,
    showDocuments,
    setShowDocuments,
    showNotes,
    setShowNotes,
    renderMode,
    teleprompterWpm,
    recording,
    showAiMessages = true,
    showDuoMessages = true,
    showUserMessages = true,
  } = props;

  const type = session?.type;
  const participantRole = session?.participant_role || 'Interviewer';
  // AssemblyAI is now the only client-side STT path (backend Deepgram removed).
  const useAssemblyAI = true;
  const hasLeftPanel = showLeftPanel(type);
  const isMockSession = type === 'mock';
  const capsuleBusy = type === 'oa' || type === 'coach' ? coachBusy : busy;

  const [terminateFormOpen, setTerminateFormOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isMouseInsideRef = useRef(false);
  const isComposingRef = useRef(false);
  const isInputFocusedRef = useRef(false);
  const blurHideTimerRef = useRef(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isOverLimit, setIsOverLimit] = useState(false);
  const [documents, setDocuments] = useState([]);
  const user = auth.currentUser;
  const userId = user?.uid;
  const collectionPath = userId ? `users/${userId}/files` : null;
  const [leftWidth, setLeftWidth] = useState(PANEL_CONFIG.DESKTOP_LEFT_WIDTH);
  const [auxPanelWidth, setAuxPanelWidth] = useState(42);
  const [auxPanelHeight, setAuxPanelHeight] = useState(42);
  const [persistedNoteId, setPersistedNoteId] = useState(null);
  const [persistedDocId, setPersistedDocId] = useState(null);
  const [isWideScreen, setIsWideScreen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= PANEL_CONFIG.BREAKPOINT;
  });

  const narrowMock = !isWideScreen && isMockSession;
  const hasCodeContexts = Boolean(codeContexts && codeContexts.length > 0);
  const normalizedPaymentPlan =
    typeof paymentPlan === 'string' ? paymentPlan.toLowerCase().trim() : '';
  const hasPaidNotes = Boolean(
    normalizedPaymentPlan && normalizedPaymentPlan !== 'free',
  );
  const noteLimit = hasPaidNotes ? 30 : 3;
  const showDocumentsPanel = showDocuments && !showNotes;
  const showAuxPanel = showDocumentsPanel || showNotes;
  const auxContainerRef = useRef(null);
  const auxResizeStateRef = useRef(null);

  const clampAuxPanelWidth = useCallback(
    (value) => Math.min(Math.max(value, 28), 72),
    [],
  );

  const clampAuxPanelHeight = useCallback(
    (value) => Math.min(Math.max(value, 26), 72),
    [],
  );

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputMessage(newValue);
    setIsOverLimit(newValue.length > CHARACTER_LIMIT);
  };

  const maybeHideInput = useCallback(() => {
    if (
      !isMouseInsideRef.current &&
      !isComposingRef.current &&
      !isInputFocusedRef.current
    ) {
      setIsHovered(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (blurHideTimerRef.current) {
        clearTimeout(blurHideTimerRef.current);
        blurHideTimerRef.current = null;
      }
    };
  }, []);

  const buildCodeContextText = () => {
    if (!hasCodeContexts) {
      return '';
    }

    return codeContexts
      .map((context, index) => {
        const fileName = context.fileName || 'Untitled';
        const startLineRaw =
          context.selectionRange?.start?.line ??
          context.selectionRange?.startLine;
        const endLineRaw =
          context.selectionRange?.end?.line ?? context.selectionRange?.endLine;
        const hasLineRange =
          Number.isFinite(startLineRaw) && Number.isFinite(endLineRaw);
        const snippetLabel = hasLineRange
          ? `${fileName}:${startLineRaw + 1}-${endLineRaw + 1}`
          : fileName;
        const snippetCode = context.code || context.selectedText || '';

        return `Snippet ${index + 1} (${snippetLabel}):\n\`\`\`${context.language || ''}\n${snippetCode}\n\`\`\``;
      })
      .join('\n\n---\n\n');
  };

  const buildSubmitTranscript = (rawInput) => {
    const trimmedInput = rawInput.trim();
    if (!hasCodeContexts) {
      return trimmedInput;
    }

    const contextText = buildCodeContextText();
    if (!contextText) {
      return trimmedInput;
    }

    return trimmedInput ? `${trimmedInput}\n\n${contextText}` : contextText;
  };

  const isTranscriptWithinTokenLimit = (transcript) => {
    const inputTokens = countInputTokens(transcript);
    if (inputTokens <= COPILOT_INPUT_TOKEN_LIMIT) {
      return true;
    }

    emitToast(
      'warning',
      `Message too long (${inputTokens} tokens). Keep it under ${COPILOT_INPUT_TOKEN_LIMIT} tokens by shortening text or removing some context snippets.`,
      { cooldownKey: 'copilot_input_token_limit_warning' },
    );
    return false;
  };

  const canSendMain =
    !busy &&
    !coachBusy &&
    !isOverLimit &&
    (Boolean(inputMessage.trim()) || hasCodeContexts);

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOverLimit) {
      return;
    }

    const transcript = buildSubmitTranscript(inputMessage);
    if (!transcript) {
      return;
    }
    if (!isTranscriptWithinTokenLimit(transcript)) {
      return;
    }

    const message = {
      transcript,
      role: 'participant',
      update_transcript: true,
    };

    emitSubmit(message);
    if (hasCodeContexts && onClearCodeContexts) {
      onClearCodeContexts();
    }
    setInputMessage('');
    setIsOverLimit(false);
  };

  const handleMockSubmit = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (busy || coachBusy) {
      return;
    }
    const transcript = (mockAnswerDraft || '').trim();
    if (!transcript) {
      return;
    }
    if (!isTranscriptWithinTokenLimit(transcript)) {
      return;
    }
    onSubmitMockAnswer?.(transcript);
  };

  const fetchFiles = useCallback(async () => {
    if (!collectionPath) {
      setDocuments([]);
      return;
    }

    try {
      const querySnapshot = await getDocs(collection(db, collectionPath));
      const newData = querySnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }));
      const filteredMaterial = newData
        .filter((doc) => doc.is_archived === false)
        .sort((a, b) => b.uploaded_timestamp - a.uploaded_timestamp);
      setDocuments(filteredMaterial);
    } catch (error) {
      setDocuments([]);
      emitToast('error', 'Failed to load documents.', {
        cooldownKey: 'copilot_documents_load_failed',
      });
    }
  }, [collectionPath]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    if (selectDisplayError) {
      setTerminateFormOpen(true);
    }
  }, [selectDisplayError]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () =>
      setIsWideScreen(window.innerWidth >= PANEL_CONFIG.BREAKPOINT);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const resizeState = auxResizeStateRef.current;
      const container = auxContainerRef.current;
      if (!resizeState || !container) return;

      const containerRect = container.getBoundingClientRect();
      if (resizeState.axis === 'y') {
        const nextHeight =
          ((event.clientY - containerRect.top) / containerRect.height) * 100;
        setAuxPanelHeight(clampAuxPanelHeight(nextHeight));
        return;
      }
      const nextWidth =
        ((event.clientX - containerRect.left) / containerRect.width) * 100;
      setAuxPanelWidth(clampAuxPanelWidth(nextWidth));
    };

    const handlePointerUp = () => {
      if (!auxResizeStateRef.current) return;
      auxResizeStateRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [clampAuxPanelWidth, clampAuxPanelHeight]);

  const startAuxPanelResize = useCallback((axis) => {
    auxResizeStateRef.current = { axis };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = axis === 'y' ? 'row-resize' : 'col-resize';
  }, []);

  return (
    <div
      className="flex flex-col bg-gradient-to-b w-full h-[85vh] overflow-hidden relative"
      onMouseEnter={() => {
        isMouseInsideRef.current = true;
        if (blurHideTimerRef.current) {
          clearTimeout(blurHideTimerRef.current);
          blurHideTimerRef.current = null;
        }
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        isMouseInsideRef.current = false;
        maybeHideInput();
      }}
    >
      <div className="flex w-full flex-1 gap-2 min-h-0 overflow-hidden">
        <div
          className={`flex w-full h-full ${isWideScreen ? 'flex-row' : 'flex-col'}`}
          ref={auxContainerRef}
        >
          {showAuxPanel && (
            <div
              className="relative flex-shrink-0 rounded-xl border border-cyan-300/20 overflow-hidden"
              style={
                isWideScreen
                  ? {
                      width: `${auxPanelWidth}%`,
                      maxWidth: '72%',
                      height: '100%',
                      marginRight: '0.5rem',
                    }
                  : {
                      height: `${auxPanelHeight}%`,
                      width: '100%',
                      marginBottom: '0.5rem',
                    }
              }
            >
              {showDocumentsPanel && (
                <DocumentViewer
                  show={showDocumentsPanel}
                  documents={documents}
                  fontSize={fontSize}
                  onClose={() => setShowDocuments(false)}
                  autoOpenDocId={persistedDocId}
                  onDocumentSelect={setPersistedDocId}
                  embedded
                />
              )}
              {showNotes && (
                <SessionNotesWorkspace
                  show={showNotes}
                  userId={userId}
                  noteLimit={noteLimit}
                  isPaidPlan={hasPaidNotes}
                  onClose={() => setShowNotes(false)}
                  selectedNoteId={persistedNoteId}
                  setSelectedNoteId={setPersistedNoteId}
                />
              )}
              <div
                role="separator"
                aria-orientation={isWideScreen ? 'vertical' : 'horizontal'}
                aria-label={
                  isWideScreen ? 'Resize panel width' : 'Resize panel height'
                }
                onPointerDown={() =>
                  startAuxPanelResize(isWideScreen ? 'x' : 'y')
                }
                className={`absolute z-20 transition-colors ${
                  isWideScreen
                    ? 'right-0 top-0 h-full w-3 cursor-col-resize'
                    : 'bottom-0 left-0 h-3 w-full cursor-row-resize'
                }`}
              >
                <div
                  className={`absolute rounded-full bg-cyan-300/30 ${
                    isWideScreen
                      ? 'right-[5px] top-1/2 h-16 w-[2px] -translate-y-1/2'
                      : 'bottom-[5px] left-1/2 h-[2px] w-16 -translate-x-1/2'
                  }`}
                />
              </div>
            </div>
          )}

          <div className="flex flex-1 h-full min-w-0">
            {narrowMock ? (
              <div className="relative h-full flex flex-grow flex-col w-full">
                <div className="relative flex-1 min-h-0 rounded flex flex-col">
                  <div
                    className="absolute bottom-2 px-4 py-1 w-full flex items-center"
                    style={{ zIndex: 40 }}
                  >
                    <CopilotIndicator
                      busy={busy || coachBusy}
                      imageBusy={false}
                      property={Boolean(property || readySignalReceived)}
                      isReconnecting={isReconnecting}
                      responseTokens={userResponseTokens}
                      paused={paused}
                      isMockSession={isMockSession}
                    />
                  </div>
                  <div className="relative flex-1 bg-transparent overflow-hidden flex flex-col min-h-0">
                    <CopilotCoach
                      key="copilot-coach-narrow"
                      autoScroll={autoScroll}
                      setAutoScroll={setAutoScroll}
                      reverseOrder={reverseOrder}
                      coachResponses={coachResponses}
                      coachResponsesTokens={coachResponsesTokens}
                      chatPersisted={chatPersisted}
                      boundaryMicros={boundaryMicros}
                      hasMoreHistory={hasMoreHistory}
                      loadingOlderHistory={loadingOlderHistory}
                      onLoadOlderHistory={onLoadOlderHistory}
                      userResponseTokens={userResponseTokens}
                      userRequests={userRequests}
                      answerSimilarityScores={answerSimilarityScores}
                      type={type}
                      fontSize={fontSize}
                      helperMessages={helperMessages}
                      helperResponseTokens={helperResponseTokens}
                      useAssemblyAI={useAssemblyAI}
                      renderMode={renderMode}
                      teleprompterWpm={teleprompterWpm}
                      recording={recording}
                      showAiMessages={showAiMessages}
                      showDuoMessages={showDuoMessages}
                      showUserMessages={showUserMessages}
                      mockMerged
                      aiResponses={aiResponses}
                      aiResponseTokens={aiResponseTokens}
                      participantRequests={participantRequests}
                      participantResponseTokens={participantResponseTokens}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div
                  className={`${
                    hasLeftPanel ? '' : 'hidden'
                  } ${hideCoach !== true ? 'flex-shrink-0' : 'w-[100%]'} relative flex h-full`}
                  style={{
                    width: hideCoach !== true ? `${leftWidth}%` : '100%',
                  }}
                >
                  <div className="relative w-full flex-grow rounded flex flex-col overflow-x-hidden">
                    {/* Indicator shown in left panel for all dual-panel sessions
                        (including mock); right panel only shows it when there
                        is no left panel — mirrors web behaviour */}
                    <div
                      className="absolute bottom-2 px-4 w-full flex justify-between items-center"
                      style={{ zIndex: 40 }}
                    >
                      <CopilotIndicator
                        busy={busy}
                        imageBusy={imageBusy}
                        property={Boolean(property || readySignalReceived)}
                        isReconnecting={isReconnecting}
                        responseTokens={
                          checkMobile()
                            ? userResponseTokens
                            : participantResponseTokens
                        }
                        paused={paused}
                        isMockSession={isMockSession}
                      />
                      {/* Recording-consent statement. The blocking prompt is
                          once per account now, so this line is the part the user
                          reads on EVERY session. It rides along with the status
                          pill because this row is the one persistent strip at
                          the bottom of the panel: the composer below it is
                          revealed on hover (`isHovered && !isMockSession`), so
                          anchoring the sentence there would make it blink in and
                          out instead of always being present. The composer does
                          cover this row while open — a state the user opens
                          themselves.
                          Gated on sessionNeedsRecordingConsent(), the SAME
                          predicate as the prompt. It used to be
                          requireSytemAudio(), which is a different question and
                          disagrees on `phone`: a phone session records the
                          interviewer through the mic without needing system
                          audio, so it was the one type that could be recorded
                          with no statement on screen. */}
                      {sessionNeedsRecordingConsent(type) && (
                        <p className="ml-3 min-w-0 flex-1 text-right text-[10px] leading-snug text-gray-500">
                          {RECORDING_CONSENT_START_LINE}
                        </p>
                      )}
                    </div>
                    <div className="relative flex-grow bg-transparent overflow-hidden">
                      <CopilotCoreCopilotSection
                        key={`copilot-section-${hideCoach ? 'hide' : 'show'}`}
                        chatPersisted={chatPersisted}
                        boundaryMicros={boundaryMicros}
                        hasMoreHistory={hasMoreHistory}
                        loadingOlderHistory={loadingOlderHistory}
                        onLoadOlderHistory={onLoadOlderHistory}
                        aiResponses={aiResponses}
                        inputBarVisible={isHovered}
                        autoScroll={autoScroll}
                        setAutoScroll={setAutoScroll}
                        reverseOrder={reverseOrder}
                        aiResponseTokens={aiResponseTokens}
                        participantResponseTokens={participantResponseTokens}
                        participantRequests={participantRequests}
                        participantRole={participantRole}
                        type={type}
                        emitSubmit={emitSubmit}
                        paused={paused}
                        selectedInterviewerSignatures={
                          selectedInterviewerSignatures
                        }
                        interviewerSelectionMax={interviewerSelectionMax}
                        onToggleInterviewerSelection={
                          onToggleInterviewerSelection
                        }
                        fontSize={fontSize}
                        busy={busy}
                        hideCoach={hideCoach}
                        helperMessages={helperMessages}
                        helperConnected={helperConnected}
                        helperUserId={helperUserId}
                        helperResponseTokens={helperResponseTokens}
                        useAssemblyAI={useAssemblyAI}
                        renderMode={renderMode}
                        teleprompterWpm={teleprompterWpm}
                        recording={recording}
                        showAiMessages={showAiMessages}
                        showDuoMessages={showDuoMessages}
                        showUserMessages={showUserMessages}
                      />
                    </div>
                  </div>
                </div>

                {!hideCoach && hasLeftPanel && (
                  <PanelResizer onResize={setLeftWidth} />
                )}

                {!hideCoach ? (
                  <div
                    className="relative h-full flex flex-grow flex-col transition-opacity duration-300"
                    style={{
                      width: hasLeftPanel ? `${100 - leftWidth}%` : '100%',
                      maxHeight: '100%',
                    }}
                  >
                    <div className="relative flex-1 min-h-0 rounded flex flex-col">
                      {/* Only show indicator here when there is no left panel
                          (sole-panel sessions: oa / phone / coach) */}
                      {!hasLeftPanel && (
                        <div
                          className="absolute bottom-2 px-4 py-1 w-full flex items-center"
                          style={{ zIndex: 40 }}
                        >
                          <CopilotIndicator
                            busy={coachBusy}
                            imageBusy={type === 'oa' ? imageBusy : false}
                            property={Boolean(property || readySignalReceived)}
                            isReconnecting={isReconnecting}
                            responseTokens={userResponseTokens}
                            paused={paused}
                            isMockSession={isMockSession}
                          />
                        </div>
                      )}
                      <div className="relative flex-1 bg-transparent overflow-hidden flex flex-col min-h-0">
                        <CopilotCoach
                          autoScroll={autoScroll}
                          setAutoScroll={setAutoScroll}
                          reverseOrder={reverseOrder}
                          coachResponses={coachResponses}
                          coachResponsesTokens={coachResponsesTokens}
                          chatPersisted={chatPersisted}
                          boundaryMicros={boundaryMicros}
                          hasMoreHistory={hasMoreHistory}
                          loadingOlderHistory={loadingOlderHistory}
                          onLoadOlderHistory={onLoadOlderHistory}
                          userResponseTokens={userResponseTokens}
                          userRequests={userRequests}
                          answerSimilarityScores={answerSimilarityScores}
                          type={type}
                          fontSize={fontSize}
                          busy={coachBusy}
                          emitSubmit={emitSubmit}
                          paused={paused}
                          helperMessages={helperMessages}
                          helperResponseTokens={helperResponseTokens}
                          useAssemblyAI={useAssemblyAI}
                          renderMode={
                            renderMode === 'teleprompter' && type === 'oa'
                              ? 'teleprompter'
                              : 'markdown'
                          }
                          teleprompterWpm={teleprompterWpm}
                          recording={recording}
                          showAiMessages={showAiMessages}
                          showDuoMessages={showDuoMessages}
                          showUserMessages={showUserMessages}
                          selectedInterviewerSignatures={
                            selectedInterviewerSignatures
                          }
                          interviewerSelectionMax={interviewerSelectionMax}
                          onToggleInterviewerSelection={
                            onToggleInterviewerSelection
                          }
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {isMockSession && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3">
          <button
            type="button"
            onClick={handleMockSubmit}
            disabled={busy || coachBusy || !mockAnswerDraft.trim()}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 ${
              busy || coachBusy || !mockAnswerDraft.trim()
                ? 'bg-gray-600 cursor-not-allowed opacity-50 shadow-none'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 hover:scale-[1.03]'
            }`}
          >
            <SendHorizontal className="h-4 w-4" />
            {busy || coachBusy ? 'Sending...' : 'Submit Answer'}
          </button>
        </div>
      )}

      {hasCodeContexts && (
        <div className="absolute bottom-0 left-0 right-0 w-full px-3 pt-1 z-40 pointer-events-none">
          <div className="pointer-events-auto">
            <CodeContextList
              codeContexts={codeContexts}
              onRemove={onRemoveCodeContext}
              onClearAll={onClearCodeContexts}
              busy={busy}
            />
          </div>
        </div>
      )}

      {isHovered && !isMockSession && (
        <form
          onSubmit={handleSubmit}
          className="absolute bottom-0 left-0 right-0 w-full px-3 pb-2 z-50"
        >
          {/* Manual mode: floating answer capsule above the input. Default
              "Answer all N" (this round's new questions); morphs to "Answer N"
              + "N selected / Clear" once lines are checked. Only when paused. */}
          {paused && (
            <InterviewerAnswerCapsule
              newCount={newInterviewerQuestionCount}
              selectedCount={selectedInterviewerSignatures?.size || 0}
              selectionMax={interviewerSelectionMax}
              busy={capsuleBusy}
              compact
              onAnswer={onSubmitRecentInterviewer}
              onClear={onClearInterviewerSelection}
            />
          )}
          <div className="relative">
            <div className="relative overflow-hidden rounded-xl backdrop-blur-3xl bg-black/40 border border-white/10 shadow-xl">
              <div className="relative flex items-center gap-2 px-2 py-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={handleInputChange}
                  onKeyDown={(e) => e.stopPropagation()}
                  onFocus={() => {
                    isInputFocusedRef.current = true;
                    if (blurHideTimerRef.current) {
                      clearTimeout(blurHideTimerRef.current);
                      blurHideTimerRef.current = null;
                    }
                  }}
                  onBlur={() => {
                    isInputFocusedRef.current = false;
                    if (blurHideTimerRef.current) {
                      clearTimeout(blurHideTimerRef.current);
                    }
                    blurHideTimerRef.current = setTimeout(() => {
                      blurHideTimerRef.current = null;
                      maybeHideInput();
                    }, 150);
                  }}
                  onCompositionStart={() => {
                    isComposingRef.current = true;
                  }}
                  onCompositionEnd={() => {
                    isComposingRef.current = false;
                    maybeHideInput();
                  }}
                  className={`flex-1 bg-transparent text-white placeholder-gray-300 text-[13px] focus:outline-none font-normal h-8 rounded-md ${
                    isOverLimit ? 'text-red-400' : ''
                  }`}
                  placeholder="Type your message..."
                />

                {inputMessage.length > 0 && (
                  <span
                    className={`text-[10px] font-medium transition-colors ${
                      isOverLimit
                        ? 'text-red-400'
                        : inputMessage.length > CHARACTER_LIMIT * 0.9
                          ? 'text-yellow-400/70'
                          : 'text-gray-300'
                    }`}
                  >
                    {inputMessage.length}/{CHARACTER_LIMIT}
                  </span>
                )}

                <button
                  type="submit"
                  disabled={!canSendMain}
                  className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-200 ${
                    !canSendMain
                      ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-br from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 active:scale-95'
                  }`}
                >
                  {busy || coachBusy ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="animate-spin h-3.5 w-3.5" />
                      Sending
                    </span>
                  ) : (
                    'Send'
                  )}
                </button>
              </div>

              {isOverLimit && (
                <div className="px-4 pb-2.5 pt-0">
                  <p className="text-[11px] text-red-400/90 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Message exceeds character limit
                  </p>
                </div>
              )}
            </div>
          </div>
        </form>
      )}

      {terminateFormOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="fixed inset-0 bg-black/50"></div>
          <CancelShareModal
            setOpen={setTerminateFormOpen}
            sessionID={session?.id}
          />
        </div>
      )}
    </div>
  );
}
