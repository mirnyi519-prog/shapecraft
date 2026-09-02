type Challenge = {
  answer: string;
  expiresAt: number;
};

const challenges = new Map<string, Challenge>();
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pruneExpired(now: number): void {
  if (challenges.size < 500) {
    return;
  }
  for (const [id, challenge] of challenges) {
    if (challenge.expiresAt <= now) {
      challenges.delete(id);
    }
  }
}

export function createCaptchaChallenge(): { id: string; question: string } {
  const now = Date.now();
  pruneExpired(now);

  const a = randomInt(2, 12);
  const b = randomInt(2, 12);
  const subtract = Math.random() > 0.5 && a > b;
  const question = subtract ? `${a} − ${b} = ?` : `${a} + ${b} = ?`;
  const answer = String(subtract ? a - b : a + b);
  const id = crypto.randomUUID();

  challenges.set(id, { answer, expiresAt: now + CHALLENGE_TTL_MS });
  return { id, question };
}

export function verifyCaptchaChallenge(id: string, answer: string | undefined): boolean {
  const trimmed = answer?.trim();
  if (!id || !trimmed) {
    return false;
  }

  const challenge = challenges.get(id);
  if (!challenge || challenge.expiresAt <= Date.now()) {
    challenges.delete(id);
    return false;
  }

  challenges.delete(id);

  return challenge.answer === trimmed;
}
