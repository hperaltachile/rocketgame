/**
 * Channel between a React game page and its Phaser scene. React sends
 * commands and settings; the scene reports score and game over. Commands sent
 * before the scene is listening (Phaser still loading) are queued.
 */
export class GameBridge<Command, State = never> {
  /** Current settings, read by the scene whenever it needs them. */
  sound = true;
  reducedMotion = false;

  onScore: (score: number) => void = () => {};
  onOver: (score: number) => void = () => {};
  /** Extra game state for the page (counters, messages), if the game has any. */
  onState: (state: State) => void = () => {};

  private handler: ((command: Command) => void) | null = null;
  private queue: Command[] = [];

  /** Called by React whenever settings change. */
  configure(settings: { sound: boolean; reducedMotion: boolean }): void {
    this.sound = settings.sound;
    this.reducedMotion = settings.reducedMotion;
  }

  /** Called by React to receive score updates, game over and extra state. */
  report(handlers: {
    onScore: (score: number) => void;
    onOver: (score: number) => void;
    onState?: (state: State) => void;
  }): void {
    this.onScore = handlers.onScore;
    this.onOver = handlers.onOver;
    if (handlers.onState) this.onState = handlers.onState;
  }

  send(command: Command): void {
    if (this.handler) this.handler(command);
    else this.queue.push(command);
  }

  /** Called by the scene. Returns an unsubscribe function. */
  listen(handler: (command: Command) => void): () => void {
    this.handler = handler;
    for (const command of this.queue.splice(0)) handler(command);
    return () => {
      if (this.handler === handler) this.handler = null;
    };
  }
}

export type BaseCommand =
  { type: "start" } | { type: "pause" } | { type: "resume" };
