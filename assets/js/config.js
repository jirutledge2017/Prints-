// EpicPrints — runtime configuration
// Replace the placeholders below to enable real Stripe checkout.
window.EPICPRINTS_CONFIG = {
  // Your Stripe test publishable key (starts with pk_test_...)
  // Get one at https://dashboard.stripe.com/test/apikeys
  STRIPE_PUBLISHABLE_KEY: '',

  // Endpoint that creates a Stripe Checkout Session.
  // A reference Vercel/Netlify-style serverless handler is in
  // /api/create-checkout-session.js — deploy it and point this here.
  CHECKOUT_ENDPOINT: '/api/create-checkout-session',

  // Currency used at checkout
  CURRENCY: 'usd',
};
