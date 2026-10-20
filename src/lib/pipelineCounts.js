// The numbers on the staff dashboard.
//
// Pulled out of the component so they can be tested against a real spread of records. The
// headline figure used to be the hand-set 'joined' status, which read 2 while 41 cadets
// were fully enrolled, because staff set it afterwards and understandably did not keep up.
import { joiningSettled } from './paperworkComplete.js'

export function pipelineCounts(families = [], { hasMissedIntake = () => false } = {}) {
  const cadets = families.flatMap((family) => family.cadets || [])
  // Archived enquiries drop out of every live figure but still count as "did not join".
  const live = cadets.filter((cadet) => cadet.status !== 'withdrawn')
  const enrolled = live.filter((cadet) => joiningSettled(cadet))
  return {
    total: cadets.length,
    enrolled: enrolled.length,
    // Started something but not finished. Anyone still locked out has not begun.
    inProgress: live.filter((cadet) => !joiningSettled(cadet) && cadet.paperworkStatus !== 'locked').length,
    awaiting: families.filter((family) => !family.guardian?.verifiedAt).length,
    booked: live.filter((cadet) => cadet.openNightId && !cadet.attendedAt).length,
    waiting: live.filter((cadet) => cadet.status === 'future_waiting').length,
    missed: live.filter((cadet) => hasMissedIntake(cadet)).length,
    withdrawn: cadets.filter((cadet) => cadet.status === 'withdrawn').length,
    active: live.filter((cadet) => !joiningSettled(cadet)).length,
  }
}
