import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/env.mjs";
import Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { message: "No signature found" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { message: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  // Store the webhook event for debugging
  await prisma.stripeEvent.create({
    data: {
      stripeEventId: event.id,
      type: event.type,
      data: JSON.parse(JSON.stringify(event.data.object)),
    },
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        console.log("complete payment")
        const session = event.data.object as Stripe.Checkout.Session;
        const enrollmentId = session.metadata?.enrollmentId;

        if (!enrollmentId) {
          throw new Error("No enrollment ID found in session metadata");
        }

        // Update enrollment status
        await prisma.enrollment.update({
          where: { id: enrollmentId },
          data: {
            status: "ACTIVE",
            paymentStatus: "PAID",
          },
        });

        // Create payment record
        await prisma.payment.create({
          data: {
            enrollmentId,
            amount: session.amount_total ? session.amount_total / 100 : 0,
            currency: session.currency || "thb",
            status: "PAID",
            stripePaymentIntentId: session.payment_intent as string,
          },
        });

        break;
      }

      case "checkout.session.expired": {
        console.log("expired")
        const session = event.data.object as Stripe.Checkout.Session;
        const enrollmentId = session.metadata?.enrollmentId;

        if (enrollmentId) {
          await prisma.enrollment.update({
            where: { id: enrollmentId },
            data: {
              status: "EXPIRED",
              paymentStatus: "FAILED",
            },
          });
        }
        break;
      }

      case "payment_intent.payment_failed": {
        console.log("failed")
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const session = await stripe.checkout.sessions.retrieve(
          paymentIntent.metadata?.sessionId as string
        );
        const enrollmentId = session.metadata?.enrollmentId;

        if (enrollmentId) {
          await prisma.enrollment.update({
            where: { id: enrollmentId },
            data: {
              status: "EXPIRED",
              paymentStatus: "FAILED",
            },
          });

          // Create failed payment record
          await prisma.payment.create({
            data: {
              enrollmentId,
              amount: paymentIntent.amount ? paymentIntent.amount / 100 : 0,
              currency: paymentIntent.currency,
              status: "FAILED",
              stripePaymentIntentId: paymentIntent.id,
            },
          });
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { message: "Error processing webhook" },
      { status: 500 }
    );
  }
} 