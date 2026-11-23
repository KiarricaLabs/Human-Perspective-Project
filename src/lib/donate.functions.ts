import { createServerFn } from "@tanstack/react-start";
import Stripe from "stripe";

export const createDonationSession = createServerFn({ method: "POST" }).inputValidator((d: unknown) => (typeof d === "number" ? d : 0)).handler(async ({ data }) => {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Stripe is not configured.");
  const stripe = new Stripe(key);
  const amount = Math.max(100, Math.round((data || 0) * 100)) || 1000;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price_data: { currency: "usd", product_data: { name: "Support The Human Perspective Project" }, unit_amount: amount }, quantity: 1 }],
    success_url: `${process.env["SITE_URL"] || "http://localhost:3000"}/donate?success=1`,
    cancel_url: `${process.env["SITE_URL"] || "http://localhost:3000"}/donate?canceled=1`,
  });
  return { url: session.url };
});
