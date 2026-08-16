import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  HashRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.react';
import { UserDataProvider } from './context/UserDataProvider.react';
import { LandingPage } from './pages/LandingPage.react';
import { NotFoundPage } from './pages/NotFoundPage.react';
import { WelcomePage } from './pages/WelcomePage.react';
import DesktopAuthPage from './pages/DesktopAuthPage.react';
import VSCodeAuthPage from './pages/VSCodeAuthPage.react';
import ClickThroughIndicator from './components/ui-style/ClickThroughIndicator';
import AuthPage from './pages/AuthPage.react';
import PrivateRoute from './components/navigation/PrivateRoute.react';
import AutoUpdater from './components/update-notification/AutoUpdate';
import { Minus, Eye, MoveDiagonal } from 'lucide-react';
import { BsShieldFillCheck } from 'react-icons/bs';
import { GiShieldDisabled } from 'react-icons/gi';
import {
  TransparencyProvider,
  useTransparency,
} from './context/TransparancyContext.react';
import { CodeViewerProvider } from './context/CodeViewerContext.react';
import { FontSizeProvider } from './context/FontSizeContext.react';
import { ModelTiersProvider } from './context/ModelTiersContext.react';
import { PaymentProvider } from './context/PaymentContext.react';
import { auth, db } from './firestore';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ActiveSessionWarningModal } from './Modals/ActiveSessionWarningModal.react';
import StealthTestModal from './Modals/StealthTestModal.react';
import StealthDisableConfirmModal from './Modals/StealthDisableConfirmModal.react';
import logoImage from './assets/logo/logo-on-dark.svg';
import {
  hasStealthAccessAsync,
  autoArchiveStaleActiveSessions,
  checkTesterAdminAccess,
} from './util';
import { emitToast } from './toastHelper';
import DocumentWindowPage from './pages/new/DocumentWindowPage.react';
import { SafeTooltipHost } from './components/tooltip/SafeTooltipHost.react';

function MainApp() {
  const STEALTH_PREF_KEY = 'stealth_mode_preference';
  const [opacity, setOpacity] = useTransparency();
  const [isHovering, setIsHovering] = useState(false);
  const [isOpacityLocked, setIsOpacityLocked] = useState(false);
  const [isWindowActive, setIsWindowActive] = useState(true);
  const [stealthModeEnabled, setStealthModeEnabled] = useState(null);
  const [isStealthSupported, setIsStealthSupported] = useState(false);
  const [isStealthAllowed, setIsStealthAllowed] = useState(null);
  const [isStealthUpdating, setIsStealthUpdating] = useState(false);
  const didAutoEnableStealthRef = useRef(false);
  const lastStealthAutoEnableUserRef = useRef(null);
  const sliderRef = useRef(null);
  const sliderContainerRef = useRef(null);
  const isPointerInsideSliderRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isDocumentWindowRoute = location?.pathname === '/app/document-window';
  const isSessionRoute = location?.pathname?.startsWith('/app/pilot/session/');

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const resizeDirectionRef = useRef(null);
  const initialBoundsRef = useRef(null);
  const initialMousePosRef = useRef(null);
  const rafRef = useRef(null);

  // Active session warning modal state
  const [showActiveSessionWarning, setShowActiveSessionWarning] =
    useState(false);

  // Stealth test modal state
  const [showStealthTestModal, setShowStealthTestModal] = useState(false);
  const [isTestingStealthMode, setIsTestingStealthMode] = useState(false);
  const [showStealthDisableConfirm, setShowStealthDisableConfirm] =
    useState(false);

  const getActiveSessionCount = async () => {
    const user = auth.currentUser;
    if (!user) return 0;
    try {
      const collectionPath = `users/${user.uid}/sessions`;
      const querySnapshot = await getDocs(collection(db, collectionPath));
      const sessions = querySnapshot.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      }));
      const cleaned = await autoArchiveStaleActiveSessions(user.uid, sessions);
      return cleaned.filter((s) => s.active === true).length;
    } catch (_) {
      return 0;
    }
  };

  const checkActiveSessionsBeforeClose = async () => {
    try {
      const count = await getActiveSessionCount();
      window.electronAPI?.send('close-app-with-session-info', {
        hasActiveSession: count > 0,
      });
    } catch (_) {
      window.electronAPI?.closeApp();
    }
  };

  const handleSessionClosed = () => {
    setShowActiveSessionWarning(false);
    window.electronAPI?.closeApp();
  };

  const applyStealthModeState = async (newState) => {
    if (isStealthUpdating) return;

    const api = window?.electronAPI;
    if (!api?.setStealthModeState) {
      console.error('Stealth mode API not available');
      return;
    }

    setIsStealthUpdating(true);
    try {
      try {
        localStorage.setItem(STEALTH_PREF_KEY, newState ? 'on' : 'off');
      } catch {
        // ignore
      }

      const result = await api.setStealthModeState(newState);
      setStealthModeEnabled(Boolean(result));
    } catch (error) {
      console.error('Failed to toggle stealth mode:', error);
    } finally {
      setIsStealthUpdating(false);
    }
  };

  const isMainWindowInSession = useCallback(async () => {
    const api = window?.electronAPI;
    if (!api?.invoke) {
      return false;
    }

    try {
      const locationInfo = await api.invoke('check-main-app-location');
      return Boolean(locationInfo?.isInSession);
    } catch (error) {
      console.warn('Failed to check main app location:', error);
      return false;
    }
  }, []);

  const evaluateStealthAllowed = useCallback(async (uid) => {
    const paymentRef = doc(db, 'payment', uid);
    const snap = await getDoc(paymentRef);
    if (!snap.exists()) {
      return false;
    }
    const data = snap.data();
    const { isTester, isAdmin, isCreator } = await checkTesterAdminAccess(uid);
    return Boolean(
      await hasStealthAccessAsync(
        data.subscription_product_id,
        data.subscription_plan,
        { isTester, isAdmin, isCreator },
      ),
    );
  }, []);

  const handleStealthToggleClick = async () => {
    if (isStealthAllowed !== true) {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setShowStealthTestModal(true);
        return;
      }
      let allowed;
      try {
        allowed = await evaluateStealthAllowed(currentUser.uid);
      } catch (error) {
        console.error('Failed to re-check stealth access:', error);
        emitToast(
          'error',
          "Couldn't verify your subscription right now. Check your connection and try again.",
        );
        return;
      }
      setIsStealthAllowed(allowed);
      if (!allowed) {
        setShowStealthTestModal(true);
        return;
      }
    }

    if (isStealthUpdating || stealthModeEnabled === null) {
      return;
    }

    const newState = !stealthModeEnabled;

    if (!newState) {
      const shouldConfirmDisable =
        isSessionRoute || (await isMainWindowInSession());
      if (shouldConfirmDisable) {
        setShowStealthDisableConfirm(true);
        return;
      }
    }

    await applyStealthModeState(newState);
  };

  const handleConfirmStealthDisable = async () => {
    if (stealthModeEnabled !== true) {
      setShowStealthDisableConfirm(false);
      return;
    }

    await applyStealthModeState(false);
  };

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onShortcutRegistrationFailed?.(
      (payload) => {
        const action = payload?.action || 'shortcut';
        const combo = payload?.shortcut ? ` (${payload.shortcut})` : '';
        emitToast(
          'error',
          `The "${action}" shortcut${combo} is already used by another app, so it won't work. Pick a different combination in Settings.`,
          { toastId: `shortcut-blocked-${action}` },
        );
      },
    );
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!showStealthDisableConfirm) {
      return;
    }

    if (stealthModeEnabled !== true) {
      setShowStealthDisableConfirm(false);
      return;
    }

    if (isSessionRoute) {
      return;
    }

    let isCancelled = false;
    isMainWindowInSession()
      .then((inSession) => {
        if (!isCancelled && !inSession) {
          setShowStealthDisableConfirm(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setShowStealthDisableConfirm(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    showStealthDisableConfirm,
    isSessionRoute,
    stealthModeEnabled,
    isMainWindowInSession,
  ]);

  useEffect(() => {
    window?.electronAPI?.setClickThroughBarHeight?.(isSessionRoute ? 88 : 44);
  }, [isSessionRoute]);

  useEffect(() => {
    if (window?.electronAPI?.onClickThroughToggled) {
      window.electronAPI.onClickThroughToggled((state) => {
        setIsWindowActive(state);
      });
    }

    // Get initial click through state on component mount
    if (window?.electronAPI?.getClickThroughState) {
      window.electronAPI
        .getClickThroughState()
        .then((initialState) => {
          setIsWindowActive(initialState);
        })
        .catch((error) => {
          console.error('Failed to get initial click through state:', error);
        });
    }

    // Listen for opacity lock changes from other windows
    if (window?.electronAPI?.onOpacityLockChanged) {
      const unsubscribe = window.electronAPI.onOpacityLockChanged(
        (isLocked) => {
          setIsOpacityLocked(isLocked);
        },
      );
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }

    // Get initial opacity lock state on component mount
    if (window?.electronAPI?.getOpacityLockState) {
      window.electronAPI
        .getOpacityLockState()
        .then((initialLockState) => {
          setIsOpacityLocked(initialLockState);
        })
        .catch((error) => {
          console.error('Failed to get initial opacity lock state:', error);
        });
    }
  }, []);

  useEffect(() => {
    if (!window?.electronAPI?.getStealthModeState) {
      return;
    }

    let isMounted = true;
    setIsStealthSupported(true);

    window.electronAPI
      .getStealthModeState()
      .then((state) => {
        if (isMounted) {
          setStealthModeEnabled(Boolean(state));
        }
      })
      .catch((error) =>
        console.error('Failed to get stealth mode state:', error),
      );

    const unsubscribe = window.electronAPI.onStealthModeChanged?.((state) => {
      if (isMounted) {
        setStealthModeEnabled(Boolean(state));
      }
    });

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      const uid = currentUser?.uid ?? null;
      if (lastStealthAutoEnableUserRef.current !== uid) {
        lastStealthAutoEnableUserRef.current = uid;
        didAutoEnableStealthRef.current = false;
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        setIsStealthAllowed(false);
        return;
      }

      try {
        setIsStealthAllowed(null);
        setIsStealthAllowed(await evaluateStealthAllowed(currentUser.uid));
      } catch (error) {
        console.error('Failed to load payment for stealth access:', error);
        setIsStealthAllowed(null);
      }
    });

    return () => unsubscribe();
  }, [evaluateStealthAllowed]);

  useEffect(() => {
    if (
      !isStealthSupported ||
      stealthModeEnabled === null ||
      isStealthAllowed !== true ||
      isDocumentWindowRoute ||
      typeof window === 'undefined'
    ) {
      return;
    }

    if (didAutoEnableStealthRef.current) {
      return;
    }

    const api = window?.electronAPI;
    if (!api?.setStealthModeState) {
      return;
    }

    if (!stealthModeEnabled) {
      const pref = (() => {
        try {
          return localStorage.getItem(STEALTH_PREF_KEY);
        } catch {
          return null;
        }
      })();

      if (pref === 'off') {
        didAutoEnableStealthRef.current = true;
        return;
      }
      didAutoEnableStealthRef.current = true;
      api
        .setStealthModeState(true)
        .then((result) => {
          setStealthModeEnabled(Boolean(result));
        })
        .catch((error) => {
          didAutoEnableStealthRef.current = false;
          console.error(
            'Failed to auto-enable stealth for eligible user:',
            error,
          );
        });
    } else {
      didAutoEnableStealthRef.current = true;
    }
  }, [
    isStealthAllowed,
    stealthModeEnabled,
    isStealthSupported,
    isDocumentWindowRoute,
  ]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser && window?.electronAPI?.sendUserId) {
        console.log('🔥 Sending user ID via IPC:', currentUser.uid);
        window.electronAPI.sendUserId(currentUser.uid);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Skip auto-disable when user is testing stealth mode
    if (isTestingStealthMode) {
      return;
    }

    if (isDocumentWindowRoute) {
      return;
    }

    if (
      !isStealthSupported ||
      stealthModeEnabled === null ||
      isStealthAllowed !== false ||
      typeof window === 'undefined'
    ) {
      return;
    }

    const api = window?.electronAPI;
    if (!api?.setStealthModeState) {
      return;
    }

    if (stealthModeEnabled && !isStealthAllowed) {
      api
        .setStealthModeState(false)
        .then((result) => {
          setStealthModeEnabled(Boolean(result));
        })
        .catch((error) => {
          console.error(
            'Failed to auto-disable stealth for non-eligible user:',
            error,
          );
        });
    }
  }, [
    isStealthAllowed,
    stealthModeEnabled,
    isStealthSupported,
    isTestingStealthMode,
  ]);

  // Listen for navigation events from electron
  useEffect(() => {
    if (window?.electronAPI?.onNavigateTo) {
      const unsubscribe = window.electronAPI.onNavigateTo((url) => {
        navigate(url);
      });

      return () => unsubscribe?.();
    }
  }, [navigate]);

  // Listen for transparency changes from mini app
  useEffect(() => {
    if (window?.electronAPI?.onTransparencyChanged) {
      const unsubscribe = window.electronAPI.onTransparencyChanged(
        (newOpacity) => {
          setOpacity(newOpacity);
        },
      );

      return () => unsubscribe?.();
    }
  }, [setOpacity]);

  // Listen for quit-from-widget: close all active sessions then quit
  useEffect(() => {
    const api = window?.electronAPI;
    if (!api?.on) return;

    const handleCloseAllSessionsThenQuit = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const collectionPath = `users/${user.uid}/sessions`;
          const querySnapshot = await getDocs(collection(db, collectionPath));
          const sessions = querySnapshot.docs.map((d) => ({
            ...d.data(),
            id: d.id,
          }));
          const cleaned = await autoArchiveStaleActiveSessions(
            user.uid,
            sessions,
          );
          const activeSessions = cleaned.filter((s) => s.active === true);

          for (const session of activeSessions) {
            try {
              await updateDoc(doc(db, collectionPath, session.id), {
                active: false,
                archived: true,
                terminated_timestamp: serverTimestamp(),
              });
            } catch (_) {}
          }

          if (activeSessions.length > 0 && api.stopAudioCapture) {
            api.stopAudioCapture();
          }
        }
      } catch (err) {
        console.error('Error closing sessions before quit:', err);
      }

      api.quitApp?.();
    };

    api.on('close-all-sessions-then-quit', handleCloseAllSessionsThenQuit);
    return () => {
      api.removeAllListeners?.('close-all-sessions-then-quit');
    };
  }, []);

  // Handle mouse movement when hovering
  const handleMouseMove = (e) => {
    if (
      isOpacityLocked ||
      !isHovering ||
      !sliderRef.current ||
      !sliderContainerRef.current
    )
      return;

    const rect = sliderContainerRef.current.getBoundingClientRect();
    // Ignore mouse moves outside the slider bounds to avoid unintended snaps
    if (e.clientX < rect.left || e.clientX > rect.right) {
      return;
    }
    const sliderWidth = rect.width;
    const offsetX = e.clientX - rect.left;

    // Calculate the percentage of the slider width
    let percentage = Math.min(Math.max((offsetX / sliderWidth) * 100, 0), 100);

    // Round to the nearest step (10)
    percentage = Math.round(percentage / 10) * 10;

    setOpacity(percentage);

    // Sync transparency with mini app via electron IPC
    if (window.electronAPI?.setTransparency) {
      window.electronAPI.setTransparency(percentage);
    }
  };

  // Resize logic
  const startResize = (e, direction) => {
    e.preventDefault();
    setIsResizing(true);
    resizeDirectionRef.current = direction;

    // Get initial window bounds and mouse position
    initialBoundsRef.current = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    initialMousePosRef.current = { x: e.screenX, y: e.screenY };

    window.electronAPI.send('start-resize', direction);
  };

  const handleResize = (e) => {
    if (!isResizing || !resizeDirectionRef.current) return;

    const deltaX = e.screenX - initialMousePosRef.current.x;
    const deltaY = e.screenY - initialMousePosRef.current.y;
    const newBounds = { ...initialBoundsRef.current };

    // Adjust bounds based on resize direction
    switch (resizeDirectionRef.current) {
      case 'top':
        newBounds.height = Math.max(
          50,
          initialBoundsRef.current.height - deltaY,
        );
        newBounds.y = initialBoundsRef.current.y + deltaY;
        break;
      case 'bottom':
        newBounds.height = Math.max(
          50,
          initialBoundsRef.current.height + deltaY,
        );
        break;
      case 'left':
        newBounds.width = Math.max(
          100,
          initialBoundsRef.current.width - deltaX,
        );
        break;
      case 'right':
        newBounds.width = Math.max(
          100,
          initialBoundsRef.current.width + deltaX,
        );
        break;
      case 'top-left':
        newBounds.width = Math.max(
          100,
          initialBoundsRef.current.width - deltaX,
        );
        newBounds.height = Math.max(
          50,
          initialBoundsRef.current.height - deltaY,
        );
        newBounds.y = initialBoundsRef.current.y + deltaY;
        newBounds.x = initialBoundsRef.current.x + deltaX;
        break;
      case 'top-right':
        newBounds.width = Math.max(
          100,
          initialBoundsRef.current.width + deltaX,
        );
        newBounds.height = Math.max(
          50,
          initialBoundsRef.current.height - deltaY,
        );
        newBounds.y = initialBoundsRef.current.y + deltaY;
        break;
      case 'bottom-left':
        newBounds.width = Math.max(
          100,
          initialBoundsRef.current.width - deltaX,
        );
        newBounds.height = Math.max(
          50,
          initialBoundsRef.current.height + deltaY,
        );
        newBounds.x = initialBoundsRef.current.x + deltaX;
        break;
      case 'bottom-right':
        newBounds.width = Math.max(
          100,
          initialBoundsRef.current.width + deltaX,
        );
        newBounds.height = Math.max(
          50,
          initialBoundsRef.current.height + deltaY,
        );
        break;
    }

    // Throttle resize updates with requestAnimationFrame to prevent jitter
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      window.electronAPI.send('resize-window', {
        direction: resizeDirectionRef.current,
        x: e.screenX,
        y: e.screenY,
        width: newBounds.width,
        height: newBounds.height,
      });
    });
  };

  const stopResize = () => {
    setIsResizing(false);
    resizeDirectionRef.current = null;
    initialBoundsRef.current = null;
    initialMousePosRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    window.electronAPI.send('stop-resize');
  };

  // Add global event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResize);
      window.addEventListener('mouseup', stopResize, { once: true });
    }

    return () => {
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [isResizing]);

  // Set up event listeners for mouse movements
  useEffect(() => {
    if (isHovering && !isOpacityLocked) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isHovering, isOpacityLocked]);

  // Sync hover state when lock toggles
  useEffect(() => {
    if (isOpacityLocked) {
      setIsHovering(false);
    } else {
      if (isPointerInsideSliderRef.current) {
        setIsHovering(true);
      }
    }
  }, [isOpacityLocked]);

  // Handle opacity lock toggle and sync to other windows
  const handleOpacityLockToggle = () => {
    const newLockState = !isOpacityLocked;
    setIsOpacityLocked(newLockState);

    // Sync to other windows via IPC
    if (window?.electronAPI?.setOpacityLock) {
      window.electronAPI.setOpacityLock(newLockState);
    }
  };

  return (
    <div className="max-h-screen flex flex-col overflow-hidden rounded-xl relative bg-transparent relative">
      <SafeTooltipHost />
      {/* Main draggable title bar - fixed at top */}
      {!isDocumentWindowRoute && (
        <div
          className="flex-shrink-0 h-11 flex items-center justify-between px-4 pr-2 rounded-xl"
          style={{
            zIndex: 99999,
            WebkitAppRegion: 'drag',
            background: `linear-gradient(to bottom,
                rgba(2, 6, 23, ${opacity / 100}),
                rgba(2, 6, 23, ${opacity / 100}))`,
          }}
        >
          <div
            className="flex items-center gap-1 sm:gap-3 relative z-50"
            style={{ WebkitAppRegion: 'no-drag' }} // Override drag for interactive elements
          >
            <div className="flex items-center gap-2">
              <button
                onClick={checkActiveSessionsBeforeClose}
                className="w-3 h-3 rounded-full bg-yellow-500 group hover:bg-yellow-600 flex items-center justify-center transition-colors cursor-default"
                data-safe-tooltip="Minimize"
              >
                <Minus
                  size={8}
                  className="opacity-50 group-hover:opacity-100"
                  color="black"
                />
              </button>
            </div>
            {/* Brand logo */}
            <div
              className="flex items-end px-2 py-0.5"
              style={{ WebkitAppRegion: 'drag' }}
            >
              <img
                src={logoImage}
                alt="LockedIn AI"
                className="h-6 object-contain"
                style={{
                  WebkitUserDrag: 'none',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
                draggable={false}
              />
            </div>
          </div>

          {/* Right side - Transparency controls */}
          <div
            className="flex items-center px-1 sm:px-2 py-1 justify-end overflow-visible"
            style={{ WebkitAppRegion: 'no-drag' }} // Override drag for interactive elements
          >
            {isStealthSupported && stealthModeEnabled !== null && (
              <button
                onClick={handleStealthToggleClick}
                disabled={isStealthUpdating}
                className={`relative group flex items-center gap-1 text-[10px] font-semibold transition-all cursor-pointer hover:opacity-80 ${isStealthUpdating ? 'opacity-50' : ''}`}
                style={{ WebkitAppRegion: 'no-drag' }}
              >
                {stealthModeEnabled ? (
                  <BsShieldFillCheck className="text-cyan-300" size={13} />
                ) : (
                  <GiShieldDisabled className="text-gray-500" size={13} />
                )}
                <span className="text-gray-200 mr-1 max-w-0 opacity-0 group-hover:max-w-[70px] group-hover:opacity-100 transition-all duration-500 overflow-hidden whitespace-nowrap">
                  {stealthModeEnabled ? 'Stealth on' : 'Stealth off'}
                </span>
                <div className="absolute top-full right-0 mt-2 hidden group-hover:flex pointer-events-none z-[100000]">
                  <div className="relative bg-gray-900/95 backdrop-blur-md border border-cyan-400/30 text-white text-[10px] rounded-lg px-2.5 py-2 w-[150px] shadow-2xl whitespace-normal leading-relaxed">
                    {stealthModeEnabled
                      ? 'Click to disable stealth mode'
                      : isStealthAllowed
                        ? 'Click to enable stealth mode'
                        : 'Click to test stealth mode'}
                    <div className="absolute -top-2 right-2">
                      <div className="border-[5px] border-transparent border-b-gray-900/95" />
                    </div>
                  </div>
                </div>
              </button>
            )}
            {/* Test Stealth Mode Button */}
            {isStealthSupported && (
              <button
                onClick={() => setShowStealthTestModal(true)}
                className="relative group flex items-center gap-1 text-[10px] font-medium text-cyan-400 hover:text-cyan-300 transition-all cursor-pointer px-1.5 py-0.5 rounded hover:bg-cyan-500/10"
                style={{ WebkitAppRegion: 'no-drag' }}
              >
                <span>Test</span>
                <div className="absolute top-full right-0 mt-2 hidden group-hover:flex pointer-events-none z-[100000]">
                  <div className="relative bg-gray-900/95 backdrop-blur-md border border-cyan-400/30 text-white text-[10px] rounded-lg px-2.5 py-2 w-[150px] shadow-2xl whitespace-normal leading-relaxed">
                    See stealth mode in action with a live screen capture demo
                    <div className="absolute -top-2 right-2">
                      <div className="border-[5px] border-transparent border-b-gray-900/95" />
                    </div>
                  </div>
                </div>
              </button>
            )}
            <ClickThroughIndicator isActive={isWindowActive} />
            <div className="flex items-center gap-1 sm:gap-2 rounded-lg transition-colors duration-200 group">
              <button
                onClick={handleOpacityLockToggle}
                className="flex items-center gap-1 rounded transition-all duration-200 cursor-pointer"
                data-safe-tooltip={
                  isOpacityLocked
                    ? 'Click to unlock transparency hover'
                    : 'Click to lock transparency hover'
                }
              >
                <Eye
                  size={13}
                  className={`${isOpacityLocked ? 'text-cyan-300' : 'text-gray-300'} flex-shrink-0`}
                />
              </button>
              {/* Slider wrapper has its own hover scope */}
              <div
                className="flex items-center"
                onMouseEnter={() => {
                  isPointerInsideSliderRef.current = true;
                  if (!isOpacityLocked) setIsHovering(true);
                }}
                onMouseLeave={() => {
                  isPointerInsideSliderRef.current = false;
                  setIsHovering(false);
                }}
              >
                {/* Hover hotspot to allow expansion when collapsed on small screens */}
                <div
                  ref={sliderContainerRef}
                  className="relative w-0 h-5 flex items-center overflow-hidden transition-all duration-100 group-hover:w-20 sm:group-hover:w-24"
                >
                  {/* Track */}
                  <div className="w-full h-1 bg-white bg-opacity-30 rounded-md" />

                  {/* Thumb */}
                  <button
                    ref={sliderRef}
                    className={`absolute h-3 w-3 rounded-full transform -translate-y-1/2 top-1/2 transition-all duration-150 cursor-pointer flex items-center justify-center ${
                      isOpacityLocked
                        ? 'bg-gradient-to-br from-cyan-400 to-cyan-600 ring-2 ring-cyan-300/50 ring-offset-1 ring-offset-gray-800 shadow-lg hover:shadow-xl'
                        : 'bg-white'
                    }`}
                    style={{
                      left: `calc(${opacity}% - ${opacity === 100 ? '12px' : opacity === 0 ? '0px' : '6px'})`,
                      transform: isHovering
                        ? 'translateY(-50%) scale(1.2)'
                        : 'translateY(-50%)',
                      boxShadow: isOpacityLocked
                        ? '0 4px 12px rgba(6, 182, 212, 0.4), 0 0 0 1px rgba(6, 182, 212, 0.2)'
                        : undefined,
                    }}
                    onClick={handleOpacityLockToggle}
                    data-safe-tooltip={
                      isOpacityLocked
                        ? 'Click to unlock transparency hover'
                        : 'Click to lock transparency hover'
                    }
                  ></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resize Borders and Corners */}
      {!isDocumentWindowRoute && (
        <>
          {/* Edges */}
          <div
            id="resize-bottom"
            className="absolute bottom-0 left-0 w-full h-4 cursor-default"
            style={{ zIndex: 99998, WebkitAppRegion: 'no-drag' }}
            onMouseDown={(e) => startResize(e, 'bottom')}
          />
          <div
            id="resize-left"
            className="absolute top-0 left-0 h-full w-4 cursor-default"
            style={{ zIndex: 99998, WebkitAppRegion: 'no-drag' }}
            onMouseDown={(e) => startResize(e, 'left')}
          />
          <div
            id="resize-right"
            className="absolute top-0 right-0 h-full w-4 cursor-default"
            style={{ zIndex: 99998, WebkitAppRegion: 'no-drag' }}
            onMouseDown={(e) => startResize(e, 'right')}
          />

          {/* Corners */}
          <div
            id="resize-bottom-left"
            className="absolute bottom-0 left-0 w-5 h-5 cursor-default"
            style={{ zIndex: 9999999, WebkitAppRegion: 'no-drag' }}
            onMouseDown={(e) => startResize(e, 'bottom-left')}
          />
          <div
            id="resize-bottom-right"
            className="absolute bottom-0 right-0 w-5 h-5 cursor-default"
            style={{ zIndex: 9999999, WebkitAppRegion: 'no-drag' }}
            onMouseDown={(e) => startResize(e, 'bottom-right')}
          />

          {/* Resize handle — visible diagonal-arrow button in the bottom-right
              corner. Acts as a resize grip (mirrors #resize-bottom-right).
              Native `title=` would leak past stealth mode → use data-safe-tooltip. */}
          <div
            id="window-resize-handle"
            aria-label="Drag to resize window"
            data-safe-tooltip="Resize"
            className="absolute flex items-center justify-center transition-opacity duration-150 opacity-60 hover:opacity-100"
            style={{
              bottom: 4,
              right: 4,
              width: 22,
              height: 22,
              borderRadius: 6,
              zIndex: 10000000,
              WebkitAppRegion: 'no-drag',
              cursor: 'nwse-resize',
            }}
            onMouseDown={(e) => startResize(e, 'bottom-right')}
          >
            <MoveDiagonal
              size={12}
              strokeWidth={2.5}
              className="text-cyan-300"
              style={{ pointerEvents: 'none' }}
            />
          </div>
        </>
      )}

      {/* Main content area - scrollable, fills remaining space below title bar */}
      <div
        className={`flex flex-col rounded-xl min-h-0 ${isDocumentWindowRoute ? '' : 'mt-2'}`}
        style={{
          background: isDocumentWindowRoute
            ? 'transparent'
            : `linear-gradient(to bottom,
                rgba(2, 6, 23, ${opacity / 100}),
                rgba(2, 6, 23, ${opacity / 100}))`,
        }}
      >
        <AuthProvider>
          <ModelTiersProvider>
            <PaymentProvider>
              <UserDataProvider>
                <AutoUpdater />
                <Routes>
                  <Route path="/" element={<WelcomePage />} />
                  <Route path="/desktop-login" element={<DesktopAuthPage />} />
                  <Route path="/vscode-login" element={<VSCodeAuthPage />} />

                  {/* Protected Routes */}
                  <Route path="/app/*" element={<PrivateRoute />}>
                    <Route
                      path="document-window"
                      element={<DocumentWindowPage />}
                    />
                    <Route
                      path="*"
                      element={
                        <>
                          <LandingPage />
                        </>
                      }
                    />
                  </Route>

                  {/* Authentication Routes */}
                  <Route path="/desktop-login" element={<DesktopAuthPage />} />
                  <Route path="/sign-in/*" element={<AuthPage />} />
                  <Route path="/sign-up/*" element={<AuthPage />} />

                  {/* Fallback Route */}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>

                {/* Active Session Warning Modal */}
                {showActiveSessionWarning && (
                  <ActiveSessionWarningModal
                    onClose={() => setShowActiveSessionWarning(false)}
                    onSessionClosed={handleSessionClosed}
                  />
                )}

                <StealthDisableConfirmModal
                  isOpen={showStealthDisableConfirm}
                  isLoading={isStealthUpdating}
                  onCancel={() => setShowStealthDisableConfirm(false)}
                  onConfirm={handleConfirmStealthDisable}
                />

                {/* Stealth Test Modal */}
                <StealthTestModal
                  isOpen={showStealthTestModal}
                  onClose={() => setShowStealthTestModal(false)}
                  stealthModeEnabled={stealthModeEnabled}
                  isStealthAllowed={isStealthAllowed}
                  onTestingStateChange={setIsTestingStealthMode}
                  onToggleStealth={async () => {
                    const api = window?.electronAPI;
                    if (!api?.setStealthModeState) return;
                    const newState = !stealthModeEnabled;
                    try {
                      localStorage.setItem(
                        STEALTH_PREF_KEY,
                        newState ? 'on' : 'off',
                      );
                    } catch {
                      // ignore
                    }
                    const result = await api.setStealthModeState(newState);
                    setStealthModeEnabled(Boolean(result));
                  }}
                />
              </UserDataProvider>
            </PaymentProvider>
          </ModelTiersProvider>
        </AuthProvider>
      </div>
    </div>
  );
}

function App() {
  return <MainApp />;
}

export default function Example() {
  if (typeof window !== 'undefined') {
    try {
      const isHttp =
        window.location.protocol === 'http:' ||
        window.location.protocol === 'https:';
      const hasHash = Boolean(window.location.hash);
      const isIndexHtml = /\/index\.html$/i.test(
        window.location.pathname || '',
      );

      if (
        isHttp &&
        !hasHash &&
        !isIndexHtml &&
        window.location.pathname &&
        window.location.pathname !== '/'
      ) {
        const next = `/#${window.location.pathname}${window.location.search || ''}`;
        window.location.replace(next);
        return null;
      }
    } catch (_) {}
  }

  return (
    <TransparencyProvider>
      <FontSizeProvider>
        <CodeViewerProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </CodeViewerProvider>
      </FontSizeProvider>
    </TransparencyProvider>
  );
}
