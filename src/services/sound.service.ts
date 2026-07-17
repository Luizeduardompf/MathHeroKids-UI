import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// ─── Sound catalog ──────────────────────────────────────────────────────────
// Fontes: assets/sounds/ — descarregados do Mixkit (licença royalty-free,
// uso comercial sem atribuição obrigatória).

const SOUND_FILES = {
  correct:         require('../../assets/sounds/correct.mp3') as number,
  wrong:           require('../../assets/sounds/wrong.mp3') as number,
  levelUp:         require('../../assets/sounds/level-up.mp3') as number,
  trophy:          require('../../assets/sounds/trophy.mp3') as number,
  complete:        require('../../assets/sounds/complete.mp3') as number,
  friendRequest:   require('../../assets/sounds/friend-request.mp3') as number,
  messageSent:     require('../../assets/sounds/message-sent.mp3') as number,
  messageReceived: require('../../assets/sounds/message-received.mp3') as number,
};

export type SoundName = keyof typeof SOUND_FILES;

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let initPromise: Promise<void> | null = null;

/** Preload todos os players. Chamar uma vez no boot da app (root layout). */
export function initSounds(): Promise<void> {
  if (!initPromise) {
    initPromise = setAudioModeAsync({ playsInSilentMode: true })
      .catch(() => {
        // Silencioso — se o modo de áudio falhar, os players ainda tentam tocar
      })
      .then(() => {
        (Object.keys(SOUND_FILES) as SoundName[]).forEach((name) => {
          players[name] = createAudioPlayer(SOUND_FILES[name]);
        });
      });
  }
  return initPromise;
}

/** Toca um efeito sonoro. Reinicia do início se já estiver a tocar (respostas rápidas). */
export function playSound(name: SoundName): void {
  const player = players[name];
  if (!player) return;
  try {
    player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // Dispositivo sem áudio disponível — ignora silenciosamente
  }
}
