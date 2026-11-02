import { effect, signal } from '@preact/signals';
import { useLayoutEffect } from 'preact/hooks';
import { DA50RG_ENV } from '../aircraft/da50rg/aircraft';
import { DA50RG_INDICATORS } from '../aircraft/da50rg/indicators';
import { DA50RG } from '../aircraft/da50rg/panel';
import { OPEN_ACCESS } from '../scenario/packs';
import { VITE_PACKS } from '../scenario/packs-vite';
import { About } from './about/About';
import { browserStorage, createAckStore } from './ack';
import { attachAural } from './audio/driver';
import { createSoundPref } from './audio/sound-pref';
import { browserAudioContext, createSoundPlayer } from './audio/web-audio';
import { createPanelBridge } from './bridge';
import { attachClockDriver } from './clock-driver';
import { anyModalOpen, holdModal, releaseModal } from './modals';
import { Panel } from './panel/Panel';
import { isStrayFullPanelClick } from './panel/tap-intent';
import { buttonCorner, isZoomed, viewChangedByTapAt, zoomOut } from './panel/zoom';
import { Ack } from './screens/Ack';
import { Briefing } from './screens/Briefing';
import { HintBox } from './screens/HintBox';
import { LevelPick } from './screens/LevelPick';
import { RunChecklist } from './screens/RunChecklist';
import type { SheetBody } from './screens/RunChecklist';
import { EmptyNotice, LeaveConfirm, LoadError } from './screens/Confirm';
import { FurtherActions } from './screens/FurtherActions';
import { offersConduct } from '../engine/further';
import { Debrief } from './screens/Debrief';
import { parsePreviewFlags, parsePreviewQuantities } from './preview';
import { branchStatuses } from '../engine/grading';
import { RUN_ERROR_PATH, createSession } from './session';
import type { LoadFailure } from './session';
import type { Level } from './session';
import type { Scenario } from '../scenario/schema';

const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS, DA50RG_ENV);

/**
 * Development flag, read once: ?scene=<id> sets the scene of the free panel (a known id only), so
 * the owner and the e2e see every scene before scenarios name them. A session overrides it.
 */
const FLAG_SCENE =
  typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('scene');

// Preview flags of the free panel (Phase 5, C-03): ?q=id:value,... sets start quantities and
// ?flags=name,... sets flags, applied once; unknown or out-of-range entries are ignored and a
// RESET clears them like any run state.
if (typeof location !== 'undefined') {
  const quantities = parsePreviewQuantities(location.search, DA50RG_ENV.quantities);
  if (Object.keys(quantities).length > 0) {
    bridge.setQuantities({ ...bridge.quantities.peek(), ...quantities });
  }
  const flags = parsePreviewFlags(
    location.search,
    DA50RG_ENV.physics.reactions.map((reaction) => reaction.flag),
  );
  if (Object.keys(flags).length > 0) bridge.setFlags(flags);
}

// The session owns randomness and the run clock; a run starts on the full panel (UI-SPEC).
const session = createSession({
  bridge,
  packs: { provider: VITE_PACKS, policy: OPEN_ACCESS },
  env: DA50RG_ENV,
  rng: Math.random,
  ...(FLAG_SCENE === null ? {} : { freeScene: FLAG_SCENE }),
  onRunStart: () => {
    zoomOut(bridge.registry.extent);
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
  onError: (error) => {
    session.failRun(error);
  },
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
    variant: () => session.variant.value,
    recording: () => session.recording.value,
  };
}

// The aural cues (Phase 5, A-01 to A-04): off until the footer control Sound is tapped, remembered,
// and only while a run is live. The audio context is created inside that tap (or at the first press
// after a reload with the choice remembered, on pointer, click or key); nothing here reads or changes the run.
const soundPref = createSoundPref(browserStorage());
const soundOn = signal(soundPref.get());
const soundPlayer = createSoundPlayer(browserAudioContext);
const aural = attachAural({
  player: soundPlayer,
  wanted: () => soundOn.peek(),
  running: () => session.screen.peek() === 'running',
  blocked: () => anyModalOpen.peek(),
  hidden: () => document.hidden,
  cas: () => bridge.cas.peek(),
  rpm: () => bridge.quantities.peek()['rpm'] ?? 0,
  runMs: () => session.clock.peek()?.now() ?? null,
  raf: (run) => requestAnimationFrame(run),
  cancelRaf: (handle) => {
    cancelAnimationFrame(handle);
  },
});
const stopAuralEffect = effect(() => {
  // A modal opening, the screen changing: look at once, not at the next frame.
  void anyModalOpen.value;
  void session.screen.value;
  aural.update();
});
const onPress = () => {
  aural.press();
};
const onVisibility = () => {
  aural.update();
};
document.addEventListener('pointerdown', onPress, true);
document.addEventListener('pointerup', onPress, true);
document.addEventListener('click', onPress, true);
document.addEventListener('keydown', onPress, true);
document.addEventListener('visibilitychange', onVisibility);
import.meta.hot?.dispose(() => {
  aural.detach();
  stopAuralEffect();
  document.removeEventListener('pointerdown', onPress, true);
  document.removeEventListener('pointerup', onPress, true);
  document.removeEventListener('click', onPress, true);
  document.removeEventListener('keydown', onPress, true);
  document.removeEventListener('visibilitychange', onVisibility);
});

const toggleSound = () => {
  const next = !soundOn.peek();
  soundPref.set(next);
  soundOn.value = next;
  // Inside the tap, so the browser allows the context to start.
  if (next) soundPlayer.enable();
  else soundPlayer.disable();
  aural.update();
};

if (import.meta.env.VITE_TEST_HOOKS === '1') {
  window.__panelAudio = {
    enabled: () => soundPlayer.stats.enabled,
    tones: () => soundPlayer.stats.tones,
    lastTone: () => soundPlayer.stats.lastTone,
    engineHz: () => soundPlayer.stats.engineHz,
    engineGain: () => soundPlayer.stats.engineGain,
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

/** The message of a run that stopped because of an error (WR-03); nothing for a load failure. */
const runErrorProps = (failure: LoadFailure | null): { runError?: string } => {
  const first = failure?.issues[0];
  return first?.path === RUN_ERROR_PATH ? { runError: first.message } : {};
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

const toggleChecklist = () => {
  session.toggleChecklist();
};

const backToPanel = () => {
  session.backToPanel();
};

/** What the checklist sheet shows now (R-02, R-03): the list, a chosen checklist or the scenario's own. */
function sheetBody(scenario: Scenario): SheetBody {
  const own: SheetBody = {
    kind: 'checklist',
    scenario,
    branches: session.runBranches.value,
    marks: session.checklistMarks.value,
  };
  if (session.level.value !== 'realistic') return own;
  const list = session.checklistList.value;
  const choice = session.checklistChoice.value;
  if (session.checklistView.value === 'list' || choice === null) {
    return {
      kind: 'list',
      list,
      onChoose: (ref) => {
        session.chooseChecklist(ref);
      },
      onRetry: () => {
        session.retryChecklistList();
      },
    };
  }
  const entry = list.entries.find(
    (e) => e.ref.pack === choice.ref.pack && e.ref.scenario === choice.ref.scenario,
  );
  // A checklist of another scenario is shown plain: its branches as its own start state decides.
  if (entry === undefined || entry.scenario.id === scenario.id) return own;
  return {
    kind: 'checklist',
    scenario: entry.scenario,
    branches: branchStatuses(entry.scenario, DA50RG_ENV),
    marks: null,
  };
}

export function App() {
  const screen = session.screen.value;
  const scenario = session.scenario.value;
  const briefed = session.briefing.value;
  const result = session.result.value;
  const sheetShown = screen === 'running' && session.checklistShown.value;
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
      <div class="panel-area" data-checklist-shown={sheetShown ? 'true' : undefined}>
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
              zoomOut(bridge.registry.extent);
            }}
          >
            Full panel
          </button>
        ) : null}
        {sheetShown && scenario !== null ? (
          <RunChecklist
            body={sheetBody(scenario)}
            onHide={toggleChecklist}
            {...(session.level.value === 'realistic'
              ? {
                  onBackToList: () => {
                    session.showChecklistList();
                  },
                }
              : {})}
          />
        ) : null}
        {screen === 'running' && scenario !== null && session.hintShown.value ? (
          <HintBox scenario={scenario} />
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
          <button
            type="button"
            class="footer-link sound-toggle"
            data-testid="sound-toggle"
            aria-pressed={soundOn.value}
            onClick={toggleSound}
          >
            Sound
          </button>
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
      {screen === 'running' && scenario !== null && session.furtherOpen.value ? (
        <FurtherActions
          set={DA50RG_ENV.further}
          conduct={offersConduct(scenario.further)}
          picked={session.decisions.value.map((entry) => entry.id)}
          onPick={(id) => {
            session.decide(id);
          }}
          onClose={() => {
            session.closeFurther();
          }}
        />
      ) : null}
      {screen === 'debrief' && scenario !== null && result !== null ? (
        <Debrief
          further={DA50RG_ENV.further}
          scenario={scenario}
          result={result}
          level={session.level.value}
          checklistUsed={session.checklistChoice.value?.heading ?? null}
          completedAt={session.recording.value?.completedAt ?? 0}
          onClose={closeDebrief}
          onRetry={() => {
            session.retry();
          }}
          onNext={() => {
            void session.nextSituation();
          }}
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
          {...runErrorProps(session.loadFailure.value)}
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
