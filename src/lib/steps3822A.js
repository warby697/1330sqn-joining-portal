import { addressFields } from './addressFields'
import { NATIONALITY_OPTIONS, GENDER_OPTIONS, PRONOUN_OPTIONS, ETHNICITY_OPTIONS, PREV_ORG_OPTIONS } from './options'

export const steps3822A = [
  {
    id: 'cadet-details',
    section: '1a',
    title: "Cadet's details",
    subtitle: 'Gender and ethnicity are used only for anonymised MoD statistical reporting - never shared with a name attached.',
    completeIf: (d) =>
      (d['cadet.gender'] !== 'other' || String(d['cadet.genderOther'] || '').trim() !== '') &&
      (d['cadet.nationality'] !== 'other' || String(d['cadet.nationalityOther'] || '').trim() !== ''),
    incompleteMessage: "Please fill in the 'please specify' box for your selection.",
    fields: [
      { type: 'text', id: 'cadet.fullName', label: "Cadet's full name", help: 'As it appears on their birth certificate or passport.', required: true },
      { type: 'date', id: 'cadet.dob', label: 'Date of birth', help: 'Must be at least 12 and in Year 8 (S2 in Scotland) or above.', required: true },
      {
        type: 'select', id: 'cadet.nationality', label: 'Nationality', required: true, options: NATIONALITY_OPTIONS,
        otherValue: 'other', otherField: { type: 'text', id: 'cadet.nationalityOther', label: 'Please specify nationality' },
      },
      { type: 'text', id: 'cadet.religion', label: 'Religion (optional)', help: "Used for pastoral care only - leave blank if you'd rather not say." },
      {
        type: 'select', id: 'cadet.gender', label: 'Gender', required: true, options: GENDER_OPTIONS,
        otherValue: 'other', otherField: { type: 'text', id: 'cadet.genderOther', label: 'Please specify' },
      },
      { type: 'select', id: 'cadet.pronoun', label: 'Pronoun (optional)', options: PRONOUN_OPTIONS },
      { type: 'select', id: 'cadet.ethnicity', label: 'Ethnicity', required: true, grouped: true, options: ETHNICITY_OPTIONS },
    ],
  },
  {
    id: 'external-agency',
    section: '1b',
    title: 'External agency involvement',
    fields: [
      {
        type: 'yn', id: 'cadet.externalAgency', required: true,
        label: 'Is a social worker or family support worker currently involved with your family?',
        help: "Helps the unit offer the right support. Answering yes doesn't affect your child's place.",
      },
    ],
  },
  {
    id: 'contact-details',
    section: '1c',
    title: "Cadet's contact details",
    subtitle: 'At least one phone number and a working primary email are required to set up the Cadet Portal account.',
    completeIf: (d) => String(d['cadet.mobile'] || '').trim() !== '' || String(d['cadet.homePhone'] || '').trim() !== '',
    incompleteMessage: 'Please enter at least one phone number for the cadet (mobile or home).',
    fields: [
      ...addressFields('cadet.address'),
      { type: 'text', id: 'cadet.mobile', label: 'Mobile phone', help: 'Enter at least one of mobile or home phone.', half: true },
      { type: 'text', id: 'cadet.homePhone', label: 'Home phone', half: true },
      {
        type: 'notice',
        id: 'cadet.emailNotice',
        textFor: (d) => {
          const first = (d['cadet.fullName'] || '').trim().split(' ')[0]
          return `⚠ This must be an email address for ${first || 'the cadet'} - NOT a parent or guardian's own email. ${first || 'The cadet'}'s Cadet Portal sign-in details will be sent to this address, so ${first ? first : 'they'} must be able to check it. If they don't have an email address, ask the squadron before entering your own.`
        },
      },
      {
        type: 'text',
        id: 'cadet.primaryEmail',
        label: 'primary_email_label',
        labelFor: (d) => {
          const first = (d['cadet.fullName'] || '').trim().split(' ')[0]
          return first ? `${first}'s email address` : "Cadet's email address"
        },
        required: true,
        help: "Sign-in details are sent here - the cadet must be able to access it themselves, not just a parent.",
      },
      { type: 'text', id: 'cadet.secondaryEmail', label: 'Secondary email (optional)' },
      {
        type: 'ack',
        id: 'cadet.emailConfirmed',
        required: true,
        label: "I confirm the email above belongs to the cadet, not a parent/guardian",
      },
    ],
  },
  {
    id: 'previous-orgs',
    section: '1d',
    title: 'Previous youth organisations',
    fields: [
      { type: 'checklist', id: 'cadet.previousOrgs', label: 'Has your child belonged to any of these before?', options: PREV_ORG_OPTIONS },
      { type: 'text', id: 'cadet.otherOrg', label: 'Any other organisation? (optional)' },
    ],
  },
  {
    id: 'next-of-kin',
    section: '2a',
    title: 'Next of kin - parent/guardian 1',
    fields: [
      {
        type: 'yn', id: 'parent1.parentalResponsibility', required: true, gate: true,
        label: 'Do you have parental responsibility for this cadet?',
        help: 'You must answer yes to submit this form on their behalf.',
      },
      { type: 'text', id: 'parent1.title', label: 'Title', half: true },
      { type: 'text', id: 'parent1.fullName', label: 'Full name', required: true, half: true },
      { type: 'text', id: 'parent1.relationship', label: 'Relationship to cadet', required: true },
      {
        type: 'yn', id: 'parent1.addressSameAsCadet', required: true,
        label: "Is this parent/guardian's address the same as the cadet's?",
      },
      ...addressFields('parent1.address').map((f) => ({ ...f, showIf: (d) => d['parent1.addressSameAsCadet'] !== true })),
      { type: 'text', id: 'parent1.mobile', label: 'Mobile phone', half: true },
      { type: 'text', id: 'parent1.homePhone', label: 'Home phone', half: true },
      { type: 'text', id: 'parent1.primaryEmail', label: 'Primary email', required: true },
      { type: 'text', id: 'parent1.secondaryEmail', label: 'Secondary email (optional)' },
    ],
  },
  {
    id: 'second-contact',
    section: '2b',
    title: 'Second contact (optional)',
    fields: [
      { type: 'yn', id: 'hasSecondContact', label: 'Add a second parent/guardian?' },
      { type: 'text', id: 'parent2.title', label: 'Title', half: true, showIf: (d) => d.hasSecondContact },
      { type: 'text', id: 'parent2.fullName', label: 'Full name', half: true, showIf: (d) => d.hasSecondContact },
      { type: 'text', id: 'parent2.relationship', label: 'Relationship to cadet', showIf: (d) => d.hasSecondContact },
      {
        type: 'yn', id: 'parent2.addressSameAsCadet',
        label: "Is this parent/guardian's address the same as the cadet's?",
        showIf: (d) => d.hasSecondContact,
      },
      ...addressFields('parent2.address', { required: false }).map((f) => ({
        ...f, showIf: (d) => d.hasSecondContact && d['parent2.addressSameAsCadet'] !== true,
      })),
      { type: 'text', id: 'parent2.mobile', label: 'Mobile phone', half: true, showIf: (d) => d.hasSecondContact },
      { type: 'text', id: 'parent2.homePhone', label: 'Home phone', half: true, showIf: (d) => d.hasSecondContact },
      { type: 'text', id: 'parent2.primaryEmail', label: 'Primary email', showIf: (d) => d.hasSecondContact },
      { type: 'text', id: 'parent2.secondaryEmail', label: 'Secondary email (optional)', showIf: (d) => d.hasSecondContact },
    ],
  },
  {
    id: 'consents',
    section: '3',
    title: 'Consent to participate',
    subtitle: 'Every item below stands in for a paragraph of MOD legal text on the paper form - the full wording is one tap away if you want it.',
    fields: [
      { type: 'yn', id: 'consent.photo', required: true, label: 'Can we use photos/videos of your child to promote the squadron?', help: 'Home addresses are never shared. Can be withdrawn any time in writing.' },
      { type: 'yn', id: 'consent.flyingLight', required: true, label: 'Flying - air experience (light aircraft & gliders)' },
      { type: 'yn', id: 'consent.flyingSolo', required: true, label: 'Flying - solo gliding / powered aircraft' },
      { type: 'yn', id: 'consent.flyingTransport', required: true, label: 'Flying - passenger transport aircraft & helicopters' },
      { type: 'yn', id: 'consent.flyingOther', required: true, label: 'Flying - other, incl. high-performance jets' },
      { type: 'yn', id: 'consent.marksmanship', required: true, label: 'Air rifle / rifle / shotgun marksmanship training', help: 'Fully supervised by qualified instructors under the Cadet Safe System of Training.' },
      { type: 'yn', id: 'consent.physical', required: true, label: 'Strenuous physical activity (fieldcraft, adventure training)' },
      { type: 'yn', id: 'consent.lowerRisk', required: true, label: 'Standard lower-risk unit activities (local events, parades, trips)' },
      { type: 'ack', id: 'consent.medicalInform', required: true, label: "I'll tell the unit if my child's medical condition changes" },
      { type: 'yn', id: 'consent.transport', required: true, label: 'Staff/volunteers may drive or use minibuses to transport your child' },
    ],
  },
  {
    id: 'medical-trigger',
    section: '4',
    title: 'Medical, allergy & dietary',
    fields: [
      {
        type: 'yn', id: 'cadet.hasMedical', required: true,
        label: 'Does your child have a medical condition, SEN, allergy or dietary requirement?',
        help: 'A "yes" opens the Health Declaration (3822H) straight after this form - no separate paperwork to chase up.',
      },
    ],
  },
  {
    id: 'medical-treatment',
    section: '5',
    title: 'Consent to medical treatment',
    fields: [
      { type: 'yn', id: 'consent.medicalTreatment', required: true, label: 'The Officer in Charge may authorise emergency medical treatment if you can\'t be reached' },
    ],
  },
  {
    id: 'additional-info',
    section: '6',
    title: 'Additional information',
    fields: [
      { type: 'text', id: 'cadet.school', label: 'Current school', required: true },
      { type: 'textarea', id: 'cadet.howHeard', label: 'How did you hear about us?' },
      { type: 'textarea', id: 'cadet.reasonForJoining', label: 'Why does your child want to join?' },
    ],
  },
  {
    id: 'agreement',
    section: '8',
    title: 'Agreement & signature',
    subtitle: 'Section 7 (data protection) carries no field of its own - it\'s a plain-read consent, covered by your signature below.',
    fields: [
      {
        type: 'details',
        id: 'agreement.section7',
        summary: 'Read Section 7 - Data Protection & MOD Computer Systems',
        text: `By providing consent to join the RAF Air Cadets, I agree to the RAF Air Cadets recording and processing information about my child on the Cadet Forces Management Information System computer systems which includes the Cadet Portal.

If your child has been a member of one of the youth organisations listed at Section 1c, we may contact this organisation to share information about your child with them. If you do not consent to this information sharing, please contact the unit Officer Commanding.

I understand that my child will have direct access to Cadet Portal (cadets.bader.mod.uk) and this website is used to communicate key information to my child on their training progress, events and activities, absence reporting, access to key documents and forms, access to the unit training programme and information that will support them during their membership of the RAF Air Cadets.

I understand that the RAF Air Cadets will create a Cadet Portal user account for my child during the joining process and that a welcome email will be sent to them via the email address added to this form.

I understand the data added to my child's record held on the Cadet Forces MIS is for administrating their membership of the RAF Air Cadets. My consent is conditional upon the RAF Air Cadets complying with its duties and obligations under the Data Protection Act 2018 and the UK GDPR. This information will be held and processed for the purposes set out in the RAF Air Cadets Privacy Notice - Cadets.

The RAF Air Cadets utilises official MOD web-based accredited collaboration, meeting and training tools to deliver web-based/virtual training sessions for official cadet events. Such sessions will always have a minimum of two Cadet Forces Adult Volunteers present and all sessions may be recorded, held on Cadet Forces infrastructure for safeguarding purposes, accessible only to the local unit and MOD Permanent Staff. Should parents/guardians not give consent for their child to take part in such sessions, cadets will not be permitted to take part.

I understand that I have the right, as the adult with parental responsibility, to access data relating to my child, to be informed about the existence and extent of data processing, to rectify incorrect personal data, and to oppose further processing on serious and legitimate grounds. The personal details contained in this Consent Certificate will be transferred to my child's central record held on the Cadet Forces MIS.`,
      },
      { type: 'yn', id: 'consent.contactShare', required: true, label: 'OK for staff to contact you using these details?' },
      {
        type: 'readback',
        id: 'signature.signerName',
        label: 'Signing as',
        valueFor: (d) => d['parent1.fullName'] || '',
        help: 'The parent/guardian with parental responsibility, from Section 2a. Payments use the cadet’s reference, not this name.',
      },
      { type: 'text', id: 'signature.signature', label: 'Type your full name to sign', required: true, help: 'Same standing as a handwritten signature.' },
    ],
  },
]
