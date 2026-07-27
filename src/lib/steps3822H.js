import { CONDITION_OPTIONS, DIETARY_OPTIONS } from './options'

// Only included in the journey when cadet.hasMedical === 'yes' (3822A Section 4).
export const steps3822H = [
  {
    id: 'h-intro',
    form: '3822H',
    section: '1',
    title: 'Health Declaration',
    subtitle: "Because you said your child has a medical condition, allergy or dietary need, we need a bit more detail - this is RAFAC Form 3822H. Your child's name and date of birth carry over automatically.",
    kind: 'readonly-intro',
  },
  {
    id: 'h-conditions',
    form: '3822H',
    section: '2',
    title: 'Which of these apply to your child?',
    kind: 'checklist',
    fieldId: 'health.conditions',
    options: CONDITION_OPTIONS,
    otherFieldId: 'health.conditionsOther',
  },
  {
    id: 'h-condition-details',
    form: '3822H',
    section: '2b/2c',
    title: 'Tell us more about each condition',
    subtitle: 'The paper form caps at two conditions before you need a whole separate form - here you can just add another.',
    kind: 'condition-details',
  },
  {
    id: 'h-ehc',
    form: '3822H',
    section: '2a',
    title: 'Education, Health and Care Plan',
    fields: [
      { type: 'yn', id: 'health.ehc', required: true, label: 'Does your child have an Education, Health and Care Plan?' },
      { type: 'yn', id: 'health.ehcShareCopy', label: 'Willing to share a copy with the unit?', showIf: (d) => d['health.ehc'] === true },
    ],
  },
  {
    id: 'h-allergies',
    form: '3822H',
    section: '3',
    title: 'Allergies',
    kind: 'allergies',
  },
  {
    id: 'h-dietary',
    form: '3822H',
    section: '4',
    title: 'Dietary restrictions',
    fields: [
      { type: 'checklist', id: 'health.dietary', label: 'Any dietary restrictions?', options: DIETARY_OPTIONS },
      { type: 'text', id: 'health.dietaryOther', label: 'Please give details', showIf: (d) => (d['health.dietary'] || []).includes('other') },
    ],
  },
  {
    id: 'h-declaration',
    form: '3822H',
    section: '5',
    title: 'Declaration & signature',
    kind: 'declaration',
  },
]
