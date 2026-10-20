import { DA50RG } from '../aircraft/da50rg/panel';
import { createPanelBridge } from './bridge';
import { Panel } from './panel/Panel';

const bridge = createPanelBridge(DA50RG);

export function App() {
  return (
    <div class="stage">
      <Panel bridge={bridge} />
      <footer class="footer">
        <span data-testid="training-aid-notice">Training aid only, not the AFM</span>
      </footer>
    </div>
  );
}
