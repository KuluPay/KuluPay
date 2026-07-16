import React from 'react';
import { createKuluPayClient } from '@kulupay/kulupay/client';

// Initialize the KuluPay client
const kuluPay = createKuluPayClient({
  baseURL: 'http://localhost:3000/api',
  providerId: 'stripe'
});

/**
 * Simple React component demonstrating Stripe payment hooks
 */
export function StripePaymentDemo() {
  const { createIntent, getIntent, loading, error } = kuluPay.usePayment();

  const handleCreateIntent = async () => {
    try {
      const intent = await createIntent({
        amount: 1000, // $10.00
        currency: 'usd',
        metadata: {
          orderId: 'order_123'
        }
      });
      console.log('Payment intent created:', intent);
      alert(`Intent created: ${intent.id}\nStatus: ${intent.status}`);
    } catch (err) {
      console.error('Error creating intent:', err);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Stripe Payment Demo</h1>
      
      {error && (
        <div style={{ color: 'red', marginBottom: '10px' }}>
          Error: {error}
        </div>
      )}

      <button
        onClick={handleCreateIntent}
        disabled={loading}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: loading ? 'not-allowed' : 'pointer',
          backgroundColor: loading ? '#ccc' : '#635bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}
      >
        {loading ? 'Processing...' : 'Create Payment Intent ($10.00)'}
      </button>

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <p>This demo uses the KuluPay React hooks:</p>
        <ul>
          <li>Generic <code>usePayment</code> hook works with any provider</li>
          <li>Automatic loading and error states</li>
          <li>Type-safe payment operations</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Demo showing provider switching
 */
export function MultiProviderDemo() {
  const stripePayment = kuluPay.usePayment('stripe');
  const paypalPayment = kuluPay.usePayment('paypal');

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Multi-Provider Demo</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Stripe Payment</h3>
        <button
          onClick={() => stripePayment.createIntent({ amount: 1000, currency: 'usd' })}
          disabled={stripePayment.loading}
          style={{ padding: '10px 20px', marginRight: '10px' }}
        >
          Pay with Stripe
        </button>
        {stripePayment.error && <div style={{ color: 'red' }}>{stripePayment.error}</div>}
      </div>

      <div>
        <h3>PayPal Payment</h3>
        <button
          onClick={() => paypalPayment.createIntent({ amount: 1000, currency: 'usd' })}
          disabled={paypalPayment.loading}
          style={{ padding: '10px 20px' }}
        >
          Pay with PayPal
        </button>
        {paypalPayment.error && <div style={{ color: 'red' }}>{paypalPayment.error}</div>}
      </div>
    </div>
  );
}
