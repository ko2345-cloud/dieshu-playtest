/** Mock ads until AdMob units exist. Remove-ads hides banner + interstitial, not rewarded. */

type Listener = () => void;

class AdService {
  adsRemoved = false;
  private listeners = new Set<Listener>();

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  setRemoved(value: boolean) {
    this.adsRemoved = value;
    this.emit();
  }

  async showInterstitial(): Promise<boolean> {
    if (this.adsRemoved) return false;
    console.log("[ads] interstitial (mock)");
    return true;
  }

  async showRewarded(): Promise<boolean> {
    console.log("[ads] rewarded (mock) — still available after remove ads");
    return true;
  }
}

export const ads = new AdService();
