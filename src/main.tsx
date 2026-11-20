import { render } from 'preact';
import { App } from './app';
import './styles.css';

// Render immediately; anything slow (storage permission, DB open) happens
// inside the app so a hung browser API can never leave a blank screen.
render(<App />, document.getElementById('app')!);
