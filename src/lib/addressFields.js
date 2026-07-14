export function addressFields(prefix, opts = {}) {
  const { required = true } = opts
  return [
    { type: 'text', id: `${prefix}.property`, label: 'Property name/number', required, half: true },
    { type: 'text', id: `${prefix}.street`, label: 'Street', required, half: true },
    { type: 'text', id: `${prefix}.area`, label: 'Area', half: true },
    { type: 'text', id: `${prefix}.town`, label: 'Town', required, half: true },
    { type: 'text', id: `${prefix}.county`, label: 'County', half: true },
    { type: 'text', id: `${prefix}.postcode`, label: 'Postcode', required, half: true },
  ]
}
