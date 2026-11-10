class SoundService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtor) {
        this.ctx = new AudioCtor();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // 1. صوت النقر الأساسي (ناعم)
  playClick() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  // 2. صوت ميكانيكي (للإعدادات والتروس)
  playMechanical() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'square'; // Square wave for mechanical feel
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  // 3. صوت التبديل (للوضع الليلي والملاحظات) - حاد وسريع
  playToggle() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  // 4. صوت سحري (للمرشد والتحليل) - نغمات متتالية
  playMagic() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Arpeggio: C5, E5, G5, C6
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
       const osc = ctx.createOscillator();
       const gain = ctx.createGain();
       osc.connect(gain);
       gain.connect(ctx.destination);

       osc.type = 'sine';
       osc.frequency.setValueAtTime(freq, now + i * 0.06);
       
       gain.gain.setValueAtTime(0.03, now + i * 0.06);
       gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.3);

       osc.start(now + i * 0.06);
       osc.stop(now + i * 0.06 + 0.3);
    });
  }

  // 5. صوت تغيير التبويب (للسجل والمفضلة) - صوت انزلاق هوائي
  playTabChange() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(500, ctx.currentTime + 0.15); // Slide up

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  // 6. صوت اختيار خيار رئيسي (لكل زر نغمة مختلفة)
  playOptionSelect(index: number) {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    // Pentatonic scaleish frequencies to make them sound good together
    // 0: C4, 1: E4, 2: G4, 3: C5
    const freqs = [261.63, 329.63, 392.00, 523.25]; 
    const freq = freqs[index % freqs.length] || 440;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'triangle'; // Richer sound for main options
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.8, ctx.currentTime + 0.2); // Slight dip

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  // 7. صوت النجاح (للحفظ والإجابة الصحيحة)
  playSuccess() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.type = 'sine';
    osc2.type = 'triangle';

    // Major Chord
    osc1.frequency.setValueAtTime(523.25, t); 
    osc1.frequency.setValueAtTime(659.25, t + 0.1);
    osc2.frequency.setValueAtTime(523.25, t);
    osc2.frequency.setValueAtTime(783.99, t + 0.1); 

    gain.gain.setValueAtTime(0.05, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.4);
    osc2.stop(t + 0.4);
  }

  // 8. صوت الخطأ/الحذف
  playError() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  // 9. صوت "بوب" للعودة والفتح
  playPop() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  // 10. Doctor Signature Sound (Heartbeat + Digital Scan)
  playDoctorSignature() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Part 1: Heartbeat (Low Thud)
    const oscLow = ctx.createOscillator();
    const gainLow = ctx.createGain();
    oscLow.connect(gainLow);
    gainLow.connect(ctx.destination);
    
    oscLow.type = 'sine';
    oscLow.frequency.setValueAtTime(60, t);
    oscLow.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    
    gainLow.gain.setValueAtTime(0.2, t);
    gainLow.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    
    oscLow.start(t);
    oscLow.stop(t + 0.15);

    // Heartbeat echo (Diastole)
    const oscLow2 = ctx.createOscillator();
    const gainLow2 = ctx.createGain();
    oscLow2.connect(gainLow2);
    gainLow2.connect(ctx.destination);
    oscLow2.type = 'sine';
    oscLow2.frequency.setValueAtTime(60, t + 0.25);
    oscLow2.frequency.exponentialRampToValueAtTime(40, t + 0.35);
    gainLow2.gain.setValueAtTime(0.15, t + 0.25);
    gainLow2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    oscLow2.start(t + 0.25);
    oscLow2.stop(t + 0.4);

    // Part 2: Sci-Fi Scan (High Pitch sweep)
    const oscHigh = ctx.createOscillator();
    const gainHigh = ctx.createGain();
    oscHigh.connect(gainHigh);
    gainHigh.connect(ctx.destination);
    
    oscHigh.type = 'sine';
    oscHigh.frequency.setValueAtTime(800, t + 0.4);
    oscHigh.frequency.linearRampToValueAtTime(1200, t + 0.6);
    
    gainHigh.gain.setValueAtTime(0, t + 0.4);
    gainHigh.gain.linearRampToValueAtTime(0.03, t + 0.5); // Slightly lower volume
    gainHigh.gain.linearRampToValueAtTime(0, t + 0.7);

    oscHigh.start(t + 0.4);
    oscHigh.stop(t + 0.7);
  }
}

export const soundService = new SoundService();