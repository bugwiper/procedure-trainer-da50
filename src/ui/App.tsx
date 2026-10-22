import { signal } from '@preact/signals';
import { DA50RG_ENV } from '../aircraft/da50rg/aircraft';
import { DA50RG_INDICATORS } from '../aircraft/da50rg/indicators';
import { DA50RG } from '../aircraft/da50rg/panel';
import { OPEN_ACCESS } from '../scenario/packs';
import { VITE_PACKS } from '../scenario/packs-vite';
import { About } from './about/About';
import { createPanelBridge } from './bridge';
import { Panel } from './panel/Panel';
import { isStrayFullPanelClick } from './panel/tap-intent';
import { buttonCorner, isZoomed, viewChangedByTapAt, zoomOut } from './panel/zoom';
import { Debrief } from './screens/Debrief';
import { createSession } from './session';

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

// Read-only view for e2e specs; the e2e build only (VITE_TEST_HOOKS=1).
if (import.meta.env.VITE_TEST_HOOKS === '1') {
  window.__panelSession = {
    screen: () => session.screen.value,
    scenarioId: () => session.scenario.value?.id ?? null,
    result: () => session.result.value,
    now: () => session.clock.value?.now() ?? null,
  };
}

// UI-only state: neither signal touches the panel store.
const aboutOpen = signal(false);
const rotateHintDismissed = signal(false);

/** When a pointer last went down on the Full panel button (event.timeStamp); null until it does. */
let fullPanelPressedAt: number | null = null;

const closeAbout = () => {
  aboutOpen.value = false;
};

const closeDebrief = () => {
  session.closeDebrief();
};

export function App() {
  const screen = session.screen.value;
  const scenario = session.scenario.value;
  const result = session.result.value;
  // The footer grows to hold the 44 px run button for the whole session, so the panel does not
  // resize at Procedure complete (UI-SPEC D-15 against the legroom area).
  const inSession = screen === 'running' || screen === 'debrief';
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
          {screen === 'running' ? (
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
            class="footer-link"
            data-testid="about-open"
            onClick={() => {
              aboutOpen.value = true;
            }}
          >
            About and content policy
          </button>
        </div>
      </footer>
      {aboutOpen.value ? <About onClose={closeAbout} /> : null}
      {screen === 'debrief' && scenario !== null && result !== null ? (
        <Debrief scenario={scenario} result={result} onClose={closeDebrief} />
      ) : null}
    </div>
  );
}
