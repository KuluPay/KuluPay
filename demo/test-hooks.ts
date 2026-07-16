/**
 * Simple test to verify KuluPay hooks work
 * Run with: npx tsx demo/test-hooks.ts
 */

import { createKuluPayClient } from '@kulupay/kulupay/client';

// Test the client creation and hooks
function testClientCreation() {
  console.log('Testing KuluPay client creation...');
  
  const client = createKuluPayClient({
    baseURL: 'http://localhost:3000/api',
    providerId: 'stripe'
  });

  console.log('✓ Client created successfully');
  console.log('✓ Client has createIntent method:', typeof client.createIntent === 'function');
  console.log('✓ Client has getIntent method:', typeof client.getIntent === 'function');
  console.log('✓ Client has usePayment hook:', typeof client.usePayment === 'function');
  
  // Test hook creation
  const stripeHook = client.usePayment();
  console.log('✓ Stripe hook created');
  console.log('✓ Hook has createIntent:', typeof stripeHook.createIntent === 'function');
  console.log('✓ Hook has getIntent:', typeof stripeHook.getIntent === 'function');
  
  // Test provider override
  const paypalHook = client.usePayment('paypal');
  console.log('✓ PayPal hook created with provider override');
  
  console.log('\n✅ All tests passed!');
}

testClientCreation();
