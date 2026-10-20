import './ui/stage.css';
import { render } from 'preact';
import { App } from './ui/App';

const root = document.getElementById('app');
if (root === null) {
  throw new Error('#app root element missing');
}
render(<App />, root);
