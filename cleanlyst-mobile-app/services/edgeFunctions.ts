type CreatePaymentIntentResponse = {
  clientSecret: string;
};

const EDGE_URL = process.env.EXPO_PUBLIC_EDGE_URL ?? "";

if (!EDGE_URL) {
  throw new Error("Expo edge function URL is required in EXPO_PUBLIC_EDGE_URL");
}

export async function createPaymentIntent(bookingId: string) {
  const response = await fetch(`${EDGE_URL}/create-payment-intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bookingId }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || "Unable to create payment intent");
  }

  const data = (await response.json()) as CreatePaymentIntentResponse;
  return data.clientSecret;
}
