import { signal } from '@preact/signals';
import { DA50RG } from '../aircraft/da50rg/panel';
import { About } from './about/About';
import { createPanelBridge } from './bridge';
import { Panel } from './panel/Panel';

const bridge = createPanelBridge(DA50RG);

// UI-only state: neither signal touches the panel store.
const aboutOpen = signal(false);
const rotateHintDismissed = signal(false);

const closeAbout = () => {
  aboutOpen.value = false;
};

export function App() {
  return (
    <div class="stage">
      <Panel bridge={bridge} />
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
      <footer class="footer">
        <span data-testid="training-aid-notice">Training aid only, not the AFM</span>
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
      </footer>
      {aboutOpen.value ? <About onClose={closeAbout} /> : null}
    </div>
  );
}
