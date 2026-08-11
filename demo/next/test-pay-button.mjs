const res = await fetch("http://localhost:3000/api/pay/create-intent", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "http://localhost:3000",
  },
  body: JSON.stringify({
    amount: 1000,
    currency: "usd",
    providerId: "ethereum",
    token: "USDC",
    description: "Test payment",
    type: "one_time",
  }),
});

const text = await res.text();
console.log(`Status: ${res.status}`);
console.log(text);
