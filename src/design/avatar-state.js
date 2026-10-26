export const AVATAR_STATES = Object.freeze(['idle', 'working', 'making', 'waiting', 'celebrate', 'resume']);
export const AVATAR_MIN_STAY = 1000;
export const AVATAR_FADE = 500;

// Presentation only: the caller supplies business facts; this never changes them.
export function avatarStateFor(business = {}) {
  if (business.completed && !business.stopped) return 'celebrate';
  if (business.resuming) return 'resume';
  if (business.stopped || business.waiting || business.error) return 'waiting';
  if (business.busy && business.producing) return 'making';
  if (business.busy) return 'working';
  return 'idle';
}

export function avatarBusinessForPose(pose) {
  return {
    busy: ['think', 'read'].includes(pose),
    producing: pose === 'read',
    waiting: ['sleep', 'encourage', 'point'].includes(pose),
    completed: pose === 'celebrate',
    resuming: ['wave', 'curious'].includes(pose)
  };
}

export function avatarBusinessForLearning(learning, newEvent = null) {
  return {
    busy: Boolean(learning.busy || learning.intakeBusy),
    producing: Boolean(learning.streamPreview),
    stopped: Boolean(learning.active?.stopped),
    waiting: Boolean(learning.activeQuestion) && !learning.busy,
    error: Boolean(learning.error || learning.coachError),
    completed: ['training.complete', 'coach.finish'].includes(newEvent?.type),
    completionId: newEvent?.id,
    resuming: newEvent?.type === 'task.resume'
  };
}

export const AVATAR_MEDIA = Object.freeze(
  Object.fromEntries(
    AVATAR_STATES.map((state) => [
      state,
      Object.freeze({
        poster: `/public/visual/avatar/${state}.webp`,
        video: state === 'waiting' ? null : `/public/visual/avatar/${state}.mp4`,
        packedAlpha: state !== 'waiting',
        loop: ['idle', 'working', 'making'].includes(state)
      })
    ])
  )
);
export const AVATAR_STATIC = '/static/images/logo.png';
