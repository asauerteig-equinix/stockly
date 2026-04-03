"use client";

type KioskTone = "scan-success" | "scan-error" | "booking-success";

let sharedAudioContext: AudioContext | null = null;

async function ensureAudioContext() {
  if (typeof window === "undefined" || !window.AudioContext) {
    return null;
  }

  const audioContext = sharedAudioContext ?? new window.AudioContext();
  sharedAudioContext = audioContext;

  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch {
      return audioContext;
    }
  }

  return audioContext;
}

export async function primeKioskAudio() {
  await ensureAudioContext();
}

export function playKioskTone(tone: KioskTone) {
  const audioContext = sharedAudioContext;

  if (!audioContext || audioContext.state !== "running") {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const startAt = audioContext.currentTime;

  if (tone === "scan-success") {
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(1320, startAt + 0.08);
    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(0.12, startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18);
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.18);
    return;
  }

  if (tone === "scan-error") {
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(440, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(220, startAt + 0.14);
    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(0.08, startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.22);
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.22);
    return;
  }

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(660, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(990, startAt + 0.08);
  oscillator.frequency.exponentialRampToValueAtTime(1320, startAt + 0.16);
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(0.14, startAt + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.11, startAt + 0.12);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.28);
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + 0.28);
}
