import './styles/global.css';
import './styles/menus.css';
import './styles/hud.css';
import './styles/notifications.css';

import { DragonEggGame } from './game/DragonEggGame';
import { AudioSystem } from './game/systems/AudioSystem';
import { UIController } from './ui/UIController';

/**
 * Application entry point. It wires the three long-lived pieces together:
 *   - the HTML/CSS UI layer (UIController + sub-controllers),
 *   - the synthesised AudioSystem (listens on the shared event bus),
 *   - the Phaser game (mounted into #game-container).
 *
 * All three communicate only through the event bus, never directly.
 */
function bootstrap(): void {
  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('Missing #game-container element in index.html');
  }

  // UI + audio are created once and persist across match restarts. The
  // AudioSystem wires itself to the event bus in its constructor.
  const ui = new UIController();
  ui.init();
  new AudioSystem();

  new DragonEggGame(container);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
