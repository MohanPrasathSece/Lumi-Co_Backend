import crypto from "crypto";
import Order from "../models/Order.js";
import { getRazorpayClient } from "../lib/razorpay.js";
import { sendOrderEmails } from "../utils/email.js";

const verifyRequiredFields = ({ customer, shippingAddress, items }) => {
  if (!customer?.name || !customer?.email || !customer?.phone) {
    throw new Error("Customer name, email, and phone are required.");
  }

  if (!shippingAddress?.line1 || !shippingAddress?.city || !shippingAddress?.state || !shippingAddress?.postalCode || !shippingAddress?.country) {
    throw new Error("Complete shipping address is required.");
  }

  if (!Array.isArray(items) || !items.length) {
    throw new Error("At least one item is required.");
  }
};

const calculateAmounts = (items) => {
  const amount = items.reduce((total, item) => {
    const itemPrice = Number(item.price) || 0;
    const itemQty = Number(item.quantity) || 0;
    return total + itemPrice * itemQty;
  }, 0);

  const amountInPaise = Math.round(amount * 100);

  if (!amountInPaise) {
    throw new Error("Order amount must be greater than zero.");
  }

  return { amount, amountInPaise };
};

export const createOrder = async (req, res) => {
  try {
    const razorpayClient = getRazorpayClient();
    if (!razorpayClient) {
      return res.status(500).json({ error: "Payment gateway is not configured." });
    }

    const { customer, shippingAddress, items, notes } = req.body;
    verifyRequiredFields({ customer, shippingAddress, items });

    const { amount, amountInPaise } = calculateAmounts(items);

    const razorpayOrder = await razorpayClient.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `lumi_${Date.now()}`,
      notes: {
        customerEmail: customer.email,
        customerName: customer.name,
      },
    });

    const order = await Order.create({
      razorpayOrderId: razorpayOrder.id,
      amount,
      amountInPaise,
      currency: razorpayOrder.currency,
      status: "pending",
      customer,
      shippingAddress,
      items,
      notes,
    });

    return res.json({
      success: true,
      message: "Order created",
      orderId: razorpayOrder.id,
      amount: amountInPaise,
      currency: razorpayOrder.currency,
      razorpayKey: razorpayClient.key_id,
      order: {
        id: order._id,
        status: order.status,
      },
    });
  } catch (error) {
    console.error("Failed to create order", error);
    return res.status(400).json({ error: error.message || "Unable to create order" });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ error: "Payment verification data is incomplete." });
    }

    const order = await Order.findOne({ razorpayOrderId });

    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    const isValid = expectedSignature === razorpaySignature;

    if (!isValid) {
      order.status = "failed";
      await order.save();
      return res.status(400).json({ error: "Invalid payment signature." });
    }

    order.status = "paid";
    order.razorpayPaymentId = razorpayPaymentId;
    order.razorpaySignature = razorpaySignature;
    order.paidAt = new Date();
    await order.save();

    try {
      await sendOrderEmails({ order });
    } catch (emailError) {
      console.error("Failed to send order emails", emailError);
    }

    return res.json({ success: true, message: "Payment verified", orderId: order.razorpayOrderId });
  } catch (error) {
    console.error("Payment verification failed", error);
    return res.status(400).json({ error: error.message || "Unable to verify payment" });
  }
};
