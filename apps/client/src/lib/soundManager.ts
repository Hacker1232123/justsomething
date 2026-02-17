import checkSoundUrl from "../../../../assets/sounds/check.wav";
import checkmateSoundUrl from "../../../../assets/sounds/checkmate.wav";
import captureSoundUrl from "../../../../assets/sounds/capture.wav";
import moveSoundUrl from "../../../../assets/sounds/move.wav";

interface PriorityFlags {
  check: boolean;
  checkmate: boolean;
  capture: boolean;
}

export class SoundManager {
  private muted: boolean;
  private readonly move = new Audio(moveSoundUrl);
  private readonly check = new Audio(checkSoundUrl);
  private readonly capture = new Audio(captureSoundUrl);
  private readonly checkmate = new Audio(checkmateSoundUrl);

  constructor(initialMuted: boolean) {
    this.muted = initialMuted;
    this.move.volume = 0.8;
    this.check.volume = 0.9;
    this.capture.volume = 0.85;
    this.checkmate.volume = 0.95;
  }

  setMuted(nextMuted: boolean): void {
    this.muted = nextMuted;
  }

  playByPriority(flags: PriorityFlags): void {
    if (this.muted) {
      return;
    }

    if (flags.checkmate) {
      this.play(this.checkmate);
      return;
    }

    if (flags.check) {
      this.play(this.check);
      return;
    }

    if (flags.capture) {
      this.play(this.capture);
      return;
    }

    this.play(this.move);
  }

  private play(audio: HTMLAudioElement): void {
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Ignore browser autoplay restrictions.
    });
  }
}
