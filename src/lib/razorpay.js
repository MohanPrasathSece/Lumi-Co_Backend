import Razorpay from "razorpay";

export const getRazorpayClient = () => {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!keyId || !keySecret) {
    console.warn("⚠️ Razorpay credentials are missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
    return null;
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};
