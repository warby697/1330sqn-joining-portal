export function paymentReturnUrls(returnUrl, kind, billingRequestId) {
  const build = (outcome) => {
    const url = new URL(returnUrl)
    url.search = ''
    url.searchParams.set('payment_kind', kind)
    url.searchParams.set('billing_request_id', billingRequestId)
    url.searchParams.set('payment_outcome', outcome)
    url.hash = '#/payment-return'
    return url.toString()
  }
  return { redirectUri: build('complete'), exitUri: build('cancelled') }
}
