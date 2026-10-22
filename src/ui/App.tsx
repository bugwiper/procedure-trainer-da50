import { signal } from '@preact/signals';
import { useLayoutEffect } from 'preact/hooks';
import { DA50RG_ENV } from '../aircraft/da50rg/aircraft';
import { DA50RG_INDICATORS } from '../aircraft/da50rg/indicators';
import { DA50RG } from '../aircraft/da50rg/panel';
import { OPEN_ACCESS } from '../scenario/packs';
import { VITE_PACKS } from '../scenario/packs-vite';
import { About } from './about/About';
import { browserStorage, createAckStore } from './ack';
import { createPanelBridge } from './bridge';
import { attachClockDriver } from './clock-driver';
import { anyModalOpen, holdModal, releaseModal } from './modals';
import { Panel } from './panel/Panel';
import { isStrayFullPanelClick } from './panel/tap-intent';
import { buttonCorner, isZoomed, viewChangedByTapAt, zoomOut } from './panel/zoom';
import { Ack } from './screens/Ack';
import { Briefing } from './screens/Briefing';
import { LevelPick } from './screens/LevelPick';
import { EmptyNotice, LeaveConfirm, LoadError } from './screens/Confirm';
import { Debrief } from './screens/Debrief';
import { createSession } from './session';
import type { Level } from './session';

const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS, DA50RG_ENV);

// The session owns randomness and the run clock; a run starts on the full panel (UI-SPEC).
const session = createSession({
  bridge,
  packs: { provider: VITE_PACKS, policy: OPEN_ACCESS },
  env: DA50RG_ENV,
  rng: Math.random,
  onRunStart: () => {
    zoomOut(bridge.registry.viewBox);
  },
});

// The run's virtual clock follows real frames while the run is live, the tab is visible and no
// modal is open (SCN-08); the engine never sees a real clock.
const detachClockDriver = attachClockDriver({
  session,
  raf: (run) => requestAnimationFrame(run),
  cancelRaf: (handle) => {
    cancelAnimationFrame(handle);
  },
  now: () => performance.now(),
  hidden: () => document.hidden,
  blocked: () => anyModalOpen.peek(),
});
import.meta.hot?.dispose(detachClockDriver);

// Read-only view for e2e specs; the e2e build only (VITE_TEST_HOOKS=1).
if (import.meta.env.VITE_TEST_HOOKS === '1') {
  window.__panelSession = {
    screen: () => session.screen.value,
    scenarioId: () => session.scenario.value?.id ?? null,
    result: () => session.result.value,
    now: () => session.clock.value?.now() ?? null,
    onset: () => session.onset.value,
    recording: () => session.recording.value,
  };
}

// UI-only state: neither signal touches the panel store.
const aboutOpen = signal(false);
// The first-run training-aid acknowledgment (PLT-04, D-17); blocked storage falls back to memory.
const ackStore = createAckStore(browserStorage());
const ackRequired = signal(ackStore.required());
const rotateHintDismissed = signal(false);

/** When a pointer last went down on the Full panel button (event.timeStamp); null until it does. */
let fullPanelPressedAt: number | null = null;

const acceptAck = () => {
  ackStore.accept();
  ackRequired.value = false;
};

// About is not on the modal shell; it holds its own id so the run clock waits while it is open.
const openAbout = () => {
  holdModal('about');
  aboutOpen.value = true;
};

const closeAbout = () => {
  aboutOpen.value = false;
  releaseModal('about');
};

const closeDebrief = () => {
  session.closeDebrief();
};

const startRun = () => {
  session.startRun();
};

const setLevel = (level: Level) => {
  session.setLevel(level);
};

const backToPanel = () => {
  session.backToPanel();
};

export function App() {
  const screen = session.screen.value;
  const scenario = session.scenario.value;
  const briefed = session.briefing.value;
  const result = session.result.value;
  // The footer grows to hold the 44 px run button from the briefing until the debrief closes, so
  // the panel does not resize at Start run or at Procedure complete (UI-SPEC D-15, U-02).
  const inSession = screen !== 'free' && screen !== 'choosing';
  // Escape closes the choose list, unless a modal on top of it takes the key (its own Escape).
  const choosing = screen === 'choosing';
  useLayoutEffect(() => {
    if (!choosing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || anyModalOpen.peek()) return;
      e.preventDefault();
      session.closeChooser();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [choosing]);
  return (
    <div class="stage">
      <div class="panel-area">
        <Panel bridge={bridge} session={session} />
        {isZoomed.value ? (
          <button
            type="button"
            class="zoom-out"
            data-testid="zoom-out"
            data-corner={buttonCorner.value}
            onPointerDown={(e) => {
              fullPanelPressedAt = e.timeStamp;
            }}
            onClick={(e) => {
              // WebKit can send the click of the double tap that zoomed in to the button that
              // just appeared under the finger; a real tap presses the button first.
              const stray = isStrayFullPanelClick({
                shownAt: viewChangedByTapAt(),
                pressedAt: fullPanelPressedAt,
                clickAt: e.timeStamp,
              });
              if (stray) return;
              zoomOut(bridge.registry.viewBox);
            }}
          >
            Full panel
          </button>
        ) : null}
      </div>
      {rotateHintDismissed.value ? null : (
        <div class="rotate-hint" data-testid="rotate-hint" role="status">
          <span>Rotate to landscape for the full panel</span>
          <button
            type="button"
            data-testid="rotate-hint-dismiss"
            onClick={() => {
              rotateHintDismissed.value = true;
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      <footer class="footer" data-session={inSession ? 'true' : undefined}>
        <span data-testid="training-aid-notice">Training aid only, not the AFM</span>
        <div class="footer-actions">
          {screen === 'running' || screen === 'briefing' ? (
            <button
              type="button"
              class="run-button"
              data-testid="procedure-complete"
              onClick={() => {
                session.complete();
              }}
            >
              Procedure complete
            </button>
          ) : null}
          <button type="button" class="footer-link" data-testid="about-open" onClick={openAbout}>
            About and content policy
          </button>
        </div>
      </footer>
      {aboutOpen.value ? <About onClose={closeAbout} /> : null}
      {screen === 'briefing' && briefed !== null && !session.levelPicked.value ? (
        <LevelPick
          realistic={briefed.scenario.onset !== undefined}
          onLevel={setLevel}
          onBack={backToPanel}
        />
      ) : null}
      {screen === 'briefing' && briefed !== null && session.levelPicked.value ? (
        <Briefing
          briefed={briefed}
          level={session.level.value}
          onStart={startRun}
          onBack={backToPanel}
        />
      ) : null}
      {screen === 'debrief' && scenario !== null && result !== null ? (
        <Debrief
          scenario={scenario}
          result={result}
          level={session.level.value}
          onClose={closeDebrief}
        />
      ) : null}
      {session.confirm.value !== null ? (
        <LeaveConfirm
          onKeep={() => {
            session.keepGoing();
          }}
          onLeave={() => {
            void session.leaveRun();
          }}
        />
      ) : null}
      {session.loadFailure.value !== null ? (
        <LoadError
          onRetry={() => {
            void session.retryLoad();
          }}
          onBack={() => {
            session.dismissFailure();
          }}
        />
      ) : null}
      {session.empty.value ? (
        <EmptyNotice
          onBack={() => {
            session.dismissEmpty();
          }}
        />
      ) : null}
      {ackRequired.value ? <Ack onAccept={acceptAck} /> : null}
    </div>
  );
}
