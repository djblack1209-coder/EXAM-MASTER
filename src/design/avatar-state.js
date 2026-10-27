export const AVATAR_STATES = Object.freeze(['idle', 'working', 'making', 'waiting', 'celebrate', 'resume', 'error']);
export const AVATAR_MIN_STAY = 1000;
export const AVATAR_FADE = 500;

// Presentation only: the caller supplies business facts; this never changes them.
export function avatarStateFor(business = {}) {
  if (business.error) return 'error';
  if (business.stopped) return 'waiting';
  if (business.busy && business.producing) return 'making';
  if (business.busy) return 'working';
  if (business.completed) return 'celebrate';
  if (business.resuming) return 'resume';
  if (business.waiting) return 'waiting';
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
  const request = learning.active?.coach?.requests?.findLast((r) => r.id === learning.retryState?.requestId);
  const phase = request?.request?.phase;
  return {
    busy: Boolean(learning.busy || learning.intakeBusy),
    producing:
      Boolean(learning.streamPreview) ||
      Boolean(learning.busy && ['feedback', 'essay', 'daily', 'summary'].includes(phase)),
    activity: learning.busy ? phase || 'thinking' : null,
    stopped: Boolean(learning.active?.stopped),
    waiting: Boolean(learning.activeQuestion) && !learning.busy,
    error: Boolean(learning.error || learning.coachError),
    completed: ['training.complete', 'coach.finish', 'coach.result'].includes(newEvent?.type),
    completionId: newEvent?.id,
    resuming: newEvent?.type === 'task.resume'
  };
}

export const AVATAR_MEDIA = Object.freeze(
  Object.fromEntries(
    AVATAR_STATES.map((state) => [
      state,
      Object.freeze({
        poster: `/public/visual/avatar/${state === 'error' ? 'waiting' : state}.webp`,
        video: ['waiting', 'error'].includes(state) ? null : `/public/visual/avatar/${state}.mp4`,
        packedAlpha: !['waiting', 'error'].includes(state),
        loop: ['idle', 'working', 'making'].includes(state)
      })
    ])
  )
);
export const AVATAR_STATIC = '/static/images/logo.png';
